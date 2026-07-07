import type { ParameterEntryStatus, ScoreScale } from "@/generated/prisma/enums";
import { getTraineeById, listTraineesByGroup } from "@/repositories/traineeRepository";
import { listScoreEntriesForTraineeInRange } from "@/repositories/scoreEntryRepository";
import { getPrimaryStageProgramVersion } from "@/repositories/stageProgramRepository";
import { toDateOnlyKey, dateOnlyKeyToDate, startOfUtcDay, endOfUtcDay } from "@/lib/dateOnly";
import { calculateStageScore, maxRawScoreForScale } from "./scoring";
import { checkDataSufficiency, type DataSufficiencyResult } from "./dataSufficiency";

export interface ParameterScoreDetail {
  parameterDefinitionId: string;
  scoringProfileParameterId: string | null;
  name: string;
  weightPercent: number;
  status: ParameterEntryStatus;
  rawScore: number | null;
}

export interface DailyScore {
  date: Date;
  totalScore: number;
  // Per-parameter breakdown for this day — shown only when drilling into a single
  // trainee, per spec (group report shows the aggregate only).
  parameterDetails: ParameterScoreDetail[];
}

export interface TraineeFitReport {
  traineeId: string;
  firstName: string;
  lastName: string;
  currentStageName: string | null;
  // Each day's score is calculated independently (fully specified: weight × score/10,
  // rescaled for NOT_APPLICABLE parameters). These are deliberately NOT collapsed into
  // a single period score — how to aggregate several days into one period score is an
  // open product question, not decided yet. See src/services/stagePrograms/recommendation.ts.
  dailyScores: DailyScore[];
  mostRecentScore: DailyScore | null;
  dataSufficiency: DataSufficiencyResult;
}

function measurementWindow(requiredMeasurementDays: number): { from: Date; to: Date } {
  const today = startOfUtcDay(new Date());
  const from = new Date(today);
  from.setUTCDate(today.getUTCDate() - Math.max(requiredMeasurementDays - 1, 0));
  return { from, to: endOfUtcDay(today) };
}

interface ApplicableReportParameter {
  key: string;
  parameterDefinitionId: string;
  scoringProfileParameterId: string | null;
  name: string;
  weightPercent: number;
  maxRawScore: number;
}

function decimalToNumber(value: { toNumber(): number } | number | string | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return value.toNumber();
}

function parameterAppliesToStage(
  parameter: { stageId: string | null },
  currentStageId: string | null,
): boolean {
  return parameter.stageId == null || parameter.stageId === currentStageId;
}

function parametersFromStageProgramVersion(
  parameters: Array<{
    id: string;
    stageId: string | null;
    name: string;
    weightPercent: { toNumber(): number };
    scoreScale: ScoreScale;
  }>,
  currentStageId: string | null,
): ApplicableReportParameter[] {
  return parameters
    .filter((parameter) => parameterAppliesToStage(parameter, currentStageId))
    .map((parameter) => ({
      key: parameter.id,
      parameterDefinitionId: parameter.id,
      scoringProfileParameterId: null,
      name: parameter.name,
      weightPercent: parameter.weightPercent.toNumber(),
      maxRawScore: maxRawScoreForScale(parameter.scoreScale),
    }));
}

function parametersFromScoringProfile(
  parameters: Array<{
    id: string;
    sourceParameterDefinitionId: string | null;
    sourceParameterDefinition: {
      id: string;
      name: string;
      scoreScale: ScoreScale;
      weightPercent: { toNumber(): number };
    } | null;
    stageId: string | null;
    name: string | null;
    scoreScale: ScoreScale | null;
    weightPercent: { toNumber(): number } | null;
    active: boolean;
  }>,
  currentStageId: string | null,
): ApplicableReportParameter[] {
  return parameters
    .filter((parameter) => parameter.active && parameterAppliesToStage(parameter, currentStageId))
    .map((parameter) => {
      const source = parameter.sourceParameterDefinition;
      return {
        key: parameter.id,
        parameterDefinitionId: source?.id ?? parameter.sourceParameterDefinitionId ?? parameter.id,
        scoringProfileParameterId: parameter.id,
        name: parameter.name ?? source?.name ?? "Unnamed parameter",
        weightPercent: decimalToNumber(parameter.weightPercent ?? source?.weightPercent),
        maxRawScore: maxRawScoreForScale(parameter.scoreScale ?? source?.scoreScale ?? "ONE_TO_TEN"),
      };
    });
}

