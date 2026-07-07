import { prisma } from "@/lib/prisma";
import { toDateOnly, toDateOnlyKey } from "@/lib/dateOnly";
import { appendAuditLogEntry } from "@/services/audit/auditLogService";
import {
  createVacationPeriodRecord,
  deleteVacationPeriodRecord,
  getVacationPeriodById,
  listVacationPeriodsByInstitution,
  updateVacationPeriodRecord,
  type VacationScopeInput,
} from "@/repositories/vacationRepository";
import {
  resolvePermission,
  type PermissionScope,
  type PermissionSubject,
} from "@/services/permissions/resolvePermission";

export type VacationMutationErrorCode =
  | "ACTOR_OUT_OF_SCOPE"
  | "DATE_RANGE_INVALID"
  | "FORBIDDEN"
  | "GROUP_OUT_OF_SCOPE"
  | "MALFORMED_SCOPE"
  | "TITLE_INVALID"
  | "TRAINEE_OUT_OF_SCOPE"
  | "VACATION_NOT_FOUND";

export class VacationMutationError extends Error {
  constructor(
    readonly code: VacationMutationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "VacationMutationError";
  }
}

export interface CreateVacationPeriodInput extends VacationScopeInput {
  actor: PermissionSubject;
  institutionId: string;
  title: string;
  note?: string | null;
  startsOn: Date;
  endsOn: Date;
}

export interface UpdateVacationPeriodInput extends VacationScopeInput {
  actor: PermissionSubject;
  institutionId: string;
  id: string;
  title?: string;
  note?: string | null;
  startsOn?: Date;
  endsOn?: Date;
}

export interface DeleteVacationPeriodInput {
  actor: PermissionSubject;
  institutionId: string;
  id: string;
}

export interface ListEffectiveVacationPeriodsForTraineeInput {
  institutionId: string;
  traineeId: string;
  from: Date;
  to: Date;
}

function fail(code: VacationMutationErrorCode, message: string): never {
  throw new VacationMutationError(code, message);
}

function normalizeTitle(title: string): string {
  const normalized = title.trim();
  if (!normalized) fail("TITLE_INVALID", "Vacation title cannot be empty.");
  return normalized;
}

function normalizeOptionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const normalized = value?.trim() ?? "";
  return normalized ? normalized : null;
}

function normalizeDateRange(startsOn: Date, endsOn: Date) {
  if (Number.isNaN(startsOn.getTime()) || Number.isNaN(endsOn.getTime())) {
    fail("DATE_RANGE_INVALID", "Vacation dates must be valid dates.");
  }
  const start = toDateOnly(startsOn);
  const end = toDateOnly(endsOn);
  if (start.getTime() > end.getTime()) {
    fail("DATE_RANGE_INVALID", "Vacation start date cannot be after end date.");
  }
  return { startsOn: start, endsOn: end };
}

async function assertVacationScope(institutionId: string, scope: VacationScopeInput) {
  if (scope.groupId && scope.traineeId) {
    fail("MALFORMED_SCOPE", "Vacation scope cannot include both groupId and traineeId.");
  }

  if (scope.groupId) {
    const group = await prisma.group.findUnique({
      where: { id: scope.groupId },
      select: { institutionId: true },
    });
    if (!group || group.institutionId !== institutionId) {
      fail("GROUP_OUT_OF_SCOPE", "Vacation group does not belong to institution.");
    }
  }

  if (scope.traineeId) {
    const trainee = await prisma.trainee.findUnique({
      where: { id: scope.traineeId },
      select: { institutionId: true },
    });
    if (!trainee || trainee.institutionId !== institutionId) {
      fail("TRAINEE_OUT_OF_SCOPE", "Vacation trainee does not belong to institution.");
    }
  }
}

async function permissionScopeForVacation(scope: VacationScopeInput): Promise<PermissionScope> {
  if (scope.groupId) return { groupId: scope.groupId };
  if (!scope.traineeId) return {};

  const trainee = await prisma.trainee.findUnique({
    where: { id: scope.traineeId },
    select: { groupId: true },
  });
  return trainee?.groupId ? { traineeId: scope.traineeId, groupId: trainee.groupId } : { traineeId: scope.traineeId };
}

async function assertCanManageVacations(
  actor: PermissionSubject,
  institutionId: string,
  scope: VacationScopeInput,
) {
  if (actor.institutionId !== institutionId) {
    fail("ACTOR_OUT_OF_SCOPE", "Actor does not belong to the target institution.");
  }

  const allowed = await resolvePermission(
    actor,
    "MANAGE_VACATIONS",
    await permissionScopeForVacation(scope),
  );
  if (!allowed) fail("FORBIDDEN", "Actor is not allowed to manage vacations.");
}

async function assertVacationInInstitution(id: string, institutionId: string) {
  const vacation = await getVacationPeriodById(id);
  if (!vacation || vacation.institutionId !== institutionId) {
    fail("VACATION_NOT_FOUND", "Vacation period does not exist in the target institution.");
  }
  return vacation;
}

