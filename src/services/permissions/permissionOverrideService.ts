import { prisma } from "@/lib/prisma";
import type { PermissionAction, PermissionEffect } from "@/generated/prisma/enums";
import type { Prisma, UserPermissionOverride } from "@/generated/prisma/client";

export type PermissionOverrideValidationCode =
  | "MALFORMED_SCOPE"
  | "STAFF_OUT_OF_SCOPE"
  | "GROUP_OUT_OF_SCOPE"
  | "TRAINEE_OUT_OF_SCOPE";

export class PermissionOverrideValidationError extends Error {
  constructor(
    readonly code: PermissionOverrideValidationCode,
    message: string,
  ) {
    super(message);
    this.name = "PermissionOverrideValidationError";
  }
}

export interface UpsertUserPermissionOverrideInput {
  institutionId: string;
  staffId: string;
  action: PermissionAction;
  effect: PermissionEffect;
  groupId?: string | null;
  traineeId?: string | null;
}

function fail(code: PermissionOverrideValidationCode, message: string): never {
  throw new PermissionOverrideValidationError(code, message);
}

function sameScopeWhere(
  input: UpsertUserPermissionOverrideInput,
): Pick<Prisma.UserPermissionOverrideWhereInput, "groupId" | "traineeId"> {
  if (input.groupId) return { groupId: input.groupId, traineeId: null };
  if (input.traineeId) return { groupId: null, traineeId: input.traineeId };
  return { groupId: null, traineeId: null };
}

async function assertPermissionOverrideScope(input: UpsertUserPermissionOverrideInput) {
  if (input.groupId && input.traineeId) {
    fail("MALFORMED_SCOPE", "Permission override scope cannot include both groupId and traineeId.");
  }

  const staff = await prisma.staffUser.findUnique({
    where: { id: input.staffId },
    select: { institutionId: true },
  });
  if (!staff || staff.institutionId !== input.institutionId) {
    fail("STAFF_OUT_OF_SCOPE", "Permission override staff user does not belong to institution.");
  }

  if (input.groupId) {
    const group = await prisma.group.findUnique({
      where: { id: input.groupId },
      select: { institutionId: true },
    });
    if (!group || group.institutionId !== input.institutionId) {
      fail("GROUP_OUT_OF_SCOPE", "Permission override group does not belong to institution.");
    }
  }

  if (input.traineeId) {
    const trainee = await prisma.trainee.findUnique({
      where: { id: input.traineeId },
      select: { institutionId: true },
    });
    if (!trainee || trainee.institutionId !== input.institutionId) {
      fail("TRAINEE_OUT_OF_SCOPE", "Permission override trainee does not belong to institution.");
    }
  }
}

export async function upsertUserPermissionOverride(
  input: UpsertUserPermissionOverrideInput,
): Promise<UserPermissionOverride> {
  await assertPermissionOverrideScope(input);

  const scopeWhere = sameScopeWhere(input);
  const where = {
    institutionId: input.institutionId,
    staffId: input.staffId,
    action: input.action,
    ...scopeWhere,
  };

  return prisma.$transaction(async (tx) => {
    const matching = await tx.userPermissionOverride.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const [primary, ...duplicates] = matching;

    if (!primary) {
      return tx.userPermissionOverride.create({
        data: {
          institutionId: input.institutionId,
          staffId: input.staffId,
          action: input.action,
          effect: input.effect,
          groupId: input.groupId ?? null,
          traineeId: input.traineeId ?? null,
        },
      });
    }

    if (duplicates.length > 0) {
      await tx.userPermissionOverride.deleteMany({
        where: { id: { in: duplicates.map((override) => override.id) } },
      });
    }

    return tx.userPermissionOverride.update({
      where: { id: primary.id },
      data: { effect: input.effect },
    });
  });
}
