import type { ParameterEntryStatus } from "@/generated/prisma/enums";
import { getTraineeById, listTraineesByGroup } from "@/repositories/traineeRepository";
import { listScoreEntriesForTraineeInRange } from "@/repositories/scoreEntryRepository";
import { getPrimaryStageProgramVersion } from "@/repositories/stageProgramRepository";
import { calculateStageScore } from "./scoring";
import { checkDataSufficiency, type DataSufficiencyResult } from "./dataSufficiency";

export interface ParameterScoreDetail {
  parameterDefinitionId: string;
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

export async function buildTraineeFitReport(traineeId: string): Promise<TraineeFitReport | null> {
  const trainee = await getTraineeById(traineeId);
  if (!trainee) return null;

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

  const to = new Date();
  const from = new Date(to.getTime() - version.requiredMeasurementDays * 24 * 60 * 60 * 1000);
  const entries = await listScoreEntriesForTraineeInRange(traineeId, from, to);

  const entriesByDay = new Map<string, typeof entries>();
  for (const entry of entries) {
    const dayKey = entry.measurementDate.toISOString().slice(0, 10);
    const bucket = entriesByDay.get(dayKey) ?? [];
    bucket.push(entry);
    entriesByDay.set(dayKey, bucket);
  }

  const dailyScores: DailyScore[] = [...entriesByDay.entries()]
    .map(([dayKey, dayEntries]) => {
      const result = calculateStageScore(
        dayEntries.map((entry) => ({
          weightPercent: entry.parameterDefinition.weightPercent.toNumber(),
          status: entry.status,
          rawScore: entry.rawScore,
        })),
      );
      const parameterDetails: ParameterScoreDetail[] = dayEntries.map((entry) => ({
        parameterDefinitionId: entry.parameterDefinitionId,
        name: entry.parameterDefinition.name,
        weightPercent: entry.parameterDefinition.weightPercent.toNumber(),
        status: entry.status,
        rawScore: entry.rawScore,
      }));
      return { date: new Date(dayKey), totalScore: result.totalScore, parameterDetails };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const parametersTouched = new Set(entries.map((entry) => entry.parameterDefinitionId));

  const dataSufficiency = checkDataSufficiency({
    measurementDaysIncluded: entriesByDay.size,
    measurementDaysRequired: version.requiredMeasurementDays,
    parametersIncluded: parametersTouched.size,
    parametersExpected: applicableParameters.length,
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

export async function buildGroupFitReport(groupId: string): Promise<TraineeFitReport[]> {
  const trainees = await listTraineesByGroup(groupId);
  const reports = await Promise.all(trainees.map((trainee) => buildTraineeFitReport(trainee.id)));
  return reports.filter((report): report is TraineeFitReport => report !== null);
}
