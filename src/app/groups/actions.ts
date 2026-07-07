"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  createManagedGroup,
  GroupMutationError,
  updateManagedGroup,
} from "@/services/groups/groupService";
import type { PermissionSubject } from "@/services/permissions/resolvePermission";

function requiredString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

function optionalString(formData: FormData, field: string): string | undefined {
  const value = formData.get(field);
  return typeof value === "string" ? value : undefined;
}

function staffIdsFromForm(formData: FormData): string[] {
  return formData
    .getAll("staffIds")
    .filter((value): value is string => typeof value === "string");
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

function groupErrorParam(error: GroupMutationError): string {
  return error.code.toLowerCase().replaceAll("_", "-");
}

function redirectWithGroupError(basePath: string, error: unknown): never {
  if (error instanceof GroupMutationError) {
    redirect(`${basePath}?groupError=${groupErrorParam(error)}`);
  }

  throw error;
}

export async function createGroupAction(formData: FormData) {
  const actor = await signedInActor();
  let groupId: string;

  try {
    const group = await createManagedGroup({
      actor,
      institutionId: actor.institutionId,
      name: requiredString(formData, "name"),
      description: optionalString(formData, "description"),
      staffIds: staffIdsFromForm(formData),
    });
    groupId = group.id;
  } catch (error) {
    redirectWithGroupError("/", error);
  }

  revalidatePath("/");
  redirect(`/groups/${groupId}?groupNotice=created`);
}

export async function updateGroupAction(formData: FormData) {
  const actor = await signedInActor();
  const groupId = requiredString(formData, "groupId");
  const groupPath = groupId ? `/groups/${groupId}` : "/";

  try {
    await updateManagedGroup({
      actor,
      institutionId: actor.institutionId,
      groupId,
      name: requiredString(formData, "name"),
      description: optionalString(formData, "description"),
      staffIds: staffIdsFromForm(formData),
    });
  } catch (error) {
    redirectWithGroupError(groupPath, error);
  }

  revalidatePath("/");
  revalidatePath(groupPath);
  redirect(`${groupPath}?groupNotice=updated`);
}

export async function setGroupActiveAction(formData: FormData) {
  const actor = await signedInActor();
  const groupId = requiredString(formData, "groupId");
  const groupPath = groupId ? `/groups/${groupId}` : "/";
  const active = requiredString(formData, "active") === "true";

  try {
    await updateManagedGroup({
      actor,
      institutionId: actor.institutionId,
      groupId,
      active,
    });
  } catch (error) {
    redirectWithGroupError(groupPath, error);
  }

  revalidatePath("/");
  revalidatePath(groupPath);
  redirect(`${groupPath}?groupNotice=${active ? "restored" : "archived"}`);
}
