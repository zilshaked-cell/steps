import { prisma } from "@/lib/prisma";
import type { PermissionAction, StaffRole } from "@/generated/prisma/enums";

export interface PermissionSubject {
  id: string;
  institutionId: string;
  role: StaffRole;
}

export interface PermissionScope {
  groupId?: string | null;
  traineeId?: string | null;
}

function specificity(override: { groupId: string | null; traineeId: string | null }): number {
  if (override.traineeId) return 2;
  if (override.groupId) return 1;
  return 0;
}

function isMalformedOverride(override: { groupId: string | null; traineeId: string | null }) {
  return Boolean(override.groupId && override.traineeId);
}

function malformedOverrideTouchesScope(
  override: { groupId: string | null; traineeId: string | null },
  scope: PermissionScope,
): boolean {
  return Boolean(
    (override.groupId && override.groupId === scope.groupId) ||
      (override.traineeId && override.traineeId === scope.traineeId),
  );
}

// Precedence, per team decision: a per-user override (allow OR deny) always wins over
// the institution's role default, and among overrides the most specific scope wins
// (trainee-scoped > group-scoped > institution-wide). When multiple overrides tie at
// the same specificity (e.g. two group-scoped rows for the same action), DENY wins
// the tie — a fail-safe default instead of depending on arbitrary row order. Falls
// back to false (no access) when neither an override nor a role default grants the
// action — deny by default.
//
// Ownership of scope.groupId/scope.traineeId is verified against the database here,
// not trusted from the caller: a caller that passes an id belonging to a different
// institution than `subject` is denied, regardless of what it claims.
export async function resolvePermission(
  subject: PermissionSubject,
  action: PermissionAction,
  scope: PermissionScope = {},
): Promise<boolean> {
  let scopedTrainee: { institutionId: string; groupId: string | null } | null = null;

  if (scope.traineeId) {
    scopedTrainee = await prisma.trainee.findUnique({
      where: { id: scope.traineeId },
      select: { institutionId: true, groupId: true },
    });
    if (!scopedTrainee || scopedTrainee.institutionId !== subject.institutionId) return false;
  }

  if (scope.groupId) {
    const group = await prisma.group.findUnique({
      where: { id: scope.groupId },
      select: { institutionId: true },
    });
    if (!group || group.institutionId !== subject.institutionId) return false;
  }

  if (scope.groupId && scopedTrainee && scopedTrainee.groupId !== scope.groupId) {
    return false;
  }

  const overrides = await prisma.userPermissionOverride.findMany({
    where: { institutionId: subject.institutionId, staffId: subject.id, action },
  });

  if (
    overrides.some(
      (override) => isMalformedOverride(override) && malformedOverrideTouchesScope(override, scope),
    )
  ) {
    return false;
  }

  const applicable = overrides.filter((override) => {
    if (isMalformedOverride(override)) return false;
    if (override.traineeId) return override.traineeId === scope.traineeId;
    if (override.groupId) return override.groupId === scope.groupId;
    return true;
  });

  if (applicable.length > 0) {
    const highestSpecificity = Math.max(...applicable.map(specificity));
    const tiedAtHighest = applicable.filter(
      (override) => specificity(override) === highestSpecificity,
    );
    const anyDeny = tiedAtHighest.some((override) => override.effect === "DENY");
    return !anyDeny;
  }

  const roleDefault = await prisma.rolePermission.findUnique({
    where: {
      institutionId_role_action: {
        institutionId: subject.institutionId,
        role: subject.role,
        action,
      },
    },
  });

  return roleDefault?.allowed ?? false;
}
