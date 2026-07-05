import { prisma } from "@/lib/prisma";
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

// One entry per (trainee, parameter, day) — re-recording the same day overwrites it
// rather than creating a duplicate, per the unique constraint in the schema.
export function upsertScoreEntry(input: UpsertScoreEntryInput) {
  const key = {
    traineeId_parameterDefinitionId_measurementDate: {
      traineeId: input.traineeId,
      parameterDefinitionId: input.parameterDefinitionId,
      measurementDate: input.measurementDate,
    },
  };

  return prisma.scoreEntry.upsert({
    where: key,
    create: input,
    update: {
      status: input.status,
      rawScore: input.rawScore,
      recordedById: input.recordedById,
    },
  });
}
