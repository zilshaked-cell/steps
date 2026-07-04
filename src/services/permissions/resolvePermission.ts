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

// Precedence, per team decision: a per-user override (allow OR deny) always wins over
// the institution's role default, and among overrides the most specific scope wins
// (trainee-scoped > group-scoped > institution-wide). Falls back to false (no access)
// when neither an override nor a role default grants the action — deny by default.
export async function resolvePermission(
  subject: PermissionSubject,
  action: PermissionAction,
  scope: PermissionScope = {},
): Promise<boolean> {
  const overrides = await prisma.userPermissionOverride.findMany({
    where: { staffId: subject.id, action },
  });

  const applicable = overrides.filter((override) => {
    if (override.traineeId) return override.traineeId === scope.traineeId;
    if (override.groupId) return override.groupId === scope.groupId;
    return true;
  });

  if (applicable.length > 0) {
    const mostSpecific = applicable.sort((a, b) => specificity(b) - specificity(a))[0];
    return mostSpecific.effect === "ALLOW";
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
