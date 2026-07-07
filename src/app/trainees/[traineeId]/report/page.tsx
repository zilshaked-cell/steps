import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/app/AppShell";
import {
  publishReportAction,
  saveReportDraftAction,
} from "@/app/reports/actions";
import {
  reportErrorMessage,
  reportNoticeMessage,
  type SearchParamValue,
} from "@/app/reports/reportActionMessages";
import styles from "@/app/page.module.css";
import { auth } from "@/lib/auth";
import { getTraineeById } from "@/repositories/traineeRepository";
import { resolvePermission } from "@/services/permissions/resolvePermission";
import {
  getTraineeReportFormData,
  ReportMutationError,
  type ReportFormParameter,
} from "@/services/reports/reportService";
import type { ParameterEntryStatus, ScoreScale } from "@/generated/prisma/enums";

type ReportPageProps = {
  params: Promise<{ traineeId: string }>;
  searchParams?: Promise<{
    date?: SearchParamValue;
    reportError?: SearchParamValue;
    reportNotice?: SearchParamValue;
  }>;
};

const STATUS_LABELS: Record<ParameterEntryStatus, string> = {
  SCORED: "נוקד",
  NOT_SCORED: "לא נוקד",
  NOT_APPLICABLE: "לא רלוונטי",
};

const SCORE_SCALE_LABELS: Record<ScoreScale, string> = {
  ONE_TO_THREE: "1-3",
  ONE_TO_TEN: "1-10",
  ONE_TO_ONE_HUNDRED: "1-100",
};

