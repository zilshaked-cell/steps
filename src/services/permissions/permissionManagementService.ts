import { prisma } from "@/lib/prisma";
import {
  upsertUserPermissionOverride,
  type UpsertUserPermissionOverrideInput,
} from "@/services/permissions/permissionOverrideService";
import { resolvePermission, type PermissionSubject } from "@/services/permissions/resolvePermission";
import type { PermissionAction, PermissionEffect, StaffRole } from "@/generated/prisma/enums";
import type { Prisma, RolePermission, UserPermissionOverride } from "@/generated/prisma/client";

export type PermissionManagementErrorCode =
  | "ACTOR_OUT_OF_SCOPE"
  | "FORBIDDEN"
  | "INSTITUTION_NOT_FOUND";

export class PermissionManagementError extends Error {
  constructor(
    readonly code: PermissionManagementErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PermissionManagementError";
  }
}

export interface SetManagedRolePermissionInput {
  actor: PermissionSubject;
  institutionId: string;
  role: StaffRole;
  action: PermissionAction;
  allowed: boolean;
}

export interface SetManagedUserPermissionOverrideInput {
  actor: PermissionSubject;
  institutionId: string;
  staffId: string;
  action: PermissionAction;
  effect: PermissionEffect;
  groupId?: string | null;
  traineeId?: string | null;
}

function fail(code: PermissionManagementErrorCode, message: string): never {
  throw new PermissionManagementError(code, message);
}

async function assertCanManagePermissions(actor: PermissionSubject, institutionId: string) {
  if (actor.institutionId !== institutionId) {
    fail("ACTOR_OUT_OF_SCOPE", "Actor does not belong to the target institution.");
  }

  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
    select: { id: true },
  });
  if (!institution) {
    fail("INSTITUTION_NOT_FOUND", "Target institution was not found.");
  }

  const allowed = await resolvePermission(actor, "MANAGE_PERMISSIONS");
  if (!allowed) fail("FORBIDDEN", "Actor is not allowed to manage permissions.");
}

function auditMetadata(metadata: Prisma.InputJsonObject): Prisma.InputJsonValue {
  return metadata;
}

export async function setManagedRolePermission(
  input: SetManagedRolePermissionInput,
): Promise<RolePermission> {
  await assertCanManagePermissions(input.actor, input.institutionId);

  return prisma.$transaction(async (tx) => {
    const permission = await tx.rolePermission.upsert({
      where: {
        institutionId_role_action: {
          institutionId: input.institutionId,
          role: input.role,
          action: input.action,
        },
      },
      create: {
        institutionId: input.institutionId,
        role: input.role,
        action: input.action,
        allowed: input.allowed,
      },
      update: { allowed: input.allowed },
    });

    await tx.auditLogEntry.create({
      data: {
        institutionId: input.institutionId,
        actorId: input.actor.id,
        action: "PERMISSION.ROLE_SET",
        metadata: auditMetadata({
          role: input.role,
          permissionAction: input.action,
          allowed: input.allowed,
        }),
      },
    });

    return permission;
  });
}

export async function setManagedUserPermissionOverride(
  input: SetManagedUserPermissionOverrideInput,
): Promise<UserPermissionOverride> {
  await assertCanManagePermissions(input.actor, input.institutionId);

  const overrideInput: UpsertUserPermissionOverrideInput = {
    institutionId: input.institutionId,
    staffId: input.staffId,
    action: input.action,
    effect: input.effect,
    groupId: input.groupId ?? null,
    traineeId: input.traineeId ?? null,
  };

  return prisma.$transaction(async (tx) => {
    const override = await upsertUserPermissionOverride(overrideInput, tx);

    await tx.auditLogEntry.create({
      data: {
        institutionId: input.institutionId,
        actorId: input.actor.id,
        action: "PERMISSION.USER_OVERRIDE_SET",
        metadata: auditMetadata({
          staffId: input.staffId,
          permissionAction: input.action,
          effect: input.effect,
          groupId: input.groupId ?? null,
          traineeId: input.traineeId ?? null,
        }),
      },
    });

    return override;
  });
}
