import { beforeEach, describe, expect, it } from "vitest";
import { buildTraineeFitReport, buildGroupFitReport } from "@/services/stagePrograms/fitReport";
import { toDateOnly } from "@/lib/dateOnly";
import { ensureDefaultRolePermissions } from "@/services/permissions/rolePermissionDefaults";
import { publishTraineeReport } from "@/services/reports/reportService";
import {
  publishGroupScoringProfile,
  saveGroupScoringProfileDraft,
} from "@/services/stagePrograms/stageSettingsService";
import {
  resetDatabase,
  createInstitution,
  createStaffUser,
  createGroup,
  createTrainee,
  createStageProgramVersion,
  createScoreEntry,
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

describe("fitReport (real Postgres)", () => {
  it("backfills a parameter with no ScoreEntry row that day as NOT_SCORED, not excluded", async () => {
    const institution = await createInstitution();
    const staff = await createStaffUser({ institutionId: institution.id });
    const { parameters } = await createStageProgramVersion({
      institutionId: institution.id,
      requiredMeasurementDays: 14,
      parameterWeights: [40, 60],
    });
    const trainee = await createTrainee({ institutionId: institution.id });

    // Only the first parameter is ever scored — the second has no row at all for
    // this day. Per spec, an untouched parameter counts as NOT_SCORED (0 points,
    // weight still in the base), not silently dropped from the calculation.
    await createScoreEntry({
      traineeId: trainee.id,
      parameterDefinitionId: parameters[0].id,
      measurementDate: new Date(),
      status: "SCORED",
      rawScore: 10,
      recordedById: staff.id,
    });

    const report = await buildTraineeFitReport(trainee.id, institution.id);

    expect(report).not.toBeNull();
    const latestDay = report!.dailyScores.at(-1);
    expect(latestDay).toBeDefined();

    const secondParamDetail = latestDay!.parameterDetails.find(
      (detail) => detail.parameterDefinitionId === parameters[1].id,
    );
    expect(secondParamDetail?.status).toBe("NOT_SCORED");
    expect(secondParamDetail?.rawScore).toBeNull();

    // earned = 40*10/10 = 40, included weight = 100 (both parameters count) -> 40
    expect(latestDay!.totalScore).toBeCloseTo(40);
  });

  it("excludes a NOT_APPLICABLE parameter from the weight base instead of penalizing", async () => {
    const institution = await createInstitution();
    const staff = await createStaffUser({ institutionId: institution.id });
    const { parameters } = await createStageProgramVersion({
      institutionId: institution.id,
      parameterWeights: [40, 60],
    });
    const trainee = await createTrainee({ institutionId: institution.id });

    await createScoreEntry({
      traineeId: trainee.id,
      parameterDefinitionId: parameters[0].id,
      measurementDate: new Date(),
      status: "SCORED",
      rawScore: 8,
      recordedById: staff.id,
    });
    await createScoreEntry({
      traineeId: trainee.id,
      parameterDefinitionId: parameters[1].id,
      measurementDate: new Date(),
      status: "NOT_APPLICABLE",
      recordedById: staff.id,
    });

    const report = await buildTraineeFitReport(trainee.id, institution.id);
    const latestDay = report!.dailyScores.at(-1)!;

    // earned = 40*8/10 = 32, included weight = 40 (60 excluded) -> 32/40*100 = 80
    expect(latestDay.totalScore).toBeCloseTo(80);
  });

  it("reports data sufficiency against requiredMeasurementDays using real stored rows", async () => {
    const institution = await createInstitution();
    const staff = await createStaffUser({ institutionId: institution.id });
    const { parameters } = await createStageProgramVersion({
      institutionId: institution.id,
      requiredMeasurementDays: 14,
      parameterWeights: [100],
    });
    const trainee = await createTrainee({ institutionId: institution.id });

    await createScoreEntry({
      traineeId: trainee.id,
      parameterDefinitionId: parameters[0].id,
      measurementDate: new Date(),
      status: "SCORED",
      rawScore: 7,
      recordedById: staff.id,
    });

    const report = await buildTraineeFitReport(trainee.id, institution.id);

    expect(report!.dataSufficiency).toMatchObject({
      measurementDaysIncluded: 1,
      measurementDaysRequired: 14,
      parametersIncluded: 1,
      parametersExpected: 1,
      isSufficient: false,
    });
  });

  it("falls back to source weights for inherited local scoring-profile parameters", async () => {
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

    const draft = await saveGroupScoringProfileDraft({
      actor,
      institutionId: institution.id,
      groupId: group.id,
      stageProgramVersionId: version.id,
      parameters: [
        {
          sourceParameterDefinitionId: parameters[0].id,
          weightPercent: null,
        },
      ],
    });
    const profile = await publishGroupScoringProfile({
      actor,
      institutionId: institution.id,
      groupId: group.id,
      profileId: draft.id,
      effectiveFrom: daysFromNow(-1),
    });

    await publishTraineeReport({
      actor,
      institutionId: institution.id,
      traineeId: trainee.id,
      measurementDate: today(),
      entries: [
        {
          scoringProfileParameterId: profile.parameters[0].id,
          status: "SCORED",
          rawScore: 5,
        },
      ],
    });

    const report = await buildTraineeFitReport(trainee.id, institution.id);
    const latestDay = report!.dailyScores.at(-1)!;

    expect(latestDay.parameterDetails[0]).toMatchObject({
      parameterDefinitionId: parameters[0].id,
      scoringProfileParameterId: profile.parameters[0].id,
      weightPercent: 100,
    });
    expect(latestDay.totalScore).toBeCloseTo(50);
  });

  it("uses profile-backed parameter counts for data sufficiency warnings", async () => {
    const institution = await createInstitution();
    const admin = await createStaffUser({ institutionId: institution.id, role: "ADMIN" });
    const group = await createGroup(institution.id);
    const trainee = await createTrainee({ institutionId: institution.id, groupId: group.id });
    const { version, parameters } = await createStageProgramVersion({
      institutionId: institution.id,
      requiredMeasurementDays: 14,
      parameterWeights: [50, 50],
    });
    await ensureDefaultRolePermissions(institution.id);
    const actor = { id: admin.id, institutionId: institution.id, role: "ADMIN" as const };

    const draft = await saveGroupScoringProfileDraft({
      actor,
      institutionId: institution.id,
      groupId: group.id,
      stageProgramVersionId: version.id,
      parameters: [
        {
          sourceParameterDefinitionId: parameters[0].id,
          weightPercent: 100,
        },
      ],
    });
    const profile = await publishGroupScoringProfile({
      actor,
      institutionId: institution.id,
      groupId: group.id,
      profileId: draft.id,
      effectiveFrom: daysFromNow(-1),
    });

    await publishTraineeReport({
      actor,
      institutionId: institution.id,
      traineeId: trainee.id,
      measurementDate: today(),
      entries: [
        {
          scoringProfileParameterId: profile.parameters[0].id,
          status: "SCORED",
          rawScore: 10,
        },
      ],
    });

    const report = await buildTraineeFitReport(trainee.id, institution.id);

    expect(report!.dataSufficiency).toMatchObject({
      parametersIncluded: 1,
      parametersExpected: 1,
    });
  });

  it("buckets entries by UTC calendar day regardless of time-of-day", async () => {
    const institution = await createInstitution();
    const staff = await createStaffUser({ institutionId: institution.id });
    const { parameters } = await createStageProgramVersion({
      institutionId: institution.id,
      parameterWeights: [100],
    });
    const trainee = await createTrainee({ institutionId: institution.id });

    // Same UTC calendar day, two different times — must land in one bucket, not two.
    await createScoreEntry({
      traineeId: trainee.id,
      parameterDefinitionId: parameters[0].id,
      measurementDate: new Date("2026-07-05T02:00:00.000Z"),
      status: "SCORED",
      rawScore: 5,
      recordedById: staff.id,
    });

    const report = await buildTraineeFitReport(trainee.id, institution.id);
    const matchingDay = report!.dailyScores.filter(
      (day) => toDateOnly(day.date).toISOString() === toDateOnly(new Date("2026-07-05")).toISOString(),
    );
    expect(matchingDay).toHaveLength(1);
  });

  it("returns null instead of another institution's data when institutionId is passed and mismatches", async () => {
    const institutionA = await createInstitution();
    const institutionB = await createInstitution();
    await createStageProgramVersion({ institutionId: institutionA.id });
    const trainee = await createTrainee({ institutionId: institutionA.id });

    const report = await buildTraineeFitReport(trainee.id, institutionB.id);

    expect(report).toBeNull();
  });

  it("group report only includes trainees actually in that group/institution", async () => {
    const institution = await createInstitution();
    await createStageProgramVersion({ institutionId: institution.id });
    const group = await createGroup(institution.id);
    const otherGroup = await createGroup(institution.id);
    const inGroup = await createTrainee({ institutionId: institution.id, groupId: group.id });
    await createTrainee({ institutionId: institution.id, groupId: otherGroup.id });

    const report = await buildGroupFitReport(group.id, institution.id);

    expect(report.map((r) => r.traineeId)).toEqual([inGroup.id]);
  });
});
