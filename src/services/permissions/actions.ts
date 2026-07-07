import type { PermissionAction, StaffRole } from "@/generated/prisma/enums";

export const STAFF_ROLES = [
  "ADMIN",
  "LEAD_COORDINATOR",
  "COUNSELOR",
  "YOUTH_WORKER",
  "TRAINEE",
] as const satisfies readonly StaffRole[];

export const ALL_PERMISSION_ACTIONS = [
  "VIEW",
  "EDIT",
  "CHANGE_STAGE",
  "VIEW_REPORTS",
  "EDIT_SETTINGS",
  "MANAGE_PERMISSIONS",
  "MANAGE_GROUPS",
  "MANAGE_TRAINEES",
  "TRANSFER_TRAINEES",
  "ENTER_REPORTS",
  "EDIT_REPORTS",
  "MANAGE_STAGE_SETTINGS",
  "MANAGE_GROUP_SETTINGS",
  "MANAGE_TRAINEE_SETTINGS",
  "MANAGE_VACATIONS",
] as const satisfies readonly PermissionAction[];

export const MANAGEABLE_PERMISSION_ACTIONS = [
  "VIEW_REPORTS",
  "MANAGE_PERMISSIONS",
  "MANAGE_GROUPS",
  "MANAGE_TRAINEES",
  "TRANSFER_TRAINEES",
  "ENTER_REPORTS",
  "EDIT_REPORTS",
  "MANAGE_STAGE_SETTINGS",
  "MANAGE_GROUP_SETTINGS",
  "MANAGE_TRAINEE_SETTINGS",
  "MANAGE_VACATIONS",
] as const satisfies readonly PermissionAction[];

export const NEW_WRITE_PERMISSION_ACTIONS = [
  "MANAGE_GROUPS",
  "MANAGE_TRAINEES",
  "TRANSFER_TRAINEES",
  "ENTER_REPORTS",
  "EDIT_REPORTS",
  "MANAGE_STAGE_SETTINGS",
  "MANAGE_GROUP_SETTINGS",
  "MANAGE_TRAINEE_SETTINGS",
  "MANAGE_VACATIONS",
] as const satisfies readonly PermissionAction[];

export function isRolePermissionAllowedByDefault(role: StaffRole): boolean {
  return role === "ADMIN";
}
