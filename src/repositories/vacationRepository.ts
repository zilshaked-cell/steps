import { prisma } from "@/lib/prisma";
import { toDateOnly } from "@/lib/dateOnly";
import type { Prisma } from "@/generated/prisma/client";

type VacationRepositoryDbClient = Pick<Prisma.TransactionClient, "vacationPeriod">;

export interface VacationScopeInput {
  groupId?: string | null;
  traineeId?: string | null;
}

export interface CreateVacationPeriodRecordInput extends VacationScopeInput {
  institutionId: string;
  title: string;
  note?: string | null;
  startsOn: Date;
  endsOn: Date;
  createdById?: string | null;
}

export interface UpdateVacationPeriodRecordInput extends VacationScopeInput {
  id: string;
  title?: string;
  note?: string | null;
  startsOn?: Date;
  endsOn?: Date;
}

export function getVacationPeriodById(id: string) {
  return prisma.vacationPeriod.findUnique({ where: { id } });
}

export function listVacationPeriodsByInstitution(institutionId: string) {
  return prisma.vacationPeriod.findMany({
    where: { institutionId },
    orderBy: [{ startsOn: "asc" }, { title: "asc" }],
  });
}

export function createVacationPeriodRecord(
  input: CreateVacationPeriodRecordInput,
  db: VacationRepositoryDbClient = prisma,
) {
  return db.vacationPeriod.create({
    data: {
      institutionId: input.institutionId,
      groupId: input.groupId ?? null,
      traineeId: input.traineeId ?? null,
      title: input.title,
      note: input.note ?? null,
      startsOn: toDateOnly(input.startsOn),
      endsOn: toDateOnly(input.endsOn),
      createdById: input.createdById ?? null,
    },
  });
}

export function updateVacationPeriodRecord(
  input: UpdateVacationPeriodRecordInput,
  db: VacationRepositoryDbClient = prisma,
) {
  return db.vacationPeriod.update({
    where: { id: input.id },
    data: {
      ...(input.groupId === undefined ? {} : { groupId: input.groupId }),
      ...(input.traineeId === undefined ? {} : { traineeId: input.traineeId }),
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.note === undefined ? {} : { note: input.note }),
      ...(input.startsOn === undefined ? {} : { startsOn: toDateOnly(input.startsOn) }),
      ...(input.endsOn === undefined ? {} : { endsOn: toDateOnly(input.endsOn) }),
    },
  });
}

export function deleteVacationPeriodRecord(id: string, db: VacationRepositoryDbClient = prisma) {
  return db.vacationPeriod.delete({ where: { id } });
}
