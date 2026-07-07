"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  createManagedTrainee,
  TraineeMutationError,
  transferManagedTraineeGroup,
  updateManagedTrainee,
} from "@/services/trainees/traineeService";
import type { PermissionSubject } from "@/services/permissions/resolvePermission";

function requiredString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

function optionalString(formData: FormData, field: string): string | undefined {
  const value = formData.get(field);
  return typeof value === "string" ? value : undefined;
}

function optionalId(formData: FormData, field: string): string | null {
  const value = optionalString(formData, field)?.trim();
  return value ? value : null;
}

function dateOnlyFromInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
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

function traineeErrorParam(error: TraineeMutationError): string {
  return error.code.toLowerCase().replaceAll("_", "-");
}

function redirectWithTraineeError(basePath: string, error: unknown): never {
  if (error instanceof TraineeMutationError) {
    redirect(`${basePath}?traineeError=${traineeErrorParam(error)}`);
  }

  throw error;
}

export async function createTraineeAction(formData: FormData) {
  const actor = await signedInActor();
  const groupId = requiredString(formData, "groupId");
  const groupPath = groupId ? `/groups/${groupId}` : "/";
  let traineeId: string;

  try {
    const trainee = await createManagedTrainee({
      actor,
      institutionId: actor.institutionId,
      groupId,
      firstName: requiredString(formData, "firstName"),
      lastName: requiredString(formData, "lastName"),
      currentStageId: optionalId(formData, "currentStageId"),
    });
    traineeId = trainee.id;
  } catch (error) {
    redirectWithTraineeError(groupPath, error);
  }

  revalidatePath(groupPath);
  redirect(`/trainees/${traineeId}?traineeNotice=created`);
}

export async function updateTraineeAction(formData: FormData) {
  const actor = await signedInActor();
  const traineeId = requiredString(formData, "traineeId");
  const currentGroupId = optionalId(formData, "currentGroupId");
  const traineePath = traineeId ? `/trainees/${traineeId}` : "/";
  const groupPath = currentGroupId ? `/groups/${currentGroupId}` : null;

  try {
    await updateManagedTrainee({
      actor,
      institutionId: actor.institutionId,
      traineeId,
      firstName: requiredString(formData, "firstName"),
      lastName: requiredString(formData, "lastName"),
      currentStageId: optionalId(formData, "currentStageId"),
    });
  } catch (error) {
    redirectWithTraineeError(traineePath, error);
  }

  if (groupPath) revalidatePath(groupPath);
  revalidatePath(traineePath);
  redirect(`${traineePath}?traineeNotice=updated`);
}

export async function transferTraineeAction(formData: FormData) {
  const actor = await signedInActor();
  const traineeId = requiredString(formData, "traineeId");
  const currentGroupId = optionalId(formData, "currentGroupId");
  const toGroupId = requiredString(formData, "toGroupId");
  const traineePath = traineeId ? `/trainees/${traineeId}` : "/";
  const effectiveFrom = dateOnlyFromInput(requiredString(formData, "effectiveFrom"));

  if (!effectiveFrom) redirect(`${traineePath}?traineeError=invalid-date`);

  try {
    await transferManagedTraineeGroup({
      actor,
      institutionId: actor.institutionId,
      traineeId,
      toGroupId,
      effectiveFrom,
      note: optionalString(formData, "note"),
    });
  } catch (error) {
    redirectWithTraineeError(traineePath, error);
  }

  if (currentGroupId) revalidatePath(`/groups/${currentGroupId}`);
  revalidatePath(`/groups/${toGroupId}`);
  revalidatePath(traineePath);
  redirect(`${traineePath}?traineeNotice=transferred`);
}
