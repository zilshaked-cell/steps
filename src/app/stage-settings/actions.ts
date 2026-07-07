"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  publishInstitutionScoringProfile,
  publishGroupScoringProfile,
  publishTraineeScoringProfile,
  saveInstitutionScoringProfileDraft,
  saveGroupScoringProfileDraft,
  saveTraineeScoringProfileDraft,
  StageSettingsMutationError,
  type InstitutionScoringProfileParameterInput,
  type LocalScoringProfileParameterInput,
} from "@/services/stagePrograms/stageSettingsService";
import type { ScoreScale } from "@/generated/prisma/enums";
import type { PermissionSubject } from "@/services/permissions/resolvePermission";

const SCORE_SCALES: ReadonlySet<string> = new Set([
  "ONE_TO_THREE",
  "ONE_TO_TEN",
  "ONE_TO_ONE_HUNDRED",
]);

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
  return value.startsWith("/") && !value.startsWith("//") ? value : "/stage-settings";
}

function withQueryParam(path: string, key: string, value: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
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

function stageSettingsErrorParam(error: StageSettingsMutationError): string {
  return error.code.toLowerCase().replaceAll("_", "-");
}

function redirectWithStageSettingsError(error: unknown, returnTo = "/stage-settings"): never {
  if (error instanceof StageSettingsMutationError) {
    redirect(withQueryParam(returnTo, "settingsError", stageSettingsErrorParam(error)));
  }

  throw error;
}

function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function readScoreScale(formData: FormData, field: string): ScoreScale | null {
  const value = requiredString(formData, field);
  return SCORE_SCALES.has(value) ? (value as ScoreScale) : null;
}

function readWeight(formData: FormData, field: string): number | null {
  const rawValue = requiredString(formData, field).trim();
  if (!rawValue) return null;
  const value = Number(rawValue);
  return Number.isFinite(value) ? value : null;
}

function readParameters(formData: FormData): InstitutionScoringProfileParameterInput[] {
  const rowCount = Number(requiredString(formData, "rowCount"));
  if (!Number.isInteger(rowCount) || rowCount < 1 || rowCount > 200) return [];

  const parameters: InstitutionScoringProfileParameterInput[] = [];
  for (let index = 0; index < rowCount; index += 1) {
    const sourceParameterDefinitionId = optionalId(formData, `sourceParameterDefinitionId_${index}`);
    const stageId = optionalId(formData, `stageId_${index}`);
    const name = requiredString(formData, `name_${index}`).trim();
    const verbalDefinition = optionalString(formData, `verbalDefinition_${index}`);
    const scoreScale = readScoreScale(formData, `scoreScale_${index}`);
    const weightPercent = readWeight(formData, `weightPercent_${index}`);
    const hasAnyValue =
      Boolean(sourceParameterDefinitionId) ||
      Boolean(stageId) ||
      Boolean(name) ||
      Boolean(verbalDefinition?.trim()) ||
      weightPercent !== null;

    if (!hasAnyValue) continue;
    if (!name || !scoreScale || weightPercent === null) return [];

    parameters.push({
      sourceParameterDefinitionId,
      stageId,
      name,
      verbalDefinition,
      scoreScale,
      weightPercent,
      active: requiredString(formData, `active_${index}`) === "true",
      displayOrder: index + 1,
    });
  }

  return parameters;
}

function readInheritedFlag(formData: FormData, field: string): boolean {
  return requiredString(formData, field) === "true";
}

function readLocalParameters(formData: FormData): LocalScoringProfileParameterInput[] {
  const rowCount = Number(requiredString(formData, "rowCount"));
  if (!Number.isInteger(rowCount) || rowCount < 1 || rowCount > 200) return [];

  const parameters: LocalScoringProfileParameterInput[] = [];
  for (let index = 0; index < rowCount; index += 1) {
    const sourceParameterDefinitionId = optionalId(formData, `sourceParameterDefinitionId_${index}`);
    const stageId = optionalId(formData, `stageId_${index}`);
    const name = requiredString(formData, `name_${index}`).trim();
    const verbalDefinition = optionalString(formData, `verbalDefinition_${index}`);
    const scoreScale = readScoreScale(formData, `scoreScale_${index}`);
    const weightPercent = readWeight(formData, `weightPercent_${index}`);
    const hasAnyValue =
      Boolean(sourceParameterDefinitionId) ||
      Boolean(stageId) ||
      Boolean(name) ||
      Boolean(verbalDefinition?.trim()) ||
      weightPercent !== null;

    if (!hasAnyValue) continue;
    if (!sourceParameterDefinitionId && (!name || !scoreScale || weightPercent === null)) return [];

    parameters.push({
      sourceParameterDefinitionId,
      stageId,
      name: sourceParameterDefinitionId && readInheritedFlag(formData, `inheritName_${index}`)
        ? null
        : name || null,
      verbalDefinition:
        sourceParameterDefinitionId && readInheritedFlag(formData, `inheritDefinition_${index}`)
          ? null
          : verbalDefinition,
      scoreScale:
        sourceParameterDefinitionId && readInheritedFlag(formData, `inheritScoreScale_${index}`)
          ? null
          : scoreScale,
      weightPercent:
        sourceParameterDefinitionId && readInheritedFlag(formData, `inheritWeight_${index}`)
          ? null
          : weightPercent,
      active: requiredString(formData, `active_${index}`) === "true",
      displayOrder: index + 1,
    });
  }

  return parameters;
}

export async function saveInstitutionStageSettingsDraftAction(formData: FormData) {
  const actor = await signedInActor();
  const parameters = readParameters(formData);
  if (parameters.length === 0) {
    redirect(withQueryParam("/stage-settings", "settingsError", "invalid-parameters"));
  }

  try {
    await saveInstitutionScoringProfileDraft({
      actor,
      institutionId: actor.institutionId,
      stageProgramVersionId: requiredString(formData, "stageProgramVersionId"),
      profileId: optionalId(formData, "profileId") ?? undefined,
      name: optionalString(formData, "profileName"),
      parameters,
    });
  } catch (error) {
    redirectWithStageSettingsError(error);
  }

  revalidatePath("/");
  revalidatePath("/stage-settings");
  redirect(withQueryParam("/stage-settings", "settingsNotice", "draft-saved"));
}

export async function publishInstitutionStageSettingsAction(formData: FormData) {
  const actor = await signedInActor();
  const effectiveFrom = parseDateOnly(requiredString(formData, "effectiveFrom"));
  if (!effectiveFrom) {
    redirect(withQueryParam("/stage-settings", "settingsError", "invalid-date"));
  }

  try {
    await publishInstitutionScoringProfile({
      actor,
      institutionId: actor.institutionId,
      profileId: requiredString(formData, "profileId"),
      effectiveFrom,
    });
  } catch (error) {
    redirectWithStageSettingsError(error);
  }

  revalidatePath("/");
  revalidatePath("/stage-settings");
  redirect(withQueryParam("/stage-settings", "settingsNotice", "published"));
}

export async function saveGroupStageSettingsDraftAction(formData: FormData) {
  const actor = await signedInActor();
  const returnTo = safeReturnPath(formData);
  const groupId = requiredString(formData, "groupId");
  const parameters = readLocalParameters(formData);
  if (parameters.length === 0) {
    redirect(withQueryParam(returnTo, "settingsError", "invalid-parameters"));
  }

  try {
    await saveGroupScoringProfileDraft({
      actor,
      institutionId: actor.institutionId,
      groupId,
      stageProgramVersionId: requiredString(formData, "stageProgramVersionId"),
      profileId: optionalId(formData, "profileId") ?? undefined,
      name: optionalString(formData, "profileName"),
      parameters,
    });
  } catch (error) {
    redirectWithStageSettingsError(error, returnTo);
  }

  revalidatePath(returnTo);
  revalidatePath(`/groups/${groupId}`);
  redirect(withQueryParam(returnTo, "settingsNotice", "draft-saved"));
}

export async function publishGroupStageSettingsAction(formData: FormData) {
  const actor = await signedInActor();
  const returnTo = safeReturnPath(formData);
  const groupId = requiredString(formData, "groupId");
  const effectiveFrom = parseDateOnly(requiredString(formData, "effectiveFrom"));
  if (!effectiveFrom) {
    redirect(withQueryParam(returnTo, "settingsError", "invalid-date"));
  }

  try {
    await publishGroupScoringProfile({
      actor,
      institutionId: actor.institutionId,
      groupId,
      profileId: requiredString(formData, "profileId"),
      effectiveFrom,
    });
  } catch (error) {
    redirectWithStageSettingsError(error, returnTo);
  }

  revalidatePath(returnTo);
  revalidatePath(`/groups/${groupId}`);
  redirect(withQueryParam(returnTo, "settingsNotice", "published"));
}

export async function saveTraineeStageSettingsDraftAction(formData: FormData) {
  const actor = await signedInActor();
  const returnTo = safeReturnPath(formData);
  const traineeId = requiredString(formData, "traineeId");
  const parameters = readLocalParameters(formData);
  if (parameters.length === 0) {
    redirect(withQueryParam(returnTo, "settingsError", "invalid-parameters"));
  }

  try {
    await saveTraineeScoringProfileDraft({
      actor,
      institutionId: actor.institutionId,
      traineeId,
      stageProgramVersionId: requiredString(formData, "stageProgramVersionId"),
      profileId: optionalId(formData, "profileId") ?? undefined,
      name: optionalString(formData, "profileName"),
      parameters,
    });
  } catch (error) {
    redirectWithStageSettingsError(error, returnTo);
  }

  revalidatePath(returnTo);
  revalidatePath(`/trainees/${traineeId}`);
  redirect(withQueryParam(returnTo, "settingsNotice", "draft-saved"));
}

export async function publishTraineeStageSettingsAction(formData: FormData) {
  const actor = await signedInActor();
  const returnTo = safeReturnPath(formData);
  const traineeId = requiredString(formData, "traineeId");
  const effectiveFrom = parseDateOnly(requiredString(formData, "effectiveFrom"));
  if (!effectiveFrom) {
    redirect(withQueryParam(returnTo, "settingsError", "invalid-date"));
  }

  try {
    await publishTraineeScoringProfile({
      actor,
      institutionId: actor.institutionId,
      traineeId,
      profileId: requiredString(formData, "profileId"),
      effectiveFrom,
    });
  } catch (error) {
    redirectWithStageSettingsError(error, returnTo);
  }

  revalidatePath(returnTo);
  revalidatePath(`/trainees/${traineeId}`);
  redirect(withQueryParam(returnTo, "settingsNotice", "published"));
}
