import { beforeEach, describe, expect, it } from "vitest";
import {
  getLatestStageProgramVersion,
  getPrimaryStageProgramVersion,
} from "@/repositories/stageProgramRepository";
import { ensureDefaultRolePermissions } from "@/services/permissions/rolePermissionDefaults";
import {
  publishInstitutionScoringProfile,
  publishGroupScoringProfile,
  publishTraineeScoringProfile,
  saveInstitutionScoringProfileDraft,
  saveGroupScoringProfileDraft,
  saveTraineeScoringProfileDraft,
  StageSettingsMutationError,
} from "@/services/stagePrograms/stageSettingsService";
import { transferManagedTraineeGroup } from "@/services/trainees/traineeService";
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

describe("stage settings service (real Postgres)", () => {
  it("uses only the currently effective published stage-program version", async () => {
    const institution = await createInstitution();
    const program = await testPrisma.stageProgram.create({
      data: { institutionId: institution.id, name: "Version Filter Program" },
    });
    const current = await testPrisma.stageProgramVersion.create({
      data: {
        stageProgramId: program.id,
        versionNumber: 2,
        status: "PUBLISHED",
        requiredMeasurementDays: 14,
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        effectiveTo: new Date("2026-12-31T00:00:00.000Z"),
      },
    });
    await testPrisma.stage.create({
      data: { stageProgramVersionId: current.id, order: 1, name: "Current stage" },
    });

    for (const version of [
      {
        versionNumber: 3,
        status: "DRAFT" as const,
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
      },
      {
        versionNumber: 4,
        status: "REPLACED" as const,
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
      },
      {
        versionNumber: 5,
        status: "PUBLISHED" as const,
        effectiveFrom: "2027-01-01",
        effectiveTo: null,
      },
      {
        versionNumber: 6,
        status: "PUBLISHED" as const,
        effectiveFrom: "2025-01-01",
        effectiveTo: "2026-01-01",
      },
    ]) {
      await testPrisma.stageProgramVersion.create({
        data: {
          stageProgramId: program.id,
          versionNumber: version.versionNumber,
          status: version.status,
          requiredMeasurementDays: 14,
          effectiveFrom: new Date(`${version.effectiveFrom}T00:00:00.000Z`),
          effectiveTo: version.effectiveTo
            ? new Date(`${version.effectiveTo}T00:00:00.000Z`)
            : null,
        },
      });
    }

    await expect(
      getLatestStageProgramVersion(program.id, new Date("2026-06-01T00:00:00.000Z")),
    ).resolves.toMatchObject({ id: current.id, versionNumber: 2 });
    await expect(
      getPrimaryStageProgramVersion(institution.id, new Date("2026-06-01T00:00:00.000Z")),
    ).resolves.toMatchObject({ id: current.id, versionNumber: 2 });
  });

  it("lets an admin save an unbalanced institutional scoring-profile draft", async () => {
    const institution = await createInstitution();
    const admin = await createStaffUser({ institutionId: institution.id, role: "ADMIN" });
    const { version, parameters } = await createStageProgramVersion({
      institutionId: institution.id,
    });
    await ensureDefaultRolePermissions(institution.id);

    const draft = await saveInstitutionScoringProfileDraft({
      actor: { id: admin.id, institutionId: institution.id, role: "ADMIN" },
      institutionId: institution.id,
      stageProgramVersionId: version.id,
      name: "Institution draft",
      parameters: [
        {
          sourceParameterDefinitionId: parameters[0].id,
          name: "Participation",
          scoreScale: "ONE_TO_TEN",
          weightPercent: 80,
          displayOrder: 2,
        },
        {
          sourceParameterDefinitionId: parameters[1].id,
          name: "Safety",
          scoreScale: "ONE_TO_THREE",
          weightPercent: 10,
          displayOrder: 1,
        },
      ],
    });

    expect(draft).toMatchObject({
      institutionId: institution.id,
      stageProgramVersionId: version.id,
      name: "Institution draft",
      status: "DRAFT",
      createdById: admin.id,
    });
    expect(draft.parameters.map((parameter) => parameter.name)).toEqual(["Safety", "Participation"]);
    expect(draft.parameters.map((parameter) => Number(parameter.weightPercent))).toEqual([10, 80]);

    await expect(
      testPrisma.settingsChangeLogEntry.findFirstOrThrow({
        where: { entityType: "ScoringProfile", entityId: draft.id },
      }),
    ).resolves.toMatchObject({
      institutionId: institution.id,
      changedById: admin.id,
      change: { action: "DRAFT_SAVE", parameterCount: 2, activeParameterCount: 2 },
    });
    await expect(
      testPrisma.auditLogEntry.findFirstOrThrow({
        where: {
          institutionId: institution.id,
          actorId: admin.id,
          action: "STAGE_SETTINGS.SCORING_PROFILE_DRAFT_SAVE",
        },
      }),
    ).resolves.toMatchObject({ metadata: { scoringProfileId: draft.id } });
  });

  it("denies stage settings writes without MANAGE_STAGE_SETTINGS", async () => {
    const institution = await createInstitution();
    const counselor = await createStaffUser({ institutionId: institution.id, role: "COUNSELOR" });
    const { version } = await createStageProgramVersion({ institutionId: institution.id });
    await ensureDefaultRolePermissions(institution.id);
    await setUserPermissionOverride({
      institutionId: institution.id,
      staffId: counselor.id,
      action: "EDIT_SETTINGS",
      effect: "ALLOW",
    });

    await expect(
      saveInstitutionScoringProfileDraft({
        actor: { id: counselor.id, institutionId: institution.id, role: "COUNSELOR" },
        institutionId: institution.id,
        stageProgramVersionId: version.id,
        parameters: [
          {
            name: "Blocked",
            scoreScale: "ONE_TO_TEN",
            weightPercent: 100,
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    } satisfies Partial<StageSettingsMutationError>);
  });

  it("requires balanced active weights before publishing and retains inactive parameters", async () => {
    const institution = await createInstitution();
    const admin = await createStaffUser({ institutionId: institution.id, role: "ADMIN" });
    const { version, parameters } = await createStageProgramVersion({
      institutionId: institution.id,
    });
    await ensureDefaultRolePermissions(institution.id);
    const actor = { id: admin.id, institutionId: institution.id, role: "ADMIN" as const };

    const draft = await saveInstitutionScoringProfileDraft({
      actor,
      institutionId: institution.id,
      stageProgramVersionId: version.id,
      parameters: [
        {
          sourceParameterDefinitionId: parameters[0].id,
          name: "Participation",
          scoreScale: "ONE_TO_TEN",
          weightPercent: 70,
        },
        {
          sourceParameterDefinitionId: parameters[1].id,
          name: "Safety",
          scoreScale: "ONE_TO_TEN",
          weightPercent: 20,
        },
      ],
    });

    await expect(
      publishInstitutionScoringProfile({
        actor,
        institutionId: institution.id,
        profileId: draft.id,
      }),
    ).rejects.toMatchObject({
      code: "WEIGHTS_UNBALANCED",
    } satisfies Partial<StageSettingsMutationError>);

    await saveInstitutionScoringProfileDraft({
      actor,
      institutionId: institution.id,
      stageProgramVersionId: version.id,
      profileId: draft.id,
      parameters: [
        {
          sourceParameterDefinitionId: parameters[0].id,
          name: "Participation",
          scoreScale: "ONE_TO_TEN",
          weightPercent: 60,
        },
        {
          sourceParameterDefinitionId: parameters[1].id,
          name: "Safety",
          scoreScale: "ONE_TO_TEN",
          weightPercent: 40,
        },
        {
          name: "Archived parameter",
          scoreScale: "ONE_TO_ONE_HUNDRED",
          weightPercent: 100,
          active: false,
        },
      ],
    });

    const published = await publishInstitutionScoringProfile({
      actor,
      institutionId: institution.id,
      profileId: draft.id,
      effectiveFrom: new Date("2026-08-01T09:30:00.000Z"),
    });

    expect(published).toMatchObject({
      id: draft.id,
      status: "PUBLISHED",
      publishedById: admin.id,
    });
    expect(published.effectiveFrom?.toISOString()).toBe("2026-08-01T09:30:00.000Z");
    expect(published.parameters).toHaveLength(3);
    expect(published.parameters.find((parameter) => parameter.name === "Archived parameter")).toMatchObject({
      active: false,
    });

    const publishLog = await testPrisma.settingsChangeLogEntry.findFirstOrThrow({
      where: { entityId: draft.id, change: { path: ["action"], equals: "PUBLISH" } },
    });
    expect(publishLog.change).toMatchObject({
      action: "PUBLISH",
      activeParameterCount: 2,
    });
    await expect(
      testPrisma.auditLogEntry.findFirstOrThrow({
        where: {
          institutionId: institution.id,
          actorId: admin.id,
          action: "STAGE_SETTINGS.SCORING_PROFILE_PUBLISH",
        },
      }),
    ).resolves.toMatchObject({ metadata: { scoringProfileId: draft.id } });

    await expect(
      saveInstitutionScoringProfileDraft({
        actor,
        institutionId: institution.id,
        stageProgramVersionId: version.id,
        profileId: draft.id,
        parameters: [
          {
            name: "Cannot edit published",
            scoreScale: "ONE_TO_TEN",
            weightPercent: 100,
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: "PROFILE_NOT_DRAFT",
    } satisfies Partial<StageSettingsMutationError>);
  });

  it("rejects parameter references from another stage-program version", async () => {
    const institutionA = await createInstitution("Institution A");
    const institutionB = await createInstitution("Institution B");
    const adminA = await createStaffUser({ institutionId: institutionA.id, role: "ADMIN" });
    const versionA = await createStageProgramVersion({ institutionId: institutionA.id });
    const versionB = await createStageProgramVersion({ institutionId: institutionB.id });
    await ensureDefaultRolePermissions(institutionA.id);

    await expect(
      saveInstitutionScoringProfileDraft({
        actor: { id: adminA.id, institutionId: institutionA.id, role: "ADMIN" },
        institutionId: institutionA.id,
        stageProgramVersionId: versionA.version.id,
        parameters: [
          {
            sourceParameterDefinitionId: versionB.parameters[0].id,
            stageId: versionB.stage.id,
            name: "Foreign reference",
            scoreScale: "ONE_TO_TEN",
            weightPercent: 100,
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: "PARAMETER_OUT_OF_SCOPE",
    } satisfies Partial<StageSettingsMutationError>);
  });

  it("rejects global plus stage-specific effective weights on profile publish", async () => {
    const institution = await createInstitution();
    const admin = await createStaffUser({ institutionId: institution.id, role: "ADMIN" });
    const group = await createGroup(institution.id, "Weight Guard Group");
    const trainee = await createTrainee({ institutionId: institution.id, groupId: group.id });
    const { version, stage, parameters } = await createStageProgramVersion({
      institutionId: institution.id,
      parameterWeights: [100],
    });
    await ensureDefaultRolePermissions(institution.id);
    const actor = { id: admin.id, institutionId: institution.id, role: "ADMIN" as const };

    const institutionDraft = await saveInstitutionScoringProfileDraft({
      actor,
      institutionId: institution.id,
      stageProgramVersionId: version.id,
      parameters: [
        {
          sourceParameterDefinitionId: parameters[0].id,
          name: "Global source",
          scoreScale: "ONE_TO_TEN",
          weightPercent: 100,
        },
        {
          stageId: stage.id,
          name: "Stage extra",
          scoreScale: "ONE_TO_TEN",
          weightPercent: 100,
        },
      ],
    });
    await expect(
      publishInstitutionScoringProfile({
        actor,
        institutionId: institution.id,
        profileId: institutionDraft.id,
      }),
    ).rejects.toMatchObject({
      code: "WEIGHTS_UNBALANCED",
    } satisfies Partial<StageSettingsMutationError>);

    const groupDraft = await saveGroupScoringProfileDraft({
      actor,
      institutionId: institution.id,
      groupId: group.id,
      stageProgramVersionId: version.id,
      parameters: [
        { sourceParameterDefinitionId: parameters[0].id },
        {
          stageId: stage.id,
          name: "Group stage extra",
          scoreScale: "ONE_TO_TEN",
          weightPercent: 100,
        },
      ],
    });
    await expect(
      publishGroupScoringProfile({
        actor,
        institutionId: institution.id,
        groupId: group.id,
        profileId: groupDraft.id,
      }),
    ).rejects.toMatchObject({
      code: "WEIGHTS_UNBALANCED",
    } satisfies Partial<StageSettingsMutationError>);

    const traineeDraft = await saveTraineeScoringProfileDraft({
      actor,
      institutionId: institution.id,
      traineeId: trainee.id,
      stageProgramVersionId: version.id,
      parameters: [
        { sourceParameterDefinitionId: parameters[0].id },
        {
          stageId: stage.id,
          name: "Trainee stage extra",
          scoreScale: "ONE_TO_TEN",
          weightPercent: 100,
        },
      ],
    });
    await expect(
      publishTraineeScoringProfile({
        actor,
        institutionId: institution.id,
        traineeId: trainee.id,
        profileId: traineeDraft.id,
      }),
    ).rejects.toMatchObject({
      code: "WEIGHTS_UNBALANCED",
    } satisfies Partial<StageSettingsMutationError>);
  });

  it("publishes group local profiles using null fields as inherited defaults", async () => {
    const institution = await createInstitution();
    const admin = await createStaffUser({ institutionId: institution.id, role: "ADMIN" });
    const group = await createGroup(institution.id, "Local Settings Group");
    const { version, parameters } = await createStageProgramVersion({
      institutionId: institution.id,
      parameterWeights: [50, 50],
    });
    await ensureDefaultRolePermissions(institution.id);
    const actor = { id: admin.id, institutionId: institution.id, role: "ADMIN" as const };

    const draft = await saveGroupScoringProfileDraft({
      actor,
      institutionId: institution.id,
      groupId: group.id,
      stageProgramVersionId: version.id,
      name: "Group local draft",
      parameters: [
        {
          sourceParameterDefinitionId: parameters[0].id,
          name: "Group-specific name",
          weightPercent: 70,
        },
        {
          sourceParameterDefinitionId: parameters[1].id,
        },
      ],
    });

    await expect(
      publishGroupScoringProfile({
        actor,
        institutionId: institution.id,
        groupId: group.id,
        profileId: draft.id,
      }),
    ).rejects.toMatchObject({
      code: "WEIGHTS_UNBALANCED",
    } satisfies Partial<StageSettingsMutationError>);

    const resetDraft = await saveGroupScoringProfileDraft({
      actor,
      institutionId: institution.id,
      groupId: group.id,
      stageProgramVersionId: version.id,
      profileId: draft.id,
      parameters: [
        {
          sourceParameterDefinitionId: parameters[0].id,
          name: "Group-specific name",
          weightPercent: null,
        },
        {
          sourceParameterDefinitionId: parameters[1].id,
        },
      ],
    });

    expect(resetDraft.parameters.map((parameter) => parameter.weightPercent)).toEqual([null, null]);
    expect(resetDraft.parameters[0]).toMatchObject({
      name: "Group-specific name",
      scoreScale: null,
    });

    const published = await publishGroupScoringProfile({
      actor,
      institutionId: institution.id,
      groupId: group.id,
      profileId: draft.id,
      effectiveFrom: new Date("2026-09-01T00:00:00.000Z"),
    });

    expect(published).toMatchObject({
      id: draft.id,
      institutionId: institution.id,
      groupId: group.id,
      traineeId: null,
      status: "PUBLISHED",
    });
    await expect(
      testPrisma.settingsChangeLogEntry.findFirstOrThrow({
        where: { entityId: draft.id, change: { path: ["action"], equals: "GROUP_PUBLISH" } },
      }),
    ).resolves.toMatchObject({ changedById: admin.id });
  });

  it("uses group-scoped MANAGE_GROUP_SETTINGS overrides for group local drafts", async () => {
    const institution = await createInstitution();
    const counselor = await createStaffUser({ institutionId: institution.id, role: "COUNSELOR" });
    const group = await createGroup(institution.id, "Scoped Group");
    const { version, parameters } = await createStageProgramVersion({
      institutionId: institution.id,
    });
    await ensureDefaultRolePermissions(institution.id);
    await setUserPermissionOverride({
      institutionId: institution.id,
      staffId: counselor.id,
      action: "MANAGE_GROUP_SETTINGS",
      effect: "ALLOW",
      groupId: group.id,
    });

    const draft = await saveGroupScoringProfileDraft({
      actor: { id: counselor.id, institutionId: institution.id, role: "COUNSELOR" },
      institutionId: institution.id,
      groupId: group.id,
      stageProgramVersionId: version.id,
      parameters: [
        { sourceParameterDefinitionId: parameters[0].id },
        { sourceParameterDefinitionId: parameters[1].id },
      ],
    });

    expect(draft.groupId).toBe(group.id);
  });

  it("keeps a trainee-level profile attached to the trainee after group transfer", async () => {
    const institution = await createInstitution();
    const admin = await createStaffUser({ institutionId: institution.id, role: "ADMIN" });
    const groupA = await createGroup(institution.id, "Group A");
    const groupB = await createGroup(institution.id, "Group B");
    const trainee = await createTrainee({ institutionId: institution.id, groupId: groupA.id });
    const { version, parameters } = await createStageProgramVersion({
      institutionId: institution.id,
    });
    await ensureDefaultRolePermissions(institution.id);
    const actor = { id: admin.id, institutionId: institution.id, role: "ADMIN" as const };

    const draft = await saveTraineeScoringProfileDraft({
      actor,
      institutionId: institution.id,
      traineeId: trainee.id,
      stageProgramVersionId: version.id,
      parameters: [
        { sourceParameterDefinitionId: parameters[0].id },
        { sourceParameterDefinitionId: parameters[1].id },
      ],
    });
    await publishTraineeScoringProfile({
      actor,
      institutionId: institution.id,
      traineeId: trainee.id,
      profileId: draft.id,
    });

    await transferManagedTraineeGroup({
      actor,
      institutionId: institution.id,
      traineeId: trainee.id,
      toGroupId: groupB.id,
      effectiveFrom: new Date("2026-06-12T00:00:00.000Z"),
    });

    const profileAfterTransfer = await testPrisma.scoringProfile.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(profileAfterTransfer).toMatchObject({
      traineeId: trainee.id,
      groupId: null,
      status: "PUBLISHED",
    });
    await expect(
      testPrisma.trainee.findUniqueOrThrow({ where: { id: trainee.id } }),
    ).resolves.toMatchObject({ groupId: groupB.id });
  });

  it("uses trainee current group scope for MANAGE_TRAINEE_SETTINGS overrides", async () => {
    const institution = await createInstitution();
    const counselor = await createStaffUser({ institutionId: institution.id, role: "COUNSELOR" });
    const group = await createGroup(institution.id, "Trainee Settings Group");
    const trainee = await createTrainee({ institutionId: institution.id, groupId: group.id });
    const { version, parameters } = await createStageProgramVersion({
      institutionId: institution.id,
    });
    await ensureDefaultRolePermissions(institution.id);
    await setUserPermissionOverride({
      institutionId: institution.id,
      staffId: counselor.id,
      action: "MANAGE_TRAINEE_SETTINGS",
      effect: "ALLOW",
      groupId: group.id,
    });

    const draft = await saveTraineeScoringProfileDraft({
      actor: { id: counselor.id, institutionId: institution.id, role: "COUNSELOR" },
      institutionId: institution.id,
      traineeId: trainee.id,
      stageProgramVersionId: version.id,
      parameters: [
        { sourceParameterDefinitionId: parameters[0].id },
        { sourceParameterDefinitionId: parameters[1].id },
      ],
    });

    expect(draft).toMatchObject({
      traineeId: trainee.id,
      groupId: null,
      status: "DRAFT",
    });
  });
});
