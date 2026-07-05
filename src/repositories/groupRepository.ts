import { prisma } from "@/lib/prisma";

export function getGroupById(id: string) {
  return prisma.group.findUnique({ where: { id } });
}

export function listGroupsByInstitution(institutionId: string) {
  return prisma.group.findMany({
    where: { institutionId },
    orderBy: { name: "asc" },
  });
}
