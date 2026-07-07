import { prisma } from "@/lib/prisma";
import { toDateOnly } from "@/lib/dateOnly";
import { getPrimaryStageProgramVersion } from "@/repositories/stageProgramRepository";
import { getTraineeGroupIdAtDate } from "@/repositories/traineeRepository";
import {
  createTraineeRecord,
  transferTraineeGroupRecord,
  updateTraineeRecord,
} from "@/repositories/traineeRepository";
import {
  resolvePermission,
  type PermissionScope,
  type PermissionSubject,
} from "@/services/permissions/resolvePermission";

export type TraineeMutationErrorCode =
  | "ACTOR_OUT_OF_SCOPE"
  | "FORBIDDEN"
  | "GROUP_INACTIVE"
  | "GROUP_NOT_FOUND"
  | "INVALID_DATE"
  | "INVALID_NAME"
  | "NOOP_TRANSFER"
  | "STAGE_NOT_FOUND"
  | "TRAINEE_NOT_FOUND";

export class TraineeMutationError extends Error {
  constructor(
    readonly code: TraineeMutationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TraineeMutationError";
  }
}

export interface CreateManagedTraineeInput {
  actor: PermissionSubject;
  institutionId: string;
  groupId: string;
  firstName: string;
  lastName: string;
  currentStageId?: string | null;
  effectiveFrom?: Date;
}

export interface UpdateManagedTraineeInput {
  actor: PermissionSubject;
  institutionId: string;
  traineeId: string;
  firstName?: string;
  lastName?: string;
  active?: boolean;
  currentStageId?: string | null;
}

export interface TransferManagedTraineeGroupInput {
  actor: PermissionSubject;
  institutionId: string;
  traineeId: string;
  toGroupId: string;
  effectiveFrom: Date;
  note?: string | null;
}

export interface GetTraineeGroupAtMeasurementDateInput {
  institutionId: string;
  traineeId: string;
  measurementDate: Date;
}

function fail(code: TraineeMutationErrorCode, message: string): never {
  throw new TraineeMutationError(code, message);
}

function normalizeName(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!normalized) fail("INVALID_NAME", `${fieldName} cannot be empty.`);
  return normalized;
}

function normalizeOptionalName(value: string | undefined, fieldName: string): string | undefined {
  if (value === undefined) return undefined;
  return normalizeName(value, fieldName);
}

function normalizeNote(note: string | null | undefined): string | null | undefined {
  if (note === undefined) return undefined;
  const normalized = note?.trim() ?? "";
  return normalized ? normalized : null;
}

function assertActorInInstitution(actor: PermissionSubject, institutionId: string) {
  if (actor.institutionId !== institutionId) {
    fail("ACTOR_OUT_OF_SCOPE", "Actor does not belong to the target institution.");
  }
}

function traineePermissionScope(
  traineeId: string,
  groupId: string | null | undefined,
): PermissionScope {
  return { traineeId, ...(groupId ? { groupId } : {}) };
}

async function assertCanManageTrainees(
  actor: PermissionSubject,
  institutionId: string,
  scope: PermissionScope,
) {
  assertActorInInstitution(actor, institutionId);

  const allowed = await resolvePermission(actor, "MANAGE_TRAINEES", scope);
  if (!allowed) fail("FORBIDDEN", "Actor is not allowed to manage trainees.");
}

async function assertCanTransferTrainees(
  actor: PermissionSubject,
  institutionId: string,
  scope: PermissionScope,
) {
  assertActorInInstitution(actor, institutionId);

  const allowed = await resolvePermission(actor, "TRANSFER_TRAINEES", scope);
  if (!allowed) fail("FORBIDDEN", "Actor is not allowed to transfer trainees.");
}

async function getActiveGroupOrThrow(groupId: string, institutionId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, institutionId: true, active: true },
  });

  if (!group || group.institutionId !== institutionId) {
    fail("GROUP_NOT_FOUND", "Group does not exist in the target institution.");
  }
  if (!group.active) {
    fail("GROUP_INACTIVE", "Group must be active before assigning trainees to it.");
  }

  return group;
}

