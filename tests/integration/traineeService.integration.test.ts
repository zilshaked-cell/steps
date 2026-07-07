import { beforeEach, describe, expect, it } from "vitest";
import { ensureDefaultRolePermissions } from "@/services/permissions/rolePermissionDefaults";
import {
  createManagedTrainee,
  getTraineeGroupIdAtMeasurementDate,
  TraineeMutationError,
  transferManagedTraineeGroup,
  updateManagedTrainee,
} from "@/services/trainees/traineeService";
import {
  createGroup,
  createInstitution,
  createStaffUser,
  createStageProgramVersion,
  createTrainee,
  resetDatabase,
  setUserPermissionOverride,
  testPrisma,
} from "./db";

beforeEach(async () => {
  await resetDatabase();
});

describe("trainee management service (real Postgres)", () => {
  it("lets an admin create a STANDARD trainee and records initial group history", async () => {
    const institution = await createInstitution();
    const admin = await createStaffUser({ institutionId: institution.id, role: "ADMIN" });
    const group = await createGroup(institution.id, "Group A");
    const { stage } = await createStageProgramVersion({ institutionId: institution.id });
    await ensureDefaultRolePermissions(institution.id);

    const trainee = await createManagedTrainee({
      actor: { id: admin.id, institutionId: institution.id, role: "ADMIN" },
      institutionId: institution.id,
      groupId: group.id,
      firstName: "  Dana  ",
      lastName: "  Cohen  ",
      currentStageId: stage.id,
      effectiveFrom: new Date("2026-03-02T13:45:00.000Z"),
    });

    expect(trainee).toMatchObject({
      institutionId: institution.id,
      groupId: group.id,
      firstName: "Dana",
      lastName: "Cohen",
      measurementMode: "STANDARD",
      currentStageId: stage.id,
    });

    const history = await testPrisma.traineeGroupMembershipHistory.findMany({
      where: { traineeId: trainee.id },
    });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      institutionId: institution.id,
      traineeId: trainee.id,
      fromGroupId: null,
      toGroupId: group.id,
      movedById: admin.id,
      note: "Initial trainee group assignment",
    });
    expect(history[0]?.effectiveFrom.toISOString()).toBe("2026-03-02T00:00:00.000Z");
  });

  it("uses group-scoped MANAGE_TRAINEES overrides for create and edit", async () => {
    const institution = await createInstitution();
    const counselor = await createStaffUser({ institutionId: institution.id, role: "COUNSELOR" });
    const group = await createGroup(institution.id, "Group A");
    await ensureDefaultRolePermissions(institution.id);
    await setUserPermissionOverride({
      institutionId: institution.id,
      staffId: counselor.id,
      action: "MANAGE_TRAINEES",
      effect: "ALLOW",
      groupId: group.id,
    });

    const actor = { id: counselor.id, institutionId: institution.id, role: "COUNSELOR" as const };
    const trainee = await createManagedTrainee({
      actor,
      institutionId: institution.id,
      groupId: group.id,
      firstName: "Ari",
      lastName: "Levi",
    });

    const updated = await updateManagedTrainee({
      actor,
      institutionId: institution.id,
      traineeId: trainee.id,
      firstName: "Ariel",
      lastName: "Levy",
      active: false,
    });

    expect(updated).toMatchObject({
      id: trainee.id,
      firstName: "Ariel",
      lastName: "Levy",
      active: false,
    });
  });

  it("denies trainee creation without MANAGE_TRAINEES even when EDIT is allowed", async () => {
    const institution = await createInstitution();
    const counselor = await createStaffUser({ institutionId: institution.id, role: "COUNSELOR" });
    const group = await createGroup(institution.id, "Group A");
    await ensureDefaultRolePermissions(institution.id);
    await setUserPermissionOverride({
      institutionId: institution.id,
      staffId: counselor.id,
      action: "EDIT",
      effect: "ALLOW",
      groupId: group.id,
    });

    await expect(
      createManagedTrainee({
        actor: { id: counselor.id, institutionId: institution.id, role: "COUNSELOR" },
        institutionId: institution.id,
        groupId: group.id,
        firstName: "Blocked",
        lastName: "Trainee",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    } satisfies Partial<TraineeMutationError>);
  });

  it("rejects inactive groups and current stages from another institution", async () => {
    const institutionA = await createInstitution("Institution A");
    const institutionB = await createInstitution("Institution B");
    const adminA = await createStaffUser({ institutionId: institutionA.id, role: "ADMIN" });
    const inactiveGroup = await createGroup(institutionA.id, "Inactive Group");
    const activeGroup = await createGroup(institutionA.id, "Active Group");
    const foreignStageData = await createStageProgramVersion({ institutionId: institutionB.id });
    await ensureDefaultRolePermissions(institutionA.id);
    await testPrisma.group.update({
      where: { id: inactiveGroup.id },
      data: { active: false },
    });

    const actor = { id: adminA.id, institutionId: institutionA.id, role: "ADMIN" as const };

    await expect(
      createManagedTrainee({
        actor,
        institutionId: institutionA.id,
        groupId: inactiveGroup.id,
        firstName: "Inactive",
        lastName: "Group",
      }),
    ).rejects.toMatchObject({
      code: "GROUP_INACTIVE",
    } satisfies Partial<TraineeMutationError>);

    await expect(
      createManagedTrainee({
        actor,
        institutionId: institutionA.id,
        groupId: activeGroup.id,
        firstName: "Foreign",
        lastName: "Stage",
        currentStageId: foreignStageData.stage.id,
      }),
    ).rejects.toMatchObject({
      code: "STAGE_NOT_FOUND",
    } satisfies Partial<TraineeMutationError>);
  });

  it("rejects same-institution stages from non-current stage-program versions", async () => {
    const institution = await createInstitution();
    const admin = await createStaffUser({ institutionId: institution.id, role: "ADMIN" });
    const group = await createGroup(institution.id, "Active Group");
    const { program, stage: currentStage } = await createStageProgramVersion({
      institutionId: institution.id,
    });
    const draftVersion = await testPrisma.stageProgramVersion.create({
      data: {
        stageProgramId: program.id,
        versionNumber: 2,
        status: "DRAFT",
        requiredMeasurementDays: 14,
      },
    });
    const replacedVersion = await testPrisma.stageProgramVersion.create({
      data: {
        stageProgramId: program.id,
        versionNumber: 3,
        status: "REPLACED",
        requiredMeasurementDays: 14,
      },
    });
    const draftStage = await testPrisma.stage.create({
      data: { stageProgramVersionId: draftVersion.id, order: 1, name: "Draft stage" },
    });
    const replacedStage = await testPrisma.stage.create({
      data: { stageProgramVersionId: replacedVersion.id, order: 1, name: "Replaced stage" },
    });
    await ensureDefaultRolePermissions(institution.id);
    const actor = { id: admin.id, institutionId: institution.id, role: "ADMIN" as const };

    await expect(
      createManagedTrainee({
        actor,
        institutionId: institution.id,
        groupId: group.id,
        firstName: "Draft",
        lastName: "Stage",
        currentStageId: draftStage.id,
      }),
    ).rejects.toMatchObject({
      code: "STAGE_NOT_FOUND",
    } satisfies Partial<TraineeMutationError>);

    const trainee = await createManagedTrainee({
      actor,
      institutionId: institution.id,
      groupId: group.id,
      firstName: "Current",
      lastName: "Stage",
      currentStageId: currentStage.id,
    });

    await expect(
      updateManagedTrainee({
        actor,
        institutionId: institution.id,
        traineeId: trainee.id,
        currentStageId: replacedStage.id,
      }),
    ).rejects.toMatchObject({
      code: "STAGE_NOT_FOUND",
    } satisfies Partial<TraineeMutationError>);
  });

  it("transfers a trainee between active groups with history", async () => {
    const institution = await createInstitution();
    const admin = await createStaffUser({ institutionId: institution.id, role: "ADMIN" });
    const fromGroup = await createGroup(institution.id, "From Group");
    const toGroup = await createGroup(institution.id, "To Group");
    const trainee = await createTrainee({ institutionId: institution.id, groupId: fromGroup.id });
    await ensureDefaultRolePermissions(institution.id);

    const transferred = await transferManagedTraineeGroup({
      actor: { id: admin.id, institutionId: institution.id, role: "ADMIN" },
      institutionId: institution.id,
      traineeId: trainee.id,
      toGroupId: toGroup.id,
      effectiveFrom: new Date("2026-04-12T16:20:00.000Z"),
      note: "  moved after review  ",
    });

    expect(transferred.groupId).toBe(toGroup.id);

    const history = await testPrisma.traineeGroupMembershipHistory.findMany({
      where: { traineeId: trainee.id },
    });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      institutionId: institution.id,
      traineeId: trainee.id,
      fromGroupId: fromGroup.id,
      toGroupId: toGroup.id,
      movedById: admin.id,
      note: "moved after review",
    });
    expect(history[0]?.effectiveFrom.toISOString()).toBe("2026-04-12T00:00:00.000Z");
  });

  it("uses group-scoped TRANSFER_TRAINEES overrides for source and target groups", async () => {
    const institution = await createInstitution();
    const counselor = await createStaffUser({ institutionId: institution.id, role: "COUNSELOR" });
    const fromGroup = await createGroup(institution.id, "From Group");
    const toGroup = await createGroup(institution.id, "To Group");
    const trainee = await createTrainee({ institutionId: institution.id, groupId: fromGroup.id });
    await ensureDefaultRolePermissions(institution.id);
    for (const groupId of [fromGroup.id, toGroup.id]) {
      await setUserPermissionOverride({
        institutionId: institution.id,
        staffId: counselor.id,
        action: "TRANSFER_TRAINEES",
        effect: "ALLOW",
        groupId,
      });
    }

    const transferred = await transferManagedTraineeGroup({
      actor: { id: counselor.id, institutionId: institution.id, role: "COUNSELOR" },
      institutionId: institution.id,
      traineeId: trainee.id,
      toGroupId: toGroup.id,
      effectiveFrom: new Date("2026-05-01T00:00:00.000Z"),
    });

    expect(transferred.groupId).toBe(toGroup.id);
  });

  it("rejects future-dated transfers without changing the current group", async () => {
    const institution = await createInstitution();
    const admin = await createStaffUser({ institutionId: institution.id, role: "ADMIN" });
    const fromGroup = await createGroup(institution.id, "From Group");
    const toGroup = await createGroup(institution.id, "To Group");
    const trainee = await createTrainee({ institutionId: institution.id, groupId: fromGroup.id });
    await ensureDefaultRolePermissions(institution.id);

    await expect(
      transferManagedTraineeGroup({
        actor: { id: admin.id, institutionId: institution.id, role: "ADMIN" },
        institutionId: institution.id,
        traineeId: trainee.id,
        toGroupId: toGroup.id,
        effectiveFrom: new Date("2999-01-01T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({
      code: "INVALID_DATE",
    } satisfies Partial<TraineeMutationError>);

    await expect(
      testPrisma.trainee.findUniqueOrThrow({ where: { id: trainee.id } }),
    ).resolves.toMatchObject({ groupId: fromGroup.id });
    await expect(
      testPrisma.traineeGroupMembershipHistory.count({ where: { traineeId: trainee.id } }),
    ).resolves.toBe(0);
  });

  it("rejects transfers without TRANSFER_TRAINEES or into inactive groups", async () => {
    const institution = await createInstitution();
    const counselor = await createStaffUser({ institutionId: institution.id, role: "COUNSELOR" });
    const admin = await createStaffUser({ institutionId: institution.id, role: "ADMIN" });
    const fromGroup = await createGroup(institution.id, "From Group");
    const activeTarget = await createGroup(institution.id, "Active Target");
    const inactiveTarget = await createGroup(institution.id, "Inactive Target");
    const trainee = await createTrainee({ institutionId: institution.id, groupId: fromGroup.id });
    await ensureDefaultRolePermissions(institution.id);
    await testPrisma.group.update({
      where: { id: inactiveTarget.id },
      data: { active: false },
    });

    await expect(
      transferManagedTraineeGroup({
        actor: { id: counselor.id, institutionId: institution.id, role: "COUNSELOR" },
        institutionId: institution.id,
        traineeId: trainee.id,
        toGroupId: activeTarget.id,
        effectiveFrom: new Date("2026-05-02T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    } satisfies Partial<TraineeMutationError>);

    await expect(
      transferManagedTraineeGroup({
        actor: { id: admin.id, institutionId: institution.id, role: "ADMIN" },
        institutionId: institution.id,
        traineeId: trainee.id,
        toGroupId: inactiveTarget.id,
        effectiveFrom: new Date("2026-05-02T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({
      code: "GROUP_INACTIVE",
    } satisfies Partial<TraineeMutationError>);
  });

  it("locates the historical group by measurement date", async () => {
    const institution = await createInstitution();
    const admin = await createStaffUser({ institutionId: institution.id, role: "ADMIN" });
    const groupA = await createGroup(institution.id, "Group A");
    const groupB = await createGroup(institution.id, "Group B");
    const trainee = await createTrainee({ institutionId: institution.id, groupId: groupB.id });

    await testPrisma.traineeGroupMembershipHistory.createMany({
      data: [
        {
          institutionId: institution.id,
          traineeId: trainee.id,
          toGroupId: groupA.id,
          effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
          movedById: admin.id,
          note: "initial",
        },
        {
          institutionId: institution.id,
          traineeId: trainee.id,
          fromGroupId: groupA.id,
          toGroupId: groupB.id,
          effectiveFrom: new Date("2026-02-10T00:00:00.000Z"),
          movedById: admin.id,
          note: "transfer",
        },
      ],
    });

    await expect(
      getTraineeGroupIdAtMeasurementDate({
        institutionId: institution.id,
        traineeId: trainee.id,
        measurementDate: new Date("2026-02-09T20:00:00.000Z"),
      }),
    ).resolves.toBe(groupA.id);
    await expect(
      getTraineeGroupIdAtMeasurementDate({
        institutionId: institution.id,
        traineeId: trainee.id,
        measurementDate: new Date("2026-02-10T20:00:00.000Z"),
      }),
    ).resolves.toBe(groupB.id);
  });
});
