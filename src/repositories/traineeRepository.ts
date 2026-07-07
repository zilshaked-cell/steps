import { prisma } from "@/lib/prisma";
import { toDateOnly } from "@/lib/dateOnly";

export interface CreateTraineeRecordInput {
  institutionId: string;
  groupId: string;
  firstName: string;
  lastName: string;
  currentStageId?: string | null;
  movedById: string;
  effectiveFrom: Date;
}

export interface UpdateTraineeRecordInput {
  traineeId: string;
  firstName?: string;
  lastName?: string;
  active?: boolean;
  currentStageId?: string | null;
}

export interface TransferTraineeGroupRecordInput {
  traineeId: string;
  institutionId: string;
  fromGroupId?: string | null;
  toGroupId: string;
  effectiveFrom: Date;
  movedById: string;
  note?: string | null;
}

export function getTraineeById(id: string) {
  return prisma.trainee.findUnique({
    where: { id },
    include: { group: true, currentStage: true },
  });
}

export function listTraineesByGroup(groupId: string, institutionId?: string) {
  return prisma.trainee.findMany({
    where: { groupId, active: true, ...(institutionId ? { institutionId } : {}) },
    include: { currentStage: true },
    orderBy: { lastName: "asc" },
  });
}

export function listTraineesByInstitution(institutionId: string) {
  return prisma.trainee.findMany({
    where: { institutionId, active: true },
    include: { group: true, currentStage: true },
    orderBy: { lastName: "asc" },
  });
}

export function createTraineeRecord(input: CreateTraineeRecordInput) {
  const effectiveFrom = toDateOnly(input.effectiveFrom);

  return prisma.$transaction(async (tx) => {
    const trainee = await tx.trainee.create({
      data: {
        institutionId: input.institutionId,
        groupId: input.groupId,
        firstName: input.firstName,
        lastName: input.lastName,
        measurementMode: "STANDARD",
        currentStageId: input.currentStageId ?? null,
      },
    });

    await tx.traineeGroupMembershipHistory.create({
      data: {
        institutionId: input.institutionId,
        traineeId: trainee.id,
        toGroupId: input.groupId,
        effectiveFrom,
        movedById: input.movedById,
        note: "Initial trainee group assignment",
      },
    });

    return trainee;
  });
}

export function updateTraineeRecord(input: UpdateTraineeRecordInput) {
  return prisma.trainee.update({
    where: { id: input.traineeId },
    data: {
      ...(input.firstName === undefined ? {} : { firstName: input.firstName }),
      ...(input.lastName === undefined ? {} : { lastName: input.lastName }),
      ...(input.active === undefined ? {} : { active: input.active }),
      ...(input.currentStageId === undefined ? {} : { currentStageId: input.currentStageId }),
    },
  });
}

export function transferTraineeGroupRecord(input: TransferTraineeGroupRecordInput) {
  const effectiveFrom = toDateOnly(input.effectiveFrom);

  return prisma.$transaction(async (tx) => {
    const trainee = await tx.trainee.update({
      where: { id: input.traineeId },
      data: { groupId: input.toGroupId },
    });

    await tx.traineeGroupMembershipHistory.create({
      data: {
        institutionId: input.institutionId,
        traineeId: input.traineeId,
        fromGroupId: input.fromGroupId ?? null,
        toGroupId: input.toGroupId,
        effectiveFrom,
        movedById: input.movedById,
        note: input.note ?? null,
      },
    });

    return trainee;
  });
}

export async function getTraineeGroupIdAtDate(
  traineeId: string,
  measurementDate: Date,
): Promise<string | null> {
  const membership = await prisma.traineeGroupMembershipHistory.findFirst({
    where: { traineeId, effectiveFrom: { lte: toDateOnly(measurementDate) } },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    select: { toGroupId: true },
  });

  return membership?.toGroupId ?? null;
}