async function getTraineeOrThrow(traineeId: string, institutionId: string) {
  const trainee = await prisma.trainee.findUnique({
    where: { id: traineeId },
    select: { id: true, institutionId: true, groupId: true },
  });

  if (!trainee || trainee.institutionId !== institutionId) {
    fail("TRAINEE_NOT_FOUND", "Trainee does not exist in the target institution.");
  }

  return trainee;
}

async function assertStageInInstitution(
  currentStageId: string | null | undefined,
  institutionId: string,
) {
  if (!currentStageId) return;

  const activeVersion = await getPrimaryStageProgramVersion(institutionId);

  if (!activeVersion?.stages.some((stage) => stage.id === currentStageId)) {
    fail("STAGE_NOT_FOUND", "Stage does not exist in the current stage program version.");
  }
}

function assertTransferEffectiveFromIsNotFuture(effectiveFrom: Date) {
  if (Number.isNaN(effectiveFrom.getTime())) {
    fail("INVALID_DATE", "Transfer effective date is invalid.");
  }

  const effectiveDate = toDateOnly(effectiveFrom);
  const today = toDateOnly(new Date());
  if (effectiveDate.getTime() > today.getTime()) {
    fail("INVALID_DATE", "Future-dated transfers are not supported yet.");
  }
}

export async function createManagedTrainee(input: CreateManagedTraineeInput) {
  await getActiveGroupOrThrow(input.groupId, input.institutionId);
  await assertCanManageTrainees(input.actor, input.institutionId, { groupId: input.groupId });
  await assertStageInInstitution(input.currentStageId, input.institutionId);

  return createTraineeRecord({
    institutionId: input.institutionId,
    groupId: input.groupId,
    firstName: normalizeName(input.firstName, "First name"),
    lastName: normalizeName(input.lastName, "Last name"),
    currentStageId: input.currentStageId ?? null,
    movedById: input.actor.id,
    effectiveFrom: input.effectiveFrom ?? new Date(),
  });
}

export async function updateManagedTrainee(input: UpdateManagedTraineeInput) {
  const trainee = await getTraineeOrThrow(input.traineeId, input.institutionId);
  await assertCanManageTrainees(
    input.actor,
    input.institutionId,
    traineePermissionScope(input.traineeId, trainee.groupId),
  );
  await assertStageInInstitution(input.currentStageId, input.institutionId);

  return updateTraineeRecord({
    traineeId: input.traineeId,
    firstName: normalizeOptionalName(input.firstName, "First name"),
    lastName: normalizeOptionalName(input.lastName, "Last name"),
    active: input.active,
    currentStageId: input.currentStageId,
  });
}

export async function transferManagedTraineeGroup(input: TransferManagedTraineeGroupInput) {
  const trainee = await getTraineeOrThrow(input.traineeId, input.institutionId);
  await getActiveGroupOrThrow(input.toGroupId, input.institutionId);

  if (trainee.groupId === input.toGroupId) {
    fail("NOOP_TRANSFER", "Trainee is already assigned to the target group.");
  }

  await assertCanTransferTrainees(
    input.actor,
    input.institutionId,
    traineePermissionScope(input.traineeId, trainee.groupId),
  );
  await assertCanTransferTrainees(input.actor, input.institutionId, {
    groupId: input.toGroupId,
  });
  assertTransferEffectiveFromIsNotFuture(input.effectiveFrom);

  return transferTraineeGroupRecord({
    traineeId: input.traineeId,
    institutionId: input.institutionId,
    fromGroupId: trainee.groupId,
    toGroupId: input.toGroupId,
    effectiveFrom: input.effectiveFrom,
    movedById: input.actor.id,
    note: normalizeNote(input.note),
  });
}

export async function getTraineeGroupIdAtMeasurementDate(
  input: GetTraineeGroupAtMeasurementDateInput,
): Promise<string | null> {
  await getTraineeOrThrow(input.traineeId, input.institutionId);
  return getTraineeGroupIdAtDate(input.traineeId, input.measurementDate);
}
