import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  redirect: vi.fn((destination: string) => {
    const error = new Error("NEXT_REDIRECT");
    Object.assign(error, { destination });
    throw error;
  }),
  revalidatePath: vi.fn(),
  setManagedRolePermission: vi.fn(),
  setManagedUserPermissionOverride: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/services/permissions/permissionOverrideService", () => ({
  PermissionOverrideValidationError: class PermissionOverrideValidationError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock("@/services/permissions/permissionManagementService", () => ({
  PermissionManagementError: class PermissionManagementError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  setManagedRolePermission: mocks.setManagedRolePermission,
  setManagedUserPermissionOverride: mocks.setManagedUserPermissionOverride,
}));

import { setUserPermissionOverrideAction } from "./actions";

function overrideForm(overrides: Record<string, string | undefined> = {}) {
  const formData = new FormData();
  formData.set("staffId", overrides.staffId ?? "staff-2");
  formData.set("action", overrides.action ?? "VIEW_REPORTS");
  formData.set("effect", overrides.effect ?? "ALLOW");
  formData.set("scopeType", overrides.scopeType ?? "institution");

  if (overrides.groupId !== undefined) formData.set("groupId", overrides.groupId);
  if (overrides.traineeId !== undefined) formData.set("traineeId", overrides.traineeId);

  return formData;
}

describe("permission override server action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({
      user: {
        id: "admin-1",
        institutionId: "institution-1",
        role: "ADMIN",
      },
    });
  });

  test("rejects direct group-scope posts without a selected group", async () => {
    await expect(
      setUserPermissionOverrideAction(overrideForm({ scopeType: "group" })),
    ).rejects.toMatchObject({
      destination: "/permissions?permissionError=malformed-scope",
    });

    expect(mocks.setManagedUserPermissionOverride).not.toHaveBeenCalled();
  });

  test("rejects direct trainee-scope posts without a selected trainee", async () => {
    await expect(
      setUserPermissionOverrideAction(overrideForm({ scopeType: "trainee" })),
    ).rejects.toMatchObject({
      destination: "/permissions?permissionError=malformed-scope",
    });

    expect(mocks.setManagedUserPermissionOverride).not.toHaveBeenCalled();
  });

  test("passes only the selected narrow scope to the management service", async () => {
    await expect(
      setUserPermissionOverrideAction(
        overrideForm({ scopeType: "group", groupId: "group-1", traineeId: "trainee-1" }),
      ),
    ).rejects.toMatchObject({
      destination: "/permissions?permissionNotice=override-updated",
    });

    expect(mocks.setManagedUserPermissionOverride).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { id: "admin-1", institutionId: "institution-1", role: "ADMIN" },
        institutionId: "institution-1",
        staffId: "staff-2",
        action: "VIEW_REPORTS",
        effect: "ALLOW",
        groupId: "group-1",
        traineeId: null,
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/permissions");
  });
});
