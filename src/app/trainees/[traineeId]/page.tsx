import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/app/AppShell";
import {
  transferTraineeAction,
  updateTraineeAction,
} from "@/app/trainees/actions";
import {
  traineeErrorMessage,
  traineeNoticeMessage,
  type SearchParamValue,
} from "@/app/trainees/traineeActionMessages";
import { VacationManagement } from "@/app/vacations/VacationManagement";
import {
  vacationErrorMessage,
  vacationNoticeMessage,
} from "@/app/vacations/vacationActionMessages";
import styles from "@/app/page.module.css";
import { auth } from "@/lib/auth";
import { listGroupsByInstitution } from "@/repositories/groupRepository";
import { getPrimaryStageProgramVersion } from "@/repositories/stageProgramRepository";
import { getTraineeById } from "@/repositories/traineeRepository";
import { resolvePermission } from "@/services/permissions/resolvePermission";
import { buildTraineeFitReport } from "@/services/stagePrograms/fitReport";
import { listVacationPeriodsByInstitution } from "@/services/vacations/vacationService";

const STATUS_LABELS: Record<string, string> = {
  SCORED: "נוקד",
  NOT_SCORED: "לא נוקד",
  NOT_APPLICABLE: "לא רלוונטי",
};

function dateInputValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default async function TraineeReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ traineeId: string }>;
  searchParams?: Promise<{
    traineeError?: SearchParamValue;
    traineeNotice?: SearchParamValue;
    vacationError?: SearchParamValue;
    vacationNotice?: SearchParamValue;
  }>;
}) {
  const { traineeId } = await params;
  const query = searchParams ? await searchParams : {};
  const session = await auth();

  if (!session?.user) {
    return (
      <AppShell>
        <section className={styles.emptyState}>
          <h1>נדרשת התחברות</h1>
          <p>יש להתחבר כדי לצפות בדוח התאמה.</p>
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
  const traineeScope = { traineeId: trainee.id, groupId: trainee.groupId };
  const canView = await resolvePermission(actor, "VIEW_REPORTS", traineeScope);
  const canManage = await resolvePermission(actor, "MANAGE_TRAINEES", traineeScope);
  const canTransferFromCurrentGroup = await resolvePermission(
    actor,
    "TRANSFER_TRAINEES",
    traineeScope,
  );
  const canEnterReports = await resolvePermission(actor, "ENTER_REPORTS", traineeScope);
  const canEditReports = await resolvePermission(actor, "EDIT_REPORTS", traineeScope);
  const canManageVacations = await resolvePermission(actor, "MANAGE_VACATIONS", traineeScope);
  const canManageTraineeSettings = await resolvePermission(
    actor,
    "MANAGE_TRAINEE_SETTINGS",
    traineeScope,
  );

  if (
    !canView &&
    !canManage &&
    !canTransferFromCurrentGroup &&
    !canEnterReports &&
    !canEditReports &&
    !canManageVacations &&
    !canManageTraineeSettings
  ) {
    return (
      <AppShell user={session.user} backHref="/" backLabel="חזרה לקבוצות">
        <section className={styles.emptyState}>
          <h1>אין הרשאה</h1>
          <p>אין לך הרשאה לצפות או לנהל חניך זה.</p>
        </section>
      </AppShell>
    );
  }

  const report = canView ? await buildTraineeFitReport(traineeId, trainee.institutionId) : null;
  if (canView && !report) notFound();

  const stageProgramVersion = canManage
    ? await getPrimaryStageProgramVersion(trainee.institutionId)
    : null;
  const stageOptions = stageProgramVersion?.stages ?? [];
  const transferTargetCandidates = canTransferFromCurrentGroup
    ? await listGroupsByInstitution(trainee.institutionId)
    : [];
  const transferTargets: typeof transferTargetCandidates = [];
  for (const group of transferTargetCandidates) {
    if (group.id === trainee.groupId) continue;
    const canTransferToTarget = await resolvePermission(actor, "TRANSFER_TRAINEES", {
      groupId: group.id,
    });
    if (canTransferToTarget) transferTargets.push(group);
  }
  const vacationPeriods = canManageVacations
    ? await listVacationPeriodsByInstitution(trainee.institutionId)
    : [];
  const traineeVacations = vacationPeriods.filter(
    (vacation) => vacation.traineeId === trainee.id,
  );

  const latestDay = report?.dailyScores.at(-1) ?? null;
  const latestScoreText = latestDay ? latestDay.totalScore.toFixed(1) : "אין נתונים";
  const backHref = trainee.groupId ? `/groups/${trainee.groupId}` : "/";
  const backLabel = trainee.groupId ? "חזרה לקבוצה" : "חזרה לקבוצות";
  const displayName = report
    ? `${report.firstName} ${report.lastName}`
    : `${trainee.firstName} ${trainee.lastName}`;
  const currentStageName =
    report?.currentStageName ?? trainee.currentStage?.name ?? "שלב לא מוגדר";
  const traineeMessage =
    traineeErrorMessage(query.traineeError) ?? traineeNoticeMessage(query.traineeNotice);
  const vacationMessage =
    vacationErrorMessage(query.vacationError) ?? vacationNoticeMessage(query.vacationNotice);

  return (
    <AppShell user={session.user} backHref={backHref} backLabel={backLabel}>
      <section className={styles.pageTitle}>
        <p className={styles.kicker}>דוח התאמה פרטני</p>
        <div className={styles.titleRow}>
          <div>
            <h1>{displayName}</h1>
            <p>פירוט ציונים לפי יום מדידה ולפי פרמטר.</p>
          </div>
          <span className={styles.metricPill}>{currentStageName}</span>
        </div>
      </section>

      {traineeMessage && (
        <p className={query.traineeError ? styles.errorMessage : styles.successMessage} role="status">
          {traineeMessage}
        </p>
      )}

      {vacationMessage && (
        <p className={query.vacationError ? styles.errorMessage : styles.successMessage} role="status">
          {vacationMessage}
        </p>
      )}

      {(canEnterReports || canEditReports) && (
        <section className={styles.sectionBlock} aria-labelledby="trainee-report-entry-title">
          <div className={styles.sectionHeader}>
            <h2 id="trainee-report-entry-title">דיווח</h2>
            <Link href={`/trainees/${trainee.id}/report`} className={styles.primaryButton}>
              מילוי דיווח
            </Link>
          </div>
        </section>
      )}

      {canManageTraineeSettings && (
        <section className={styles.sectionBlock} aria-labelledby="trainee-stage-settings-title">
          <div className={styles.sectionHeader}>
            <h2 id="trainee-stage-settings-title">הגדרות פרופיל ניקוד</h2>
            <Link href={`/stage-settings/trainees/${trainee.id}`} className={styles.secondaryButton}>
              ניהול הגדרות חניך
            </Link>
          </div>
        </section>
      )}

      {canManage && (
        <section className={styles.sectionBlock} aria-labelledby="edit-trainee-title">
          <div className={styles.sectionHeader}>
            <h2 id="edit-trainee-title">עריכת חניך</h2>
          </div>
          <form action={updateTraineeAction} className={styles.managementForm}>
            <input type="hidden" name="traineeId" value={trainee.id} />
            <input type="hidden" name="currentGroupId" value={trainee.groupId ?? ""} />
            <label className={styles.fieldLabel}>
              שם פרטי
              <input
                name="firstName"
                type="text"
                required
                maxLength={120}
                defaultValue={trainee.firstName}
              />
            </label>
            <label className={styles.fieldLabel}>
              שם משפחה
              <input
                name="lastName"
                type="text"
                required
                maxLength={120}
                defaultValue={trainee.lastName}
              />
            </label>
            <label className={styles.fieldLabel}>
              שלב נוכחי
              <select name="currentStageId" defaultValue={trainee.currentStageId ?? ""}>
                <option value="">ללא שלב</option>
                {stageOptions.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={styles.primaryButton}>
              שמירה
            </button>
          </form>
        </section>
      )}

      {transferTargets.length > 0 && (
        <section className={styles.sectionBlock} aria-labelledby="transfer-trainee-title">
          <div className={styles.sectionHeader}>
            <h2 id="transfer-trainee-title">העברת קבוצה</h2>
          </div>
          <form action={transferTraineeAction} className={styles.managementForm}>
            <input type="hidden" name="traineeId" value={trainee.id} />
            <input type="hidden" name="currentGroupId" value={trainee.groupId ?? ""} />
            <label className={styles.fieldLabel}>
              קבוצת יעד
              <select name="toGroupId" required defaultValue="">
                <option value="" disabled>
                  בחירת קבוצה
                </option>
                {transferTargets.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.fieldLabel}>
              תאריך תחולה
              <input name="effectiveFrom" type="date" required defaultValue={dateInputValue()} />
            </label>
            <label className={styles.fieldLabel}>
              הערה
              <textarea name="note" rows={3} maxLength={500} />
            </label>
            <button type="submit" className={styles.primaryButton}>
              העברה
            </button>
          </form>
        </section>
      )}

      {canManageVacations && (
        <VacationManagement
          heading="חופשות חניך"
          vacations={traineeVacations}
          returnTo={`/trainees/${trainee.id}`}
          traineeId={trainee.id}
        />
      )}

      {!canView && (
        <section className={styles.emptyState}>
          <h2>אין הרשאה לדוח</h2>
        </section>
      )}

      {report && (
        <>
          <section className={styles.overviewGrid} aria-label="סיכום דוח פרטני">
            <div className={styles.metricCard}>
              <span>שלב נוכחי</span>
              <strong>{report.currentStageName ?? "לא מוגדר"}</strong>
            </div>
            <div className={styles.metricCard}>
              <span>ציון אחרון</span>
              <strong>{latestScoreText}</strong>
            </div>
            <div className={styles.metricCard}>
              <span>ימי מדידה</span>
              <strong>
                {report.dataSufficiency.measurementDaysIncluded}/
                {report.dataSufficiency.measurementDaysRequired}
              </strong>
            </div>
            <div className={styles.metricCard}>
              <span>פרמטרים</span>
              <strong>
                {report.dataSufficiency.parametersIncluded}/
                {report.dataSufficiency.parametersExpected}
              </strong>
            </div>
          </section>

          {!report.dataSufficiency.isSufficient && (
            <section className={styles.warningMessage}>
              מיעוט נתונים: {report.dataSufficiency.measurementDaysIncluded} מתוך{" "}
              {report.dataSufficiency.measurementDaysRequired} ימי מדידה נדרשים,{" "}
              {report.dataSufficiency.parametersIncluded} מתוך{" "}
              {report.dataSufficiency.parametersExpected} פרמטרים.
            </section>
          )}

          <section className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <h2>ימי מדידה בטווח</h2>
              <span>{report.dailyScores.length} ימים</span>
            </div>
            {report.dailyScores.length > 0 ? (
              <div className={styles.dayList}>
                {report.dailyScores.map((day) => (
                  <div key={day.date.toISOString()} className={styles.dayRow}>
                    <span>{day.date.toLocaleDateString("he-IL", { timeZone: "UTC" })}</span>
                    <strong>{day.totalScore.toFixed(1)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.mutedText}>אין ימי מדידה להצגה.</p>
            )}
          </section>

          {latestDay && (
            <section className={styles.sectionBlock}>
              <div className={styles.sectionHeader}>
                <h2>פירוט פרמטרים</h2>
                <span>{latestDay.date.toLocaleDateString("he-IL", { timeZone: "UTC" })}</span>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.dataTable} aria-label="פירוט פרמטרים ליום המדידה האחרון">
                  <thead>
                    <tr>
                      <th scope="col">פרמטר</th>
                      <th scope="col">משקל</th>
                      <th scope="col">סטטוס</th>
                      <th scope="col">ציון</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestDay.parameterDetails.map((detail) => (
                      <tr key={detail.parameterDefinitionId}>
                        <td>{detail.name}</td>
                        <td>{detail.weightPercent}%</td>
                        <td>{STATUS_LABELS[detail.status] ?? detail.status}</td>
                        <td>{detail.status === "SCORED" ? detail.rawScore : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <p className={styles.specNote}>
            {
              "השוואה לתקופות קודמות עדיין לא אופיינה לעומק ואינה ממומשת כאן. גם המלצת עלייה/ירידה בשלב אינה מוצגת כי סמנטיקת הסף עדיין פתוחה."
            }
          </p>
        </>
      )}
    </AppShell>
  );
}
