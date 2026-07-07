import { prisma } from "@/lib/prisma";
import {
  createGroupRecord,
  getGroupById,
  updateGroupRecord,
} from "@/repositories/groupRepository";
import {
  resolvePermission,
  type PermissionSubject,
  type PermissionScope,
} from "@/services/permissions/resolvePermission";

export type GroupMutationErrorCode =
  | "ACTOR_OUT_OF_SCOPE"
  | "FORBIDDEN"
  | "GROUP_NOT_FOUND"
  | "INVALID_NAME"
  | "STAFF_OUT_OF_SCOPE";

export class GroupMutationError extends Error {
  constructor(
    readonly code: GroupMutationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GroupMutationError";
  }
}

export interface CreateManagedGroupInput {
  actor: PermissionSubject;
  institutionId: string;
  name: string;
  description?: string | null;
  active?: boolean;
  staffIds?: string[];
}

export interface UpdateManagedGroupInput {
  actor: PermissionSubject;
  institutionId: string;
  groupId: string;
  name?: string;
  description?: string | null;
  active?: boolean;
  staffIds?: string[];
}

function fail(code: GroupMutationErrorCode, message: string): never {
  throw new GroupMutationError(code, message);
}

function normalizeName(name: string): string {
  const normalized = name.trim();
  if (!normalized) fail("INVALID_NAME", "Group name cannot be empty.");
  return normalized;
}

function normalizeDescription(description: string | null | undefined): string | null | undefined {
  if (description === undefined) return undefined;
  const normalized = description?.trim() ?? "";
  return normalized ? normalized : null;
}

function uniqueStaffIds(staffIds: string[] | undefined): string[] | undefined {
  if (!staffIds) return undefined;
  return [...new Set(staffIds.map((staffId) => staffId.trim()).filter(Boolean))];
}

async function assertCanManageGroups(
  actor: PermissionSubject,
  institutionId: string,
  scope: PermissionScope = {},
) {
  if (actor.institutionId !== institutionId) {
    fail("ACTOR_OUT_OF_SCOPE", "Actor does not belong to the target institution.");
  }

  const allowed = await resolvePermission(actor, "MANAGE_GROUPS", scope);
  if (!allowed) fail("FORBIDDEN", "Actor is not allowed to manage groups.");
}

async function assertStaffInInstitution(institutionId: string, staffIds: string[] | undefined) {
  if (!staffIds || staffIds.length === 0) return;

  const staff = await prisma.staffUser.findMany({
    where: { id: { in: staffIds }, institutionId, active: true },
    select: { id: true },
  });
  if (staff.length !== staffIds.length) {
    fail("STAFF_OUT_OF_SCOPE", "All assigned staff users must be active members of the institution.");
  }
}

export async function createManagedGroup(input: CreateManagedGroupInput) {
  await assertCanManageGroups(input.actor, input.institutionId);

  const staffIds = uniqueStaffIds(input.staffIds);
  await assertStaffInInstitution(input.institutionId, staffIds);

  return createGroupRecord({
    institutionId: input.institutionId,
    name: normalizeName(input.name),
    description: normalizeDescription(input.description),
    active: input.active ?? true,
    staffIds,
  });
}

export async function updateManagedGroup(input: UpdateManagedGroupInput) {
  const existing = await getGroupById(input.groupId);
  if (!existing || existing.institutionId !== input.institutionId) {
    fail("GROUP_NOT_FOUND", "Group does not exist in the target institution.");
  }

  await assertCanManageGroups(input.actor, input.institutionId, { groupId: input.groupId });

  const staffIds = uniqueStaffIds(input.staffIds);
  await assertStaffInInstitution(input.institutionId, staffIds);

  return updateGroupRecord({
    groupId: input.groupId,
    name: input.name === undefined ? undefined : normalizeName(input.name),
    description: normalizeDescription(input.description),
    active: input.active,
    staffIds,
  });
}
