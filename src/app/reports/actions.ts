"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  publishTraineeReport,
  ReportMutationError,
  saveTraineeReportDraft,
  type ReportEntryInput,
} from "@/services/reports/reportService";
import type { ParameterEntryStatus } from "@/generated/prisma/enums";
import type { PermissionSubject } from "@/services/permissions/resolvePermission";

const ENTRY_STATUSES: ReadonlySet<string> = new Set([
  "SCORED",
  "NOT_SCORED",
  "NOT_APPLICABLE",
]);

function requiredString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

function optionalId(formData: FormData, field: string): string | null {
  const value = requiredString(formData, field).trim();
  return value ? value : null;
}

function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function safeReturnPath(formData: FormData, fallback: string): string {
  const value = requiredString(formData, "returnTo");
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

function withQueryParam(path: string, key: string, value: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

function reportErrorParam(error: ReportMutationError): string {
  return error.code.toLowerCase().replaceAll("_", "-");
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

function redirectWithReportError(error: unknown, returnTo: string): never {
  if (error instanceof ReportMutationError) {
    redirect(withQueryParam(returnTo, "reportError", reportErrorParam(error)));
  }

  throw error;
}

function readStatus(formData: FormData, field: string): ParameterEntryStatus | null {
  const value = requiredString(formData, field);
  return ENTRY_STATUSES.has(value) ? (value as ParameterEntryStatus) : null;
}

function readRawScore(formData: FormData, field: string): number | null {
  const value = requiredString(formData, field).trim();
  if (!value) return null;
  return Number(value);
}

function readEntries(formData: FormData): ReportEntryInput[] {
  const rowCount = Number(requiredString(formData, "rowCount"));
  if (!Number.isInteger(rowCount) || rowCount < 1 || rowCount > 200) return [];

  const entries: ReportEntryInput[] = [];
  for (let index = 0; index < rowCount; index += 1) {
    const parameterDefinitionId = optionalId(formData, `parameterDefinitionId_${index}`);
    const scoringProfileParameterId = optionalId(formData, `scoringProfileParameterId_${index}`);
    const status = readStatus(formData, `status_${index}`);
    if ((!parameterDefinitionId && !scoringProfileParameterId) || !status) return [];

    entries.push({
      parameterDefinitionId,
      scoringProfileParameterId,
      status,
      rawScore: readRawScore(formData, `rawScore_${index}`),
    });
  }

  return entries;
}

async function mutateReport(
  formData: FormData,
  mutation: typeof saveTraineeReportDraft | typeof publishTraineeReport,
  notice: string,
) {
  const actor = await signedInActor();
  const traineeId = requiredString(formData, "traineeId");
  const fallback = traineeId ? `/trainees/${traineeId}/report` : "/";
  const returnTo = safeReturnPath(formData, fallback);
  const measurementDate = parseDateOnly(requiredString(formData, "measurementDate"));
  const entries = readEntries(formData);

  if (!traineeId || !measurementDate) {
    redirect(withQueryParam(returnTo, "reportError", "invalid-date"));
  }
  if (entries.length === 0) {
    redirect(withQueryParam(returnTo, "reportError", "invalid-entries"));
  }

  try {
    const report = await mutation({
      actor,
      institutionId: actor.institutionId,
      traineeId,
      measurementDate,
      note: requiredString(formData, "note"),
      entries,
    });

    revalidatePath(`/trainees/${traineeId}`);
    revalidatePath(`/trainees/${traineeId}/report`);
    if (report.groupId) revalidatePath(`/groups/${report.groupId}`);
  } catch (error) {
    redirectWithReportError(error, returnTo);
  }

  redirect(withQueryParam(returnTo, "reportNotice", notice));
}

export async function saveReportDraftAction(formData: FormData) {
  await mutateReport(formData, saveTraineeReportDraft, "draft-saved");
}

export async function publishReportAction(formData: FormData) {
  await mutateReport(formData, publishTraineeReport, "published");
}
