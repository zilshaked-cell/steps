import { prisma } from "@/lib/prisma";

export function getInstitutionById(id: string) {
  return prisma.institution.findUnique({ where: { id } });
}

export function listInstitutions() {
  return prisma.institution.findMany({ orderBy: { name: "asc" } });
}