export async function createVacationPeriod(input: CreateVacationPeriodInput) {
  await assertVacationScope(input.institutionId, input);
  await assertCanManageVacations(input.actor, input.institutionId, input);
  const { startsOn, endsOn } = normalizeDateRange(input.startsOn, input.endsOn);

  return prisma.$transaction(async (tx) => {
    const vacation = await createVacationPeriodRecord(
      {
        institutionId: input.institutionId,
        groupId: input.groupId ?? null,
        traineeId: input.traineeId ?? null,
        title: normalizeTitle(input.title),
        note: normalizeOptionalText(input.note),
        startsOn,
        endsOn,
        createdById: input.actor.id,
      },
      tx,
    );

    await appendAuditLogEntry(
      {
        institutionId: input.institutionId,
        actorId: input.actor.id,
        action: "VACATION.CREATE",
        metadata: { vacationId: vacation.id },
      },
      tx,
    );

    return vacation;
  });
}

export async function updateVacationPeriod(input: UpdateVacationPeriodInput) {
  const existing = await assertVacationInInstitution(input.id, input.institutionId);
  const nextScope = {
    groupId: input.groupId === undefined ? existing.groupId : input.groupId,
    traineeId: input.traineeId === undefined ? existing.traineeId : input.traineeId,
  };
  await assertVacationScope(input.institutionId, nextScope);
  await assertCanManageVacations(input.actor, input.institutionId, nextScope);

  const nextDates = normalizeDateRange(
    input.startsOn ?? existing.startsOn,
    input.endsOn ?? existing.endsOn,
  );

  return prisma.$transaction(async (tx) => {
    const vacation = await updateVacationPeriodRecord(
      {
        id: input.id,
        groupId: input.groupId,
        traineeId: input.traineeId,
        title: input.title === undefined ? undefined : normalizeTitle(input.title),
        note: normalizeOptionalText(input.note),
        startsOn: nextDates.startsOn,
        endsOn: nextDates.endsOn,
      },
      tx,
    );

    await appendAuditLogEntry(
      {
        institutionId: input.institutionId,
        actorId: input.actor.id,
        action: "VACATION.UPDATE",
        metadata: { vacationId: vacation.id },
      },
      tx,
    );

    return vacation;
  });
}

export async function deleteVacationPeriod(input: DeleteVacationPeriodInput) {
  const existing = await assertVacationInInstitution(input.id, input.institutionId);
  await assertCanManageVacations(input.actor, input.institutionId, existing);

  return prisma.$transaction(async (tx) => {
    const deleted = await deleteVacationPeriodRecord(input.id, tx);

    await appendAuditLogEntry(
      {
        institutionId: input.institutionId,
        actorId: input.actor.id,
        action: "VACATION.DELETE",
        metadata: { vacationId: deleted.id },
      },
      tx,
    );

    return deleted;
  });
}

export { listVacationPeriodsByInstitution };

export async function listEffectiveVacationPeriodsForTrainee(
  input: ListEffectiveVacationPeriodsForTraineeInput,
) {
  const { startsOn: from, endsOn: to } = normalizeDateRange(input.from, input.to);
  const trainee = await prisma.trainee.findUnique({
    where: { id: input.traineeId },
    select: { institutionId: true, groupId: true },
  });
  if (!trainee || trainee.institutionId !== input.institutionId) {
    fail("TRAINEE_OUT_OF_SCOPE", "Vacation trainee does not belong to institution.");
  }

  return prisma.vacationPeriod.findMany({
    where: {
      institutionId: input.institutionId,
      startsOn: { lte: to },
      endsOn: { gte: from },
      OR: [
        { groupId: null, traineeId: null },
        ...(trainee.groupId ? [{ groupId: trainee.groupId, traineeId: null }] : []),
        { traineeId: input.traineeId },
      ],
    },
    orderBy: [{ startsOn: "asc" }, { title: "asc" }],
  });
}

export async function getVacationDayKeysForTrainee(
  input: ListEffectiveVacationPeriodsForTraineeInput,
): Promise<Set<string>> {
  const { startsOn: from, endsOn: to } = normalizeDateRange(input.from, input.to);
  const vacations = await listEffectiveVacationPeriodsForTrainee(input);
  const dayKeys = new Set<string>();

  for (const vacation of vacations) {
    const cursor = new Date(Math.max(vacation.startsOn.getTime(), from.getTime()));
    const end = new Date(Math.min(vacation.endsOn.getTime(), to.getTime()));
    while (cursor.getTime() <= end.getTime()) {
      dayKeys.add(toDateOnlyKey(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return dayKeys;
}

export async function isVacationDayForTrainee(input: {
  institutionId: string;
  traineeId: string;
  date: Date;
}): Promise<boolean> {
  const day = toDateOnly(input.date);
  const dayKeys = await getVacationDayKeysForTrainee({
    institutionId: input.institutionId,
    traineeId: input.traineeId,
    from: day,
    to: day,
  });
  return dayKeys.has(toDateOnlyKey(day));
}
