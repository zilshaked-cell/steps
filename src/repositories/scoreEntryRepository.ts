import { prisma } from "@/lib/prisma";
import { toDateOnly } from "@/lib/dateOnly";
import type { ParameterEntryStatus } from "@/generated/prisma/enums";

export function listScoreEntriesForTraineeInRange(traineeId: string, from: Date, to: Date) {
  return prisma.scoreEntry.findMany({
    where: { traineeId, measurementDate: { gte: from, lte: to } },
    include: { parameterDefinition: true },
    orderBy: { measurementDate: "asc" },
  });
}

export interface UpsertScoreEntryInput {
  traineeId: string;
  parameterDefinitionId: string;
  measurementDate: Date;
  status: ParameterEntryStatus;
  rawScore?: number | null;
  recordedById: string;
}

// Mirrors the same rule calculateStageScore() enforces, but at write time instead
// of read time: a bad row should never make it into the database in the first
// place. NOT_SCORED/NOT_APPLICABLE are always forced to null, regardless of what
// the caller passed, so a stale rawScore from a previous SCORED entry can never
// linger after the status changes away from SCORED.
function normalizeRawScore(status: ParameterEntryStatus, rawScore: number | null | undefined): number | null {
  if (status !== "SCORED") return null;

  if (rawScore == null || !Number.isInteger(rawScore) || rawScore < 1 || rawScore > 10) {
    throw new Error("rawScore must be an integer between 1 and 10 when status is SCORED");
  }
  return rawScore;
}

// One entry per (trainee, parameter, day) — re-recording the same day overwrites it
// rather than creating a duplicate, per the unique constraint in the schema.
// Declared `async` deliberately: normalizeRawScore() can throw before any Promise
// would otherwise be returned, which would surprise callers as a synchronous
// exception instead of a rejected Promise. `async` guarantees every throw here,
// sync or not, always surfaces as a rejection.
export async function upsertScoreEntry(input: UpsertScoreEntryInput) {
  const measurementDate = toDateOnly(input.measurementDate);
  const rawScore = normalizeRawScore(input.status, input.rawScore);
  const key = {
    traineeId_parameterDefinitionId_measurementDate: {
      traineeId: input.traineeId,
      parameterDefinitionId: input.parameterDefinitionId,
      measurementDate,
    },
  };

  return prisma.scoreEntry.upsert({
    where: key,
    create: { ...input, measurementDate, rawScore },
    update: {
      status: input.status,
      rawScore,
      recordedById: input.recordedById,
    },
  });
}
