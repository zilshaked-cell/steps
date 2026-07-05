import { prisma } from "@/lib/prisma";

export function getStaffUserByEmail(email: string) {
  return prisma.staffUser.findUnique({ where: { email } });
}

export function findActiveStaffUserByEmail(email: string) {
  return prisma.staffUser.findFirst({
    where: {
      active: true,
      email: { equals: email.trim(), mode: "insensitive" },
    },
  });
}

export function getStaffUserById(id: string) {
  return prisma.staffUser.findUnique({ where: { id } });
}

export function listStaffByInstitution(institutionId: string) {
  return prisma.staffUser.findMany({
    where: { institutionId, active: true },
    orderBy: { name: "asc" },
  });
}