function firstSearchParam(value: SearchParamValue): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function dateInputValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseSelectedDate(value: SearchParamValue): Date {
  const key = firstSearchParam(value);
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return new Date();
  const date = new Date(`${key}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function shortDate(date: Date): string {
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeZone: "UTC" }).format(date);
}

function dayOptions(selectedDate: Date): Date[] {
  const today = new Date();
  const selectedKey = dateInputValue(selectedDate);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    date.setUTCDate(date.getUTCDate() - index);
    return date;
  });

  if (!days.some((date) => dateInputValue(date) === selectedKey)) {
    return [selectedDate, ...days];
  }
  return days;
}

function scoreHelp(parameter: ReportFormParameter): string {
  return `סולם ${SCORE_SCALE_LABELS[parameter.scoreScale]}, ציון 1-${parameter.maxRawScore}`;
}

function reportStatusLabel(status: "DRAFT" | "PUBLISHED" | null): string {
  if (status === "DRAFT") return "טיוטה להמשך";
  if (status === "PUBLISHED") return "פורסם";
  return "פנוי לדיווח";
}

function reportErrorParam(error: ReportMutationError): string {
  return error.code.toLowerCase().replaceAll("_", "-");
}

function ParameterRows({ parameters }: { parameters: ReportFormParameter[] }) {
  return (
    <>
      <input type="hidden" name="rowCount" value={parameters.length} />
      <div className={styles.tableWrap}>
        <table className={`${styles.dataTable} ${styles.settingsTable}`} aria-label="פרמטרים לדיווח">
          <thead>
            <tr>
              <th scope="col">פרמטר</th>
              <th scope="col">סטטוס</th>
              <th scope="col">ציון</th>
            </tr>
          </thead>
          <tbody>
            {parameters.map((parameter, index) => (
              <tr key={parameter.key}>
                <td>
                  {parameter.parameterDefinitionId && (
                    <input
                      type="hidden"
                      name={`parameterDefinitionId_${index}`}
                      value={parameter.parameterDefinitionId}
                    />
                  )}
                  {parameter.scoringProfileParameterId && (
                    <input
                      type="hidden"
                      name={`scoringProfileParameterId_${index}`}
                      value={parameter.scoringProfileParameterId}
                    />
                  )}
                  <strong>{parameter.name}</strong>
                  <p className={styles.mutedText}>{scoreHelp(parameter)}</p>
                </td>
                <td>
                  <select name={`status_${index}`} defaultValue={parameter.status} aria-label="סטטוס פרמטר">
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    name={`rawScore_${index}`}
                    type="number"
                    min="1"
                    max={parameter.maxRawScore}
                    step="1"
                    defaultValue={parameter.rawScore ?? ""}
                    aria-label={`ציון עבור ${parameter.name}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default async function TraineeReportEntryPage({ params, searchParams }: ReportPageProps) {
  const { traineeId } = await params;
  const query = searchParams ? await searchParams : {};
  const selectedDate = parseSelectedDate(query.date);
  const selectedDateKey = dateInputValue(selectedDate);
  const session = await auth();

  if (!session?.user) {
    return (
      <AppShell>
        <section className={styles.emptyState}>
          <h1>נדרשת התחברות</h1>
          <p>יש להתחבר כדי למלא דיווח.</p>
          <Link href="/login" className={styles.primaryButton}>
            התחברות
          </Link>
        </section>
      </AppShell>
    );
  }

  const trainee = await getTraineeById(traineeId);
  if (!trainee) notFound();
  if (trainee.institutionId !== session.user.institutionId) notFound();

  const actor = {
    id: session.user.id,
    institutionId: session.user.institutionId,
    role: session.user.role,
  };
  let formData;
  try {
    formData = await getTraineeReportFormData({
      institutionId: trainee.institutionId,
      traineeId: trainee.id,
      measurementDate: selectedDate,
    });
  } catch (error) {
    if (error instanceof ReportMutationError) {
      return (
        <AppShell user={session.user} backHref={`/trainees/${trainee.id}`} backLabel="חזרה לחניך">
          <section className={styles.emptyState}>
            <h1>לא ניתן לפתוח דיווח</h1>
            <p>{reportErrorMessage(reportErrorParam(error))}</p>
          </section>
        </AppShell>
      );
    }
    throw error;
  }

  const reportScope = { traineeId: trainee.id, groupId: formData.groupId };
  const [canEnterReports, canEditReports] = await Promise.all([
    resolvePermission(actor, "ENTER_REPORTS", reportScope),
    resolvePermission(actor, "EDIT_REPORTS", reportScope),
  ]);

  if (!canEnterReports && !canEditReports) {
    return (
      <AppShell user={session.user} backHref={`/trainees/${trainee.id}`} backLabel="חזרה לחניך">
        <section className={styles.emptyState}>
          <h1>אין הרשאה</h1>
          <p>אין לך הרשאה למלא או לערוך דיווח לחניך זה.</p>
        </section>
      </AppShell>
    );
  }

  const traineeName = `${trainee.firstName} ${trainee.lastName}`;
  const message = reportErrorMessage(query.reportError) ?? reportNoticeMessage(query.reportNotice);
  const existingStatus = formData.existingReport?.status ?? null;
  const canSaveDraft = canEnterReports && existingStatus !== "PUBLISHED";
  const canPublish = existingStatus === "PUBLISHED" ? canEditReports : canEnterReports;
  const returnTo = `/trainees/${trainee.id}/report?date=${selectedDateKey}`;

  return (
    <AppShell user={session.user} backHref={`/trainees/${trainee.id}`} backLabel="חזרה לחניך">
      <section className={styles.pageTitle}>
        <p className={styles.kicker}>דיווח</p>
        <div className={styles.titleRow}>
          <div>
            <h1>{traineeName}</h1>
            <p>מילוי פרמטרים למועד מדידה אחד.</p>
          </div>
          <span className={existingStatus === "PUBLISHED" ? styles.successBadge : styles.metricPill}>
            {reportStatusLabel(existingStatus)}
          </span>
        </div>
      </section>

      {message && (
        <p className={query.reportError ? styles.errorMessage : styles.successMessage} role="status">
          {message}
        </p>
      )}

      <section className={styles.sectionBlock} aria-labelledby="report-date-title">
        <div className={styles.sectionHeader}>
          <h2 id="report-date-title">בחירת מועד</h2>
          <span>{shortDate(formData.measurementDate)}</span>
        </div>
        <div className={styles.dayList}>
          {dayOptions(selectedDate).map((date) => {
            const key = dateInputValue(date);
            return (
              <Link
                key={key}
                href={`/trainees/${trainee.id}/report?date=${key}`}
                className={styles.dayRow}
              >
                <span>{shortDate(date)}</span>
                <strong>{key === selectedDateKey ? "נבחר" : "בחירה"}</strong>
              </Link>
            );
          })}
        </div>
      </section>

      {formData.isVacationDay && (
        <section className={styles.warningMessage}>
          המועד מסומן כחופשה. פרסום דיווח יישמר כחריג וייספר בחישוב.
        </section>
      )}

      {!canSaveDraft && !canPublish ? (
        <section className={styles.emptyState}>
          <h2>אין פעולה זמינה</h2>
          <p>למועד הזה נדרשת הרשאה אחרת לשמירה או לעריכה.</p>
        </section>
      ) : (
        <section className={styles.sectionBlock} aria-labelledby="report-form-title">
          <div className={styles.sectionHeader}>
            <h2 id="report-form-title">פרמטרים</h2>
            <span>{formData.parameters.length} פרמטרים</span>
          </div>
          <form className={styles.settingsForm}>
            <input type="hidden" name="returnTo" value={returnTo} />
            <input type="hidden" name="traineeId" value={trainee.id} />
            <input type="hidden" name="measurementDate" value={selectedDateKey} />
            <ParameterRows parameters={formData.parameters} />
            <label className={styles.fieldLabel}>
              הערה
              <textarea
                name="note"
                rows={3}
                maxLength={1000}
                defaultValue={formData.existingReport?.note ?? ""}
              />
            </label>
            <div className={styles.formFooter}>
              {canSaveDraft && (
                <button type="submit" formAction={saveReportDraftAction} className={styles.secondaryButton}>
                  שמירת טיוטה
                </button>
              )}
              {canPublish && (
                <button type="submit" formAction={publishReportAction} className={styles.primaryButton}>
                  {existingStatus === "PUBLISHED" ? "פרסום עריכה" : "פרסום דיווח"}
                </button>
              )}
            </div>
          </form>
        </section>
      )}
    </AppShell>
  );
}
