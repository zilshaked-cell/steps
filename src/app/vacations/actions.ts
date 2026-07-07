"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  createVacationPeriod,
  deleteVacationPeriod,
  updateVacationPeriod,
  VacationMutationError,
} from "@/services/vacations/vacationService";
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

function safeReturnPath(formData: FormData): string {
  const value = requiredString(formData, "returnTo");
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function withQueryParam(path: string, key: string, value: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
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

function vacationErrorParam(error: VacationMutationError): string {
  return error.code.toLowerCase().replaceAll("_", "-");
}

function redirectWithVacationError(returnTo: string, error: unknown): never {
  if (error instanceof VacationMutationError) {
    redirect(withQueryParam(returnTo, "vacationError", vacationErrorParam(error)));
  }

  throw error;
}

function readDateOrRedirect(formData: FormData, field: string, returnTo: string): Date {
  const date = dateOnlyFromInput(requiredString(formData, field));
  if (!date) redirect(withQueryParam(returnTo, "vacationError", "invalid-date"));
  return date;
}

export async function createVacationAction(formData: FormData) {
  const actor = await signedInActor();
  const returnTo = safeReturnPath(formData);

  try {
    await createVacationPeriod({
      actor,
      institutionId: actor.institutionId,
      groupId: optionalId(formData, "groupId"),
      traineeId: optionalId(formData, "traineeId"),
      title: requiredString(formData, "title"),
      note: optionalString(formData, "note"),
      startsOn: readDateOrRedirect(formData, "startsOn", returnTo),
      endsOn: readDateOrRedirect(formData, "endsOn", returnTo),
    });
  } catch (error) {
    redirectWithVacationError(returnTo, error);
  }

  revalidatePath(returnTo);
  redirect(withQueryParam(returnTo, "vacationNotice", "created"));
}

export async function updateVacationAction(formData: FormData) {
  const actor = await signedInActor();
  const returnTo = safeReturnPath(formData);

  try {
    await updateVacationPeriod({
      actor,
      institutionId: actor.institutionId,
      id: requiredString(formData, "vacationId"),
      title: requiredString(formData, "title"),
      note: optionalString(formData, "note"),
      startsOn: readDateOrRedirect(formData, "startsOn", returnTo),
      endsOn: readDateOrRedirect(formData, "endsOn", returnTo),
    });
  } catch (error) {
    redirectWithVacationError(returnTo, error);
  }

  revalidatePath(returnTo);
  redirect(withQueryParam(returnTo, "vacationNotice", "updated"));
}

export async function deleteVacationAction(formData: FormData) {
  const actor = await signedInActor();
  const returnTo = safeReturnPath(formData);

  try {
    await deleteVacationPeriod({
      actor,
      institutionId: actor.institutionId,
      id: requiredString(formData, "vacationId"),
    });
  } catch (error) {
    redirectWithVacationError(returnTo, error);
  }

  revalidatePath(returnTo);
  redirect(withQueryParam(returnTo, "vacationNotice", "deleted"));
}
