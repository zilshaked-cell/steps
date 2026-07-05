import { beforeEach, describe, expect, it } from "vitest";
import { resolvePermission } from "@/services/permissions/resolvePermission";
import {
  resetDatabase,
  createInstitution,
  createStaffUser,
  createGroup,
  createTrainee,
  setRolePermission,
  setUserPermissionOverride,
} from "./db";

beforeEach(async () => {
  await resetDatabase();
});

describe("resolvePermission (real Postgres)", () => {
  it("denies access to a group belonging to a different institution, even for an ADMIN with a blanket allow", async () => {
    const institutionA = await createInstitution("Institution A");
    const institutionB = await createInstitution("Institution B");
    const adminA = await createStaffUser({ institutionId: institutionA.id, role: "ADMIN" });
    await setRolePermission({
      institutionId: institutionA.id,
      role: "ADMIN",
      action: "VIEW_REPORTS",
      allowed: true,
    });
    const groupB = await createGroup(institutionB.id);

    // Note: institutionId is intentionally NOT part of the scope anymore — ownership
    // is derived from the actual groupB row in the database, not asserted by the caller.
    const canView = await resolvePermission(
      { id: adminA.id, institutionId: institutionA.id, role: "ADMIN" },
      "VIEW_REPORTS",
      { groupId: groupB.id },
    );

    expect(canView).toBe(false);
  });

  it("denies when scope.groupId does not exist at all", async () => {
    const institution = await createInstitution();
    const admin = await createStaffUser({ institutionId: institution.id, role: "ADMIN" });
    await setRolePermission({
      institutionId: institution.id,
      role: "ADMIN",
      action: "VIEW_REPORTS",
      allowed: true,
    });

    const canView = await resolvePermission(
      { id: admin.id, institutionId: institution.id, role: "ADMIN" },
      "VIEW_REPORTS",
      { groupId: "does-not-exist" },
    );

    expect(canView).toBe(false);
  });

  it("denies access to a trainee belonging to a different institution", async () => {
    const institutionA = await createInstitution("Institution A");
    const institutionB = await createInstitution("Institution B");
    const adminA = await createStaffUser({ institutionId: institutionA.id, role: "ADMIN" });
    await setRolePermission({
      institutionId: institutionA.id,
      role: "ADMIN",
      action: "VIEW_REPORTS",
      allowed: true,
    });
    const traineeB = await createTrainee({ institutionId: institutionB.id });

    const canView = await resolvePermission(
      { id: adminA.id, institutionId: institutionA.id, role: "ADMIN" },
      "VIEW_REPORTS",
      { traineeId: traineeB.id },
    );

    expect(canView).toBe(false);
  });

  it("denies when scope.traineeId does not exist at all", async () => {
    const institution = await createInstitution();
    const admin = await createStaffUser({ institutionId: institution.id, role: "ADMIN" });
    await setRolePermission({
      institutionId: institution.id,
      role: "ADMIN",
      action: "VIEW_REPORTS",
      allowed: true,
    });

    const canView = await resolvePermission(
      { id: admin.id, institutionId: institution.id, role: "ADMIN" },
      "VIEW_REPORTS",
      { traineeId: "does-not-exist" },
    );

    expect(canView).toBe(false);
  });

  it("denies by default when the role has no explicit allow and there is no override", async () => {
    const institution = await createInstitution();
    const counselor = await createStaffUser({ institutionId: institution.id, role: "COUNSELOR" });
    await setRolePermission({
      institutionId: institution.id,
      role: "COUNSELOR",
      action: "VIEW_REPORTS",
      allowed: false,
    });
    const group = await createGroup(institution.id);

    const canView = await resolvePermission(
      { id: counselor.id, institutionId: institution.id, role: "COUNSELOR" },
      "VIEW_REPORTS",
      { groupId: group.id },
    );

    expect(canView).toBe(false);
  });

  it("lets a per-user ALLOW override win over a false role default, scoped to that group only", async () => {
    const institution = await createInstitution();
    const counselor = await createStaffUser({ institutionId: institution.id, role: "COUNSELOR" });
    await setRolePermission({
      institutionId: institution.id,
      role: "COUNSELOR",
      action: "VIEW_REPORTS",
      allowed: false,
    });
    const permittedGroup = await createGroup(institution.id, "Permitted Group");
    const otherGroup = await createGroup(institution.id, "Other Group");
    await setUserPermissionOverride({
      institutionId: institution.id,
      staffId: counselor.id,
      action: "VIEW_REPORTS",
      effect: "ALLOW",
      groupId: permittedGroup.id,
    });

    const subject = { id: counselor.id, institutionId: institution.id, role: "COUNSELOR" as const };

    await expect(
      resolvePermission(subject, "VIEW_REPORTS", { groupId: permittedGroup.id }),
    ).resolves.toBe(true);

    await expect(
      resolvePermission(subject, "VIEW_REPORTS", { groupId: otherGroup.id }),
    ).resolves.toBe(false);
  });

  it("lets a group-scoped ALLOW apply to a trainee only when the trainee belongs to that group", async () => {
    const institution = await createInstitution();
    const counselor = await createStaffUser({ institutionId: institution.id, role: "COUNSELOR" });
    await setRolePermission({
      institutionId: institution.id,
      role: "COUNSELOR",
      action: "VIEW_REPORTS",
      allowed: false,
    });
    const group = await createGroup(institution.id);
    const trainee = await createTrainee({ institutionId: institution.id, groupId: group.id });
    await setUserPermissionOverride({
      institutionId: institution.id,
      staffId: counselor.id,
      action: "VIEW_REPORTS",
      effect: "ALLOW",
      groupId: group.id,
    });

    const canView = await resolvePermission(
      { id: counselor.id, institutionId: institution.id, role: "COUNSELOR" },
      "VIEW_REPORTS",
      { traineeId: trainee.id, groupId: group.id },
    );

    expect(canView).toBe(true);
  });

  it("denies when a caller pairs a trainee with a different same-institution group", async () => {
    const institution = await createInstitution();
    const counselor = await createStaffUser({ institutionId: institution.id, role: "COUNSELOR" });
    await setRolePermission({
      institutionId: institution.id,
      role: "COUNSELOR",
      action: "VIEW_REPORTS",
      allowed: false,
    });
    const permittedGroup = await createGroup(institution.id, "Permitted Group");
    const traineeGroup = await createGroup(institution.id, "Trainee Group");
    const trainee = await createTrainee({ institutionId: institution.id, groupId: traineeGroup.id });
    await setUserPermissionOverride({
      institutionId: institution.id,
      staffId: counselor.id,
      action: "VIEW_REPORTS",
      effect: "ALLOW",
      groupId: permittedGroup.id,
    });

    const canView = await resolvePermission(
      { id: counselor.id, institutionId: institution.id, role: "COUNSELOR" },
      "VIEW_REPORTS",
      { traineeId: trainee.id, groupId: permittedGroup.id },
    );

    expect(canView).toBe(false);
  });

  it("lets a per-trainee DENY override win over a true role default", async () => {
    const institution = await createInstitution();
    const admin = await createStaffUser({ institutionId: institution.id, role: "ADMIN" });
    await setRolePermission({
      institutionId: institution.id,
      role: "ADMIN",
      action: "VIEW_REPORTS",
      allowed: true,
    });
    const restrictedTrainee = await createTrainee({ institutionId: institution.id });
    const otherTrainee = await createTrainee({ institutionId: institution.id });
    await setUserPermissionOverride({
      institutionId: institution.id,
      staffId: admin.id,
      action: "VIEW_REPORTS",
      effect: "DENY",
      traineeId: restrictedTrainee.id,
    });

    const subject = { id: admin.id, institutionId: institution.id, role: "ADMIN" as const };

    await expect(
      resolvePermission(subject, "VIEW_REPORTS", { traineeId: restrictedTrainee.id }),
    ).resolves.toBe(false);

    await expect(
      resolvePermission(subject, "VIEW_REPORTS", { traineeId: otherTrainee.id }),
    ).resolves.toBe(true);
  });

  it("resolves a tie between two same-specificity overrides in favor of DENY", async () => {
    const institution = await createInstitution();
    const counselor = await createStaffUser({ institutionId: institution.id, role: "COUNSELOR" });
    await setRolePermission({
      institutionId: institution.id,
      role: "COUNSELOR",
      action: "VIEW_REPORTS",
      allowed: false,
    });
    const group = await createGroup(institution.id);
    // Two conflicting overrides at the same (group) specificity for the same action —
    // an inconsistent state the schema doesn't prevent today. The tie must resolve to
    // the conservative outcome rather than depending on row-return order.
    await setUserPermissionOverride({
      institutionId: institution.id,
      staffId: counselor.id,
      action: "VIEW_REPORTS",
      effect: "ALLOW",
      groupId: group.id,
    });
    await setUserPermissionOverride({
      institutionId: institution.id,
      staffId: counselor.id,
      action: "VIEW_REPORTS",
      effect: "DENY",
      groupId: group.id,
    });

    const canView = await resolvePermission(
      { id: counselor.id, institutionId: institution.id, role: "COUNSELOR" },
      "VIEW_REPORTS",
      { groupId: group.id },
    );

    expect(canView).toBe(false);
  });

  it("does not let a malformed override with both groupId and traineeId grant access", async () => {
    const institution = await createInstitution();
    const counselor = await createStaffUser({ institutionId: institution.id, role: "COUNSELOR" });
    await setRolePermission({
      institutionId: institution.id,
      role: "COUNSELOR",
      action: "VIEW_REPORTS",
      allowed: false,
    });
    const group = await createGroup(institution.id);
    const trainee = await createTrainee({ institutionId: institution.id, groupId: group.id });
    await setUserPermissionOverride({
      institutionId: institution.id,
      staffId: counselor.id,
      action: "VIEW_REPORTS",
      effect: "ALLOW",
      groupId: group.id,
      traineeId: trainee.id,
    });

    const canView = await resolvePermission(
      { id: counselor.id, institutionId: institution.id, role: "COUNSELOR" },
      "VIEW_REPORTS",
      { traineeId: trainee.id, groupId: group.id },
    );

    expect(canView).toBe(false);
  });
});
