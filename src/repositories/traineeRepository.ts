import { prisma } from "@/lib/prisma";

export function getTraineeById(id: string) {
  return prisma.trainee.findUnique({
    where: { id },
    include: { group: true, currentStage: true },
  });
}

export function listTraineesByGroup(groupId: string) {
  return prisma.trainee.findMany({
    where: { groupId, active: true },
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
