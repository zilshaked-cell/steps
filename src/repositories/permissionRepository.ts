import { prisma } from "@/lib/prisma";
import type { PermissionAction, PermissionEffect, StaffRole } from "@/generated/prisma/enums";

export type RolePermissionSummary = {
  role: StaffRole;
  action: PermissionAction;
  allowed: boolean;
};

export type UserPermissionOverrideSummary = {
  id: string;
  action: PermissionAction;
  effect: PermissionEffect;
  staff: { name: string };
  group: { name: string } | null;
  trainee: { firstName: string; lastName: string } | null;
};

export function listRolePermissionsByInstitution(
  institutionId: string,
): Promise<RolePermissionSummary[]> {
  return prisma.rolePermission.findMany({
    where: { institutionId },
    select: { role: true, action: true, allowed: true },
    orderBy: [{ role: "asc" }, { action: "asc" }],
  });
}

export function listUserPermissionOverridesByInstitution(
  institutionId: string,
): Promise<UserPermissionOverrideSummary[]> {
  return prisma.userPermissionOverride.findMany({
    where: { institutionId },
    select: {
      id: true,
      action: true,
      effect: true,
      staff: { select: { name: true } },
      group: { select: { name: true } },
      trainee: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ staffId: "asc" }, { action: "asc" }, { createdAt: "asc" }],
  });
}
