import { beforeEach, describe, expect, it } from "vitest";
import { buildTraineeFitReport } from "@/services/stagePrograms/fitReport";
import { ensureDefaultRolePermissions } from "@/services/permissions/rolePermissionDefaults";
import {
  publishInstitutionScoringProfile,
  saveInstitutionScoringProfileDraft,
} from "@/services/stagePrograms/stageSettingsService";
import {
  getTraineeReportFormData,
  publishTraineeReport,
  ReportMutationError,
  saveTraineeReportDraft,
} from "@/services/reports/reportService";
import {
  createGroup,
  createInstitution,
  createScoreEntry,
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

function today(): Date {
  return new Date();
}

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

describe("report service (real Postgres)", () => {
  it("rejects draft saves that would replace currently visible standalone score data", async () => {
    const institution = await createInstitution();
    const admin = await createStaffUser({ institutionId: institution.id, role: "ADMIN" });
    const group = await createGroup(institution.id);
    const trainee = await createTrainee({ institutionId: institution.id, groupId: group.id });
    const { parameters } = await createStageProgramVersion({
      institutionId: institution.id,
      parameterWeights: [100],
    });
    await ensureDefaultRolePermissions(institution.id);
    const actor = { id: admin.id, institutionId: institution.id, role: "ADMIN" as const };
    const measurementDate = today();

    await createScoreEntry({
      traineeId: trainee.id,
      parameterDefinitionId: parameters[0].id,
      measurementDate,
      status: "SCORED",
      rawScore: 7,
      recordedById: admin.id,
    });

    await expect(
      saveTraineeReportDraft({
        actor,
        institutionId: institution.id,
        traineeId: trainee.id,
        measurementDate,
        entries: [
          {
            parameterDefinitionId: parameters[0].id,
            status: "SCORED",
            rawScore: 10,
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: "REPORT_CONFLICT",
    } satisfies Partial<ReportMutationError>);

    await expect(buildTraineeFitReport(trainee.id, institution.id)).resolves.toMatchObject({
      mostRecentScore: { totalScore: 70 },
    });
    await expect(testPrisma.measurementReport.count()).resolves.toBe(0);
    await expect(testPrisma.scoreEntry.count()).resolves.toBe(1);
  });

  it("keeps draft report entries out of fit-report scores until publish", async () => {
    const institution = await createInstitution();
    const admin = await createStaffUser({ institutionId: institution.id, role: "ADMIN" });
    const group = await createGroup(institution.id);
    const trainee = await createTrainee({ institutionId: institution.id, groupId: group.id });
    const { parameters } = await createStageProgramVersion({
      institutionId: institution.id,
      parameterWeights: [100],
    });
    await ensureDefaultRolePermissions(institution.id);
    const actor = { id: admin.id, institutionId: institution.id, role: "ADMIN" as const };
    const measurementDate = today();

    const draft = await saveTraineeReportDraft({
      actor,
      institutionId: institution.id,
      traineeId: trainee.id,
      measurementDate,
      note: "  partial note  ",
      entries: [
        {
          parameterDefinitionId: parameters[0].id,
          status: "SCORED",
          rawScore: 10,
        },
      ],
    });

    expect(draft).toMatchObject({
      institutionId: institution.id,
      traineeId: trainee.id,
      groupId: group.id,
      status: "DRAFT",
      note: "partial note",
    });
    expect(draft.scoreEntries).toHaveLength(1);
    await expect(buildTraineeFitReport(trainee.id, institution.id)).resolves.toMatchObject({
      dailyScores: [],
    });

    const published = await publishTraineeReport({
      actor,
      institutionId: institution.id,
      traineeId: trainee.id,
      measurementDate,
      note: "published",
      entries: [
        {
          parameterDefinitionId: parameters[0].id,
          status: "SCORED",
          rawScore: 10,
        },
      ],
    });

    expect(published).toMatchObject({
      id: draft.id,
      status: "PUBLISHED",
      publishedById: admin.id,
      note: "published",
    });
    const report = await buildTraineeFitReport(trainee.id, institution.id);
    expect(report?.mostRecentScore?.totalScore).toBeCloseTo(100);
  });

  it("loads report form data with existing draft entries and vacation marking", async () => {
    const institution = await createInstitution();
    const admin = await createStaffUser({ institutionId: institution.id, role: "ADMIN" });
    const group = await createGroup(institution.id);
    const trainee = await createTrainee({ institutionId: institution.id, groupId: group.id });
    const { parameters } = await createStageProgramVersion({
      institutionId: institution.id,
      parameterWeights: [100],
    });
    await ensureDefaultRolePermissions(institution.id);
    const actor = { id: admin.id, institutionId: institution.id, role: "ADMIN" as const };
    const measurementDate = today();

    await testPrisma.vacationPeriod.create({
      data: {
        institutionId: institution.id,
        groupId: group.id,
        title: "Group vacation",
        startsOn: measurementDate,
        endsOn: measurementDate,
        createdById: admin.id,
      },
    });
    const draft = await saveTraineeReportDraft({
      actor,
      institutionId: institution.id,
      traineeId: trainee.id,
      measurementDate,
      note: "draft note",
      entries: [
        {
          parameterDefinitionId: parameters[0].id,
          status: "SCORED",
          rawScore: 6,
        },
      ],
    });

    await expect(
      getTraineeReportFormData({
        institutionId: institution.id,
        traineeId: trainee.id,
        measurementDate,
      }),
    ).resolves.toMatchObject({
      traineeId: trainee.id,
      groupId: group.id,
      isVacationDay: true,
      existingReport: {
        id: draft.id,
        status: "DRAFT",
        note: "draft note",
      },
      parameters: [
        {
          parameterDefinitionId: parameters[0].id,
          scoringProfileParameterId: null,
          name: parameters[0].name,
          maxRawScore: 10,
          status: "SCORED",
          rawScore: 6,
        },
      ],
    });
  });

  it("validates report scores against the published scoring profile scale", async () => {
    const institution = await createInstitution();
    const admin = await createStaffUser({ institutionId: institution.id, role: "ADMIN" });
    const group = await createGroup(institution.id);
    const trainee = await createTrainee({ institutionId: institution.id, groupId: group.id });
    const { version, parameters } = await createStageProgramVersion({
      institutionId: institution.id,
      parameterWeights: [100],
    });
    await ensureDefaultRolePermissions(institution.id);
    const actor = { id: admin.id, institutionId: institution.id, role: "ADMIN" as const };

    const draftProfile = await saveInstitutionScoringProfileDraft({
      actor,
      institutionId: institution.id,
      stageProgramVersionId: version.id,
      parameters: [
        {
          sourceParameterDefinitionId: parameters[0].id,
          name: "Profile parameter",
          scoreScale: "ONE_TO_THREE",
          weightPercent: 100,
        },
      ],
    });
    const publishedProfile = await publishInstitutionScoringProfile({
      actor,
      institutionId: institution.id,
      profileId: draftProfile.id,
      effectiveFrom: daysFromNow(-1),
    });
    const profileParameter = publishedProfile.parameters[0];

    await expect(
      publishTraineeReport({
        actor,
        institutionId: institution.id,
        traineeId: trainee.id,
        measurementDate: today(),
        entries: [
          {
            scoringProfileParameterId: profileParameter.id,
            status: "SCORED",
            rawScore: 4,
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: "SCORE_OUT_OF_RANGE",
    } satisfies Partial<ReportMutationError>);

    const report = await publishTraineeReport({
      actor,
      institutionId: institution.id,
      traineeId: trainee.id,
      measurementDate: today(),
      entries: [
        {
          scoringProfileParameterId: profileParameter.id,
          status: "SCORED",
          rawScore: 3,
        },
      ],
    });

    expect(report).toMatchObject({
      scoringProfileId: publishedProfile.id,
      status: "PUBLISHED",
    });
    expect(report.scoreEntries[0]).toMatchObject({
      scoringProfileParameterId: profileParameter.id,
      parameterDefinitionId: null,
      rawScore: 3,
    });
    const fitReport = await buildTraineeFitReport(trainee.id, institution.id);
    expect(fitReport?.mostRecentScore?.totalScore).toBeCloseTo(100);
  });

  it("requires EDIT_REPORTS before changing an already published report", async () => {
    const institution = await createInstitution();
    const counselor = await createStaffUser({ institutionId: institution.id, role: "COUNSELOR" });
    const group = await createGroup(institution.id);
    const trainee = await createTrainee({ institutionId: institution.id, groupId: group.id });
    const { parameters } = await createStageProgramVersion({
      institutionId: institution.id,
      parameterWeights: [100],
    });
    await ensureDefaultRolePermissions(institution.id);
    await setUserPermissionOverride({
      institutionId: institution.id,
      staffId: counselor.id,
      action: "ENTER_REPORTS",
      effect: "ALLOW",
      groupId: group.id,
    });
    const actor = {
      id: counselor.id,
      institutionId: institution.id,
      role: "COUNSELOR" as const,
    };
    const measurementDate = today();

    await publishTraineeReport({
      actor,
      institutionId: institution.id,
      traineeId: trainee.id,
      measurementDate,
      entries: [
        {
          parameterDefinitionId: parameters[0].id,
          status: "SCORED",
          rawScore: 7,
        },
      ],
    });

    await expect(
      publishTraineeReport({
        actor,
        institutionId: institution.id,
        traineeId: trainee.id,
        measurementDate,
        entries: [
          {
            parameterDefinitionId: parameters[0].id,
            status: "SCORED",
            rawScore: 5,
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    } satisfies Partial<ReportMutationError>);

    await setUserPermissionOverride({
      institutionId: institution.id,
      staffId: counselor.id,
      action: "EDIT_REPORTS",
      effect: "ALLOW",
      groupId: group.id,
    });
    const edited = await publishTraineeReport({
      actor,
      institutionId: institution.id,
      traineeId: trainee.id,
      measurementDate,
      entries: [
        {
          parameterDefinitionId: parameters[0].id,
          status: "SCORED",
          rawScore: 5,
        },
      ],
    });

    expect(edited.scoreEntries[0]?.rawScore).toBe(5);
    await expect(
      testPrisma.auditLogEntry.findFirstOrThrow({
        where: { action: "REPORT.PUBLISHED_EDIT", actorId: counselor.id },
      }),
    ).resolves.toMatchObject({
      metadata: { reportId: edited.id, traineeId: trainee.id },
    });
  });

  it("keeps published report pins when editing after newer settings exist", async () => {
    const institution = await createInstitution();
    const admin = await createStaffUser({ institutionId: institution.id, role: "ADMIN" });
    const group = await createGroup(institution.id);
    const trainee = await createTrainee({ institutionId: institution.id, groupId: group.id });
    const { version, parameters } = await createStageProgramVersion({
      institutionId: institution.id,
      parameterWeights: [100],
    });
    await ensureDefaultRolePermissions(institution.id);
    const actor = { id: admin.id, institutionId: institution.id, role: "ADMIN" as const };
    const measurementDate = today();

    const original = await publishTraineeReport({
      actor,
      institutionId: institution.id,
      traineeId: trainee.id,
      measurementDate,
      entries: [
        {
          parameterDefinitionId: parameters[0].id,
          status: "SCORED",
          rawScore: 8,
        },
      ],
    });
    expect(original).toMatchObject({
      stageProgramVersionId: version.id,
      scoringProfileId: null,
    });

    const draftProfile = await saveInstitutionScoringProfileDraft({
      actor,
      institutionId: institution.id,
      stageProgramVersionId: version.id,
      parameters: [
        {
          sourceParameterDefinitionId: parameters[0].id,
          name: "New profile parameter",
          scoreScale: "ONE_TO_THREE",
          weightPercent: 100,
        },
      ],
    });
    await publishInstitutionScoringProfile({
      actor,
      institutionId: institution.id,
      profileId: draftProfile.id,
      effectiveFrom: daysFromNow(-1),
    });

    const edited = await publishTraineeReport({
      actor,
      institutionId: institution.id,
      traineeId: trainee.id,
      measurementDate,
      entries: [
        {
          parameterDefinitionId: parameters[0].id,
          status: "SCORED",
          rawScore: 6,
        },
      ],
    });

    expect(edited).toMatchObject({
      id: original.id,
      stageProgramVersionId: version.id,
      scoringProfileId: null,
    });
    expect(edited.scoreEntries[0]).toMatchObject({
      parameterDefinitionId: parameters[0].id,
      scoringProfileParameterId: null,
      rawScore: 6,
    });
  });

  it("blocks new reports for inactive groups while existing published scores remain readable", async () => {
    const institution = await createInstitution();
    const admin = await createStaffUser({ institutionId: institution.id, role: "ADMIN" });
    const group = await createGroup(institution.id);
    const trainee = await createTrainee({ institutionId: institution.id, groupId: group.id });
    const { parameters } = await createStageProgramVersion({
      institutionId: institution.id,
      parameterWeights: [100],
    });
    await ensureDefaultRolePermissions(institution.id);
    const actor = { id: admin.id, institutionId: institution.id, role: "ADMIN" as const };

    await publishTraineeReport({
      actor,
      institutionId: institution.id,
      traineeId: trainee.id,
      measurementDate: today(),
      entries: [
        {
          parameterDefinitionId: parameters[0].id,
          status: "SCORED",
          rawScore: 8,
        },
      ],
    });
    await testPrisma.group.update({ where: { id: group.id }, data: { active: false } });

    await expect(
      publishTraineeReport({
        actor,
        institutionId: institution.id,
        traineeId: trainee.id,
        measurementDate: daysFromNow(1),
        entries: [
          {
            parameterDefinitionId: parameters[0].id,
            status: "SCORED",
            rawScore: 9,
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: "GROUP_INACTIVE",
    } satisfies Partial<ReportMutationError>);

    const fitReport = await buildTraineeFitReport(trainee.id, institution.id);
    expect(fitReport?.mostRecentScore?.totalScore).toBeCloseTo(80);
  });
});
