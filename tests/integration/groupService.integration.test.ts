import { beforeEach, describe, expect, it } from "vitest";
import { getGroupById, listGroupsByInstitution } from "@/repositories/groupRepository";
import {
  createManagedGroup,
  GroupMutationError,
  updateManagedGroup,
} from "@/services/groups/groupService";
import { ensureDefaultRolePermissions } from "@/services/permissions/rolePermissionDefaults";
import {
  createGroup,
  createInstitution,
  createStaffUser,
  resetDatabase,
  setUserPermissionOverride,
  testPrisma,
} from "./db";

beforeEach(async () => {
  await resetDatabase();
});

describe("group management service (real Postgres)", () => {
  it("lets an admin create a group with description and staff assignments", async () => {
    const institution = await createInstitution();
    const admin = await createStaffUser({ institutionId: institution.id, role: "ADMIN" });
    const counselor = await createStaffUser({ institutionId: institution.id, role: "COUNSELOR" });
    await ensureDefaultRolePermissions(institution.id);

    const group = await createManagedGroup({
      actor: { id: admin.id, institutionId: institution.id, role: "ADMIN" },
      institutionId: institution.id,
      name: "  קבוצת ארז  ",
      description: "  שכבת ט  ",
      staffIds: [counselor.id, counselor.id],
    });

    expect(group).toMatchObject({
      institutionId: institution.id,
      name: "קבוצת ארז",
      description: "שכבת ט",
      active: true,
    });

    const assignments = await testPrisma.groupStaffAssignment.findMany({
      where: { groupId: group.id },
    });
    expect(assignments).toHaveLength(1);
    expect(assignments[0]?.staffId).toBe(counselor.id);
  });

  it("denies group creation to a non-admin role without MANAGE_GROUPS", async () => {
    const institution = await createInstitution();
    const lead = await createStaffUser({
      institutionId: institution.id,
      role: "LEAD_COORDINATOR",
    });
    await ensureDefaultRolePermissions(institution.id);

    await expect(
      createManagedGroup({
        actor: { id: lead.id, institutionId: institution.id, role: "LEAD_COORDINATOR" },
        institutionId: institution.id,
        name: "קבוצה חסומה",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    } satisfies Partial<GroupMutationError>);
  });

  it("lets a user override grant MANAGE_GROUPS for creation", async () => {
    const institution = await createInstitution();
    const counselor = await createStaffUser({ institutionId: institution.id, role: "COUNSELOR" });
    await ensureDefaultRolePermissions(institution.id);
    await setUserPermissionOverride({
      institutionId: institution.id,
      staffId: counselor.id,
      action: "MANAGE_GROUPS",
      effect: "ALLOW",
    });

    const group = await createManagedGroup({
      actor: { id: counselor.id, institutionId: institution.id, role: "COUNSELOR" },
      institutionId: institution.id,
      name: "קבוצה בהרשאה אישית",
    });

    expect(group.name).toBe("קבוצה בהרשאה אישית");
  });

  it("lets an admin edit and archive a group without deleting group history access", async () => {
    const institution = await createInstitution();
    const admin = await createStaffUser({ institutionId: institution.id, role: "ADMIN" });
    const staffBefore = await createStaffUser({ institutionId: institution.id, role: "COUNSELOR" });
    const staffAfter = await createStaffUser({ institutionId: institution.id, role: "COUNSELOR" });
    await ensureDefaultRolePermissions(institution.id);
    const group = await createManagedGroup({
      actor: { id: admin.id, institutionId: institution.id, role: "ADMIN" },
      institutionId: institution.id,
      name: "קבוצה פעילה",
      staffIds: [staffBefore.id],
    });

    const updated = await updateManagedGroup({
      actor: { id: admin.id, institutionId: institution.id, role: "ADMIN" },
      institutionId: institution.id,
      groupId: group.id,
      name: "קבוצה בארכיון",
      description: "",
      active: false,
      staffIds: [staffAfter.id],
    });

    expect(updated).toMatchObject({
      id: group.id,
      name: "קבוצה בארכיון",
      description: null,
      active: false,
    });
    await expect(listGroupsByInstitution(institution.id)).resolves.toEqual([]);
    await expect(listGroupsByInstitution(institution.id, { includeInactive: true })).resolves.toEqual(
      [expect.objectContaining({ id: group.id, active: false })],
    );
    await expect(getGroupById(group.id)).resolves.toMatchObject({ id: group.id, active: false });

    const assignments = await testPrisma.groupStaffAssignment.findMany({
      where: { groupId: group.id },
    });
    expect(assignments.map((assignment) => assignment.staffId)).toEqual([staffAfter.id]);
  });

  it("rejects staff assignments from a different institution", async () => {
    const institutionA = await createInstitution("Institution A");
    const institutionB = await createInstitution("Institution B");
    const adminA = await createStaffUser({ institutionId: institutionA.id, role: "ADMIN" });
    const foreignStaff = await createStaffUser({ institutionId: institutionB.id, role: "COUNSELOR" });
    await ensureDefaultRolePermissions(institutionA.id);

    await expect(
      createManagedGroup({
        actor: { id: adminA.id, institutionId: institutionA.id, role: "ADMIN" },
        institutionId: institutionA.id,
        name: "קבוצה עם צוות זר",
        staffIds: [foreignStaff.id],
      }),
    ).rejects.toMatchObject({
      code: "STAFF_OUT_OF_SCOPE",
    } satisfies Partial<GroupMutationError>);
  });

  it("does not update a group from another institution", async () => {
    const institutionA = await createInstitution("Institution A");
    const institutionB = await createInstitution("Institution B");
    const adminA = await createStaffUser({ institutionId: institutionA.id, role: "ADMIN" });
    const groupB = await createGroup(institutionB.id);
    await ensureDefaultRolePermissions(institutionA.id);

    await expect(
      updateManagedGroup({
        actor: { id: adminA.id, institutionId: institutionA.id, role: "ADMIN" },
        institutionId: institutionA.id,
        groupId: groupB.id,
        name: "שם שלא אמור להישמר",
      }),
    ).rejects.toMatchObject({
      code: "GROUP_NOT_FOUND",
    } satisfies Partial<GroupMutationError>);
  });
});
