import { prisma } from "@/lib/prisma";
import {
  ALL_PERMISSION_ACTIONS,
  STAFF_ROLES,
  isRolePermissionAllowedByDefault,
} from "./actions";

export async function ensureDefaultRolePermissions(institutionId: string) {
  return prisma.rolePermission.createMany({
    data: STAFF_ROLES.flatMap((role) =>
      ALL_PERMISSION_ACTIONS.map((action) => ({
        institutionId,
        role,
        action,
        allowed: isRolePermissionAllowedByDefault(role),
      })),
    ),
    skipDuplicates: true,
  });
}
