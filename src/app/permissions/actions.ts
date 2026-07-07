"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PermissionOverrideValidationError } from "@/services/permissions/permissionOverrideService";
import {
  PermissionManagementError,
  setManagedRolePermission,
  setManagedUserPermissionOverride,
} from "@/services/permissions/permissionManagementService";
import type {
  PermissionAction,
  PermissionEffect,
  StaffRole,
} from "@/generated/prisma/enums";
import type { PermissionSubject } from "@/services/permissions/resolvePermission";

function requiredString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

function optionalId(formData: FormData, field: string): string | null {
  const value = requiredString(formData, field).trim();
  return value ? value : null;
}

function malformedScope(message: string): never {
  throw new PermissionOverrideValidationError("MALFORMED_SCOPE", message);
}

function permissionOverrideScope(formData: FormData): {
  groupId: string | null;
  traineeId: string | null;
} {
  const scopeType = requiredString(formData, "scopeType");

  if (scopeType === "institution") {
    return { groupId: null, traineeId: null };
  }

  if (scopeType === "group") {
    const groupId = optionalId(formData, "groupId");
    if (!groupId) malformedScope("Group scope requires a selected group.");
    return { groupId, traineeId: null };
  }

  if (scopeType === "trainee") {
    const traineeId = optionalId(formData, "traineeId");
    if (!traineeId) malformedScope("Trainee scope requires a selected trainee.");
    return { groupId: null, traineeId };
  }

  malformedScope("Permission override scope must be institution, group, or trainee.");
}

async function signedInActor(): Promise<PermissionSubject> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return {
    id: session.user.id,
    institutionId: session.user.institutionId,
    role: session.user.role,
  };
}

function permissionErrorParam(error: PermissionManagementError | PermissionOverrideValidationError) {
  return error.code.toLowerCase().replaceAll("_", "-");
}

function redirectWithPermissionError(error: unknown): never {
  if (
    error instanceof PermissionManagementError ||
    error instanceof PermissionOverrideValidationError
  ) {
    redirect(`/permissions?permissionError=${permissionErrorParam(error)}`);
  }

  throw error;
}

export async function setRolePermissionAction(formData: FormData) {
  const actor = await signedInActor();

  try {
    await setManagedRolePermission({
      actor,
      institutionId: actor.institutionId,
      role: requiredString(formData, "role") as StaffRole,
      action: requiredString(formData, "action") as PermissionAction,
      allowed: requiredString(formData, "allowed") === "true",
    });
  } catch (error) {
    redirectWithPermissionError(error);
  }

  revalidatePath("/permissions");
  redirect("/permissions?permissionNotice=role-updated");
}

export async function setUserPermissionOverrideAction(formData: FormData) {
  const actor = await signedInActor();

  try {
    const scope = permissionOverrideScope(formData);
    await setManagedUserPermissionOverride({
      actor,
      institutionId: actor.institutionId,
      staffId: requiredString(formData, "staffId"),
      action: requiredString(formData, "action") as PermissionAction,
      effect: requiredString(formData, "effect") as PermissionEffect,
      groupId: scope.groupId,
      traineeId: scope.traineeId,
    });
  } catch (error) {
    redirectWithPermissionError(error);
  }

  revalidatePath("/permissions");
  redirect("/permissions?permissionNotice=override-updated");
}
