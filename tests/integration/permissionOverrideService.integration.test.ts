import { beforeEach, describe, expect, it } from "vitest";
import {
  PermissionOverrideValidationError,
  upsertUserPermissionOverride,
} from "@/services/permissions/permissionOverrideService";
import {
  createGroup,
  createInstitution,
  createStaffUser,
  createTrainee,
  resetDatabase,
  setUserPermissionOverride,
  testPrisma,
} from "./db";

beforeEach(async () => {
  await resetDatabase();
});

describe("upsertUserPermissionOverride (real Postgres)", () => {
  it("creates a scoped override for a new write action", async () => {
    const institution = await createInstitution();
    const staff = await createStaffUser({ institutionId: institution.id });
    const group = await createGroup(institution.id);

    const override = await upsertUserPermissionOverride({
      institutionId: institution.id,
      staffId: staff.id,
      action: "MANAGE_GROUP_SETTINGS",
      effect: "ALLOW",
      groupId: group.id,
    });

    expect(override).toMatchObject({
      institutionId: institution.id,
      staffId: staff.id,
      action: "MANAGE_GROUP_SETTINGS",
      effect: "ALLOW",
      groupId: group.id,
      traineeId: null,
    });
  });

  it("creates an institution-wide override for a staff user in the same institution", async () => {
    const institution = await createInstitution();
    const staff = await createStaffUser({ institutionId: institution.id });

    const override = await upsertUserPermissionOverride({
      institutionId: institution.id,
      staffId: staff.id,
      action: "VIEW_REPORTS",
      effect: "ALLOW",
    });

    expect(override).toMatchObject({
      institutionId: institution.id,
      staffId: staff.id,
      action: "VIEW_REPORTS",
      effect: "ALLOW",
      groupId: null,
      traineeId: null,
    });
  });

  it("rejects a malformed scope with both groupId and traineeId", async () => {
    const institution = await createInstitution();
    const staff = await createStaffUser({ institutionId: institution.id });
    const group = await createGroup(institution.id);
    const trainee = await createTrainee({ institutionId: institution.id, groupId: group.id });

    await expect(
      upsertUserPermissionOverride({
        institutionId: institution.id,
        staffId: staff.id,
        action: "VIEW_REPORTS",
        effect: "ALLOW",
        groupId: group.id,
        traineeId: trainee.id,
      }),
    ).rejects.toMatchObject({
      code: "MALFORMED_SCOPE",
    } satisfies Partial<PermissionOverrideValidationError>);
  });

  it("rejects a staff user from a different institution", async () => {
    const institutionA = await createInstitution("Institution A");
    const institutionB = await createInstitution("Institution B");
    const staffB = await createStaffUser({ institutionId: institutionB.id });

    await expect(
      upsertUserPermissionOverride({
        institutionId: institutionA.id,
        staffId: staffB.id,
        action: "VIEW_REPORTS",
        effect: "ALLOW",
      }),
    ).rejects.toMatchObject({
      code: "STAFF_OUT_OF_SCOPE",
    } satisfies Partial<PermissionOverrideValidationError>);
  });

  it("rejects a group from a different institution", async () => {
    const institutionA = await createInstitution("Institution A");
    const institutionB = await createInstitution("Institution B");
    const staffA = await createStaffUser({ institutionId: institutionA.id });
    const groupB = await createGroup(institutionB.id);

    await expect(
      upsertUserPermissionOverride({
        institutionId: institutionA.id,
        staffId: staffA.id,
        action: "VIEW_REPORTS",
        effect: "ALLOW",
        groupId: groupB.id,
      }),
    ).rejects.toMatchObject({
      code: "GROUP_OUT_OF_SCOPE",
    } satisfies Partial<PermissionOverrideValidationError>);
  });

  it("rejects a trainee from a different institution", async () => {
    const institutionA = await createInstitution("Institution A");
    const institutionB = await createInstitution("Institution B");
    const staffA = await createStaffUser({ institutionId: institutionA.id });
    const traineeB = await createTrainee({ institutionId: institutionB.id });

    await expect(
      upsertUserPermissionOverride({
        institutionId: institutionA.id,
        staffId: staffA.id,
        action: "VIEW_REPORTS",
        effect: "ALLOW",
        traineeId: traineeB.id,
      }),
    ).rejects.toMatchObject({
      code: "TRAINEE_OUT_OF_SCOPE",
    } satisfies Partial<PermissionOverrideValidationError>);
  });

  it("deduplicates same-scope writes deterministically and stores the requested effect", async () => {
    const institution = await createInstitution();
    const staff = await createStaffUser({ institutionId: institution.id });
    const group = await createGroup(institution.id);
    await setUserPermissionOverride({
      institutionId: institution.id,
      staffId: staff.id,
      action: "VIEW_REPORTS",
      effect: "ALLOW",
      groupId: group.id,
    });
    await setUserPermissionOverride({
      institutionId: institution.id,
      staffId: staff.id,
      action: "VIEW_REPORTS",
      effect: "DENY",
      groupId: group.id,
    });

    const override = await upsertUserPermissionOverride({
      institutionId: institution.id,
      staffId: staff.id,
      action: "VIEW_REPORTS",
      effect: "DENY",
      groupId: group.id,
    });

    const sameScopeRows = await testPrisma.userPermissionOverride.findMany({
      where: {
        institutionId: institution.id,
        staffId: staff.id,
        action: "VIEW_REPORTS",
        groupId: group.id,
        traineeId: null,
      },
    });
    expect(sameScopeRows).toHaveLength(1);
    expect(sameScopeRows[0]?.id).toBe(override.id);
    expect(sameScopeRows[0]?.effect).toBe("DENY");
  });
});