// institutionId is required, not optional: a caller that forgets to pass it must
// not silently get another institution's report data back.
export async function buildTraineeFitReport(
  traineeId: string,
  institutionId: string,
): Promise<TraineeFitReport | null> {
  const trainee = await getTraineeById(traineeId);
  if (!trainee) return null;
  if (trainee.institutionId !== institutionId) return null;

  const version = await getPrimaryStageProgramVersion(trainee.institutionId);
  if (!version) {
    throw new Error(`No stage program configured for institution ${trainee.institutionId}`);
  }

  // Per-trainee CUSTOM overrides (TraineeParameterOverride/TraineeThresholdOverride)
  // are not merged in here yet — this report only reads the institution's standard
  // configuration, regardless of the trainee's measurementMode.
  const applicableParameters = version.parameters.filter(
    (parameter) => parameter.stageId == null || parameter.stageId === trainee.currentStageId,
  );
  const legacyParameters = parametersFromStageProgramVersion(
    applicableParameters,
    trainee.currentStageId,
  );

  const { from, to } = measurementWindow(version.requiredMeasurementDays);
  const entries = await listScoreEntriesForTraineeInRange(traineeId, from, to);

  const entriesByDay = new Map<string, typeof entries>();
  for (const entry of entries) {
    const dayKey = toDateOnlyKey(entry.measurementDate);
    const bucket = entriesByDay.get(dayKey) ?? [];
    bucket.push(entry);
    entriesByDay.set(dayKey, bucket);
  }

  const parametersTouched = new Set<string>();
  const parametersExpected = new Set<string>();
  const dailyScores: DailyScore[] = [];
  for (const [dayKey, dayEntries] of entriesByDay.entries()) {
    const scoringProfile = dayEntries.find((entry) => entry.measurementReport?.scoringProfile)
      ?.measurementReport?.scoringProfile;
    const reportParameters = scoringProfile
      ? parametersFromScoringProfile(scoringProfile.parameters, trainee.currentStageId)
      : legacyParameters;

    const entriesByParameterKey = new Map(
      dayEntries.flatMap((entry) => {
        const key = scoringProfile ? entry.scoringProfileParameterId : entry.parameterDefinitionId;
        return key ? [[key, entry] as const] : [];
      }),
    );
    if (!reportParameters.some((parameter) => entriesByParameterKey.has(parameter.key))) continue;
    for (const parameter of reportParameters) parametersExpected.add(parameter.key);

    const parameterScores = reportParameters.map((parameter) => {
      const entry = entriesByParameterKey.get(parameter.key);
      if (entry) parametersTouched.add(parameter.key);
      return {
        parameterDefinitionId: parameter.parameterDefinitionId,
        scoringProfileParameterId: parameter.scoringProfileParameterId,
        name: parameter.name,
        weightPercent: parameter.weightPercent,
        maxRawScore: parameter.maxRawScore,
        status: entry?.status ?? "NOT_SCORED",
        rawScore: entry?.rawScore ?? null,
      };
    });
    const result = calculateStageScore(
      parameterScores.map((parameter) => ({
        weightPercent: parameter.weightPercent,
        status: parameter.status,
        rawScore: parameter.rawScore,
        maxRawScore: parameter.maxRawScore,
      })),
    );
    const parameterDetails: ParameterScoreDetail[] = parameterScores.map((parameter) => ({
      parameterDefinitionId: parameter.parameterDefinitionId,
      scoringProfileParameterId: parameter.scoringProfileParameterId,
      name: parameter.name,
      weightPercent: parameter.weightPercent,
      status: parameter.status,
      rawScore: parameter.rawScore,
    }));
    dailyScores.push({
      date: dateOnlyKeyToDate(dayKey),
      totalScore: result.totalScore,
      parameterDetails,
    });
  }
  dailyScores.sort((a, b) => a.date.getTime() - b.date.getTime());

  const dataSufficiency = checkDataSufficiency({
    measurementDaysIncluded: dailyScores.length,
    measurementDaysRequired: version.requiredMeasurementDays,
    parametersIncluded: parametersTouched.size,
    parametersExpected: parametersExpected.size || legacyParameters.length,
  });

  return {
    traineeId: trainee.id,
    firstName: trainee.firstName,
    lastName: trainee.lastName,
    currentStageName: trainee.currentStage?.name ?? null,
    dailyScores,
    mostRecentScore: dailyScores.at(-1) ?? null,
    dataSufficiency,
  };
}

export async function buildGroupFitReport(
  groupId: string,
  institutionId: string,
): Promise<TraineeFitReport[]> {
  const trainees = await listTraineesByGroup(groupId, institutionId);
  const reports = await Promise.all(
    trainees.map((trainee) => buildTraineeFitReport(trainee.id, institutionId)),
  );
  return reports.filter((report): report is TraineeFitReport => report !== null);
}
