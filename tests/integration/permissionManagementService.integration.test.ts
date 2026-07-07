import { beforeEach, describe, expect, it } from "vitest";
import { ensureDefaultRolePermissions } from "@/services/permissions/rolePermissionDefaults";
import {
  PermissionManagementError,
  setManagedRolePermission,
  setManagedUserPermissionOverride,
} from "@/services/permissions/permissionManagementService";
import { resolvePermission } from "@/services/permissions/resolvePermission";
import {
  createGroup,
  createInstitution,
  createStaffUser,
  resetDatabase,
  testPrisma,
} from "./db";

beforeEach(async () => {
  await resetDatabase();
});

describe("permission management service (real Postgres)", () => {
  it("lets an admin grant and revoke role permissions with audit entries", async () => {
    const institution = await createInstitution();
    const admin = await createStaffUser({ institutionId: institution.id, role: "ADMIN" });
    const counselor = await createStaffUser({ institutionId: institution.id, role: "COUNSELOR" });
    await ensureDefaultRolePermissions(institution.id);
    const actor = { id: admin.id, institutionId: institution.id, role: "ADMIN" as const };

    const granted = await setManagedRolePermission({
      actor,
      institutionId: institution.id,
      role: "COUNSELOR",
      action: "MANAGE_GROUPS",
      allowed: true,
    });

    expect(granted).toMatchObject({
      institutionId: institution.id,
      role: "COUNSELOR",
      action: "MANAGE_GROUPS",
      allowed: true,
    });
    await expect(
      resolvePermission(
        { id: counselor.id, institutionId: institution.id, role: "COUNSELOR" },
        "MANAGE_GROUPS",
      ),
    ).resolves.toBe(true);

    await setManagedRolePermission({
      actor,
      institutionId: institution.id,
      role: "COUNSELOR",
      action: "MANAGE_GROUPS",
      allowed: false,
    });
    await expect(
      resolvePermission(
        { id: counselor.id, institutionId: institution.id, role: "COUNSELOR" },
        "MANAGE_GROUPS",
      ),
    ).resolves.toBe(false);

    const auditEntries = await testPrisma.auditLogEntry.findMany({
      where: {
        institutionId: institution.id,
        actorId: admin.id,
        action: "PERMISSION.ROLE_SET",
      },
      orderBy: { createdAt: "asc" },
    });
    expect(auditEntries).toHaveLength(2);
    expect(auditEntries[0]?.metadata).toMatchObject({
      role: "COUNSELOR",
      permissionAction: "MANAGE_GROUPS",
      allowed: true,
    });
    expect(auditEntries[1]?.metadata).toMatchObject({ allowed: false });
  });

  it("denies permission management without MANAGE_PERMISSIONS", async () => {
    const institution = await createInstitution();
    const counselor = await createStaffUser({ institutionId: institution.id, role: "COUNSELOR" });
    await ensureDefaultRolePermissions(institution.id);

    await expect(
      setManagedRolePermission({
        actor: { id: counselor.id, institutionId: institution.id, role: "COUNSELOR" },
        institutionId: institution.id,
        role: "COUNSELOR",
        action: "MANAGE_GROUPS",
        allowed: true,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    } satisfies Partial<PermissionManagementError>);
  });

  it("wraps user override writes with MANAGE_PERMISSIONS and audit", async () => {
    const institution = await createInstitution();
    const admin = await createStaffUser({ institutionId: institution.id, role: "ADMIN" });
    const counselor = await createStaffUser({ institutionId: institution.id, role: "COUNSELOR" });
    const group = await createGroup(institution.id);
    await ensureDefaultRolePermissions(institution.id);

    const override = await setManagedUserPermissionOverride({
      actor: { id: admin.id, institutionId: institution.id, role: "ADMIN" },
      institutionId: institution.id,
      staffId: counselor.id,
      action: "ENTER_REPORTS",
      effect: "ALLOW",
      groupId: group.id,
    });

    expect(override).toMatchObject({
      institutionId: institution.id,
      staffId: counselor.id,
      action: "ENTER_REPORTS",
      effect: "ALLOW",
      groupId: group.id,
      traineeId: null,
    });
    await expect(
      resolvePermission(
        { id: counselor.id, institutionId: institution.id, role: "COUNSELOR" },
        "ENTER_REPORTS",
        { groupId: group.id },
      ),
    ).resolves.toBe(true);
    await expect(
      testPrisma.auditLogEntry.findFirstOrThrow({
        where: {
          institutionId: institution.id,
          actorId: admin.id,
          action: "PERMISSION.USER_OVERRIDE_SET",
        },
      }),
    ).resolves.toMatchObject({
      metadata: {
        staffId: counselor.id,
        permissionAction: "ENTER_REPORTS",
        effect: "ALLOW",
        groupId: group.id,
        traineeId: null,
      },
    });
  });

  it("rolls back a managed user override when audit cannot be written", async () => {
    const institution = await createInstitution();
    const counselor = await createStaffUser({ institutionId: institution.id, role: "COUNSELOR" });
    const group = await createGroup(institution.id);
    await ensureDefaultRolePermissions(institution.id);

    await expect(
      setManagedUserPermissionOverride({
        actor: {
          id: "missing-admin-actor",
          institutionId: institution.id,
          role: "ADMIN",
        },
        institutionId: institution.id,
        staffId: counselor.id,
        action: "ENTER_REPORTS",
        effect: "ALLOW",
        groupId: group.id,
      }),
    ).rejects.toThrow();

    await expect(
      testPrisma.userPermissionOverride.count({
        where: {
          institutionId: institution.id,
          staffId: counselor.id,
          action: "ENTER_REPORTS",
        },
      }),
    ).resolves.toBe(0);
  });
});
