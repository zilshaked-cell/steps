import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/app/AppShell";
import { setGroupActiveAction, updateGroupAction } from "@/app/groups/actions";
import {
  groupErrorMessage,
  groupNoticeMessage,
  type SearchParamValue,
} from "@/app/groups/groupActionMessages";
import { createTraineeAction } from "@/app/trainees/actions";
import {
  traineeErrorMessage,
  traineeNoticeMessage,
} from "@/app/trainees/traineeActionMessages";
import { VacationManagement } from "@/app/vacations/VacationManagement";
import {
  vacationErrorMessage,
  vacationNoticeMessage,
} from "@/app/vacations/vacationActionMessages";
import styles from "@/app/page.module.css";
import { auth } from "@/lib/auth";
import { getGroupById, listGroupStaffIds } from "@/repositories/groupRepository";
import { listStaffByInstitution } from "@/repositories/staffUserRepository";
import { getPrimaryStageProgramVersion } from "@/repositories/stageProgramRepository";
import { listTraineesByGroup } from "@/repositories/traineeRepository";
import { resolvePermission } from "@/services/permissions/resolvePermission";
import { buildGroupFitReport } from "@/services/stagePrograms/fitReport";
import { listVacationPeriodsByInstitution } from "@/services/vacations/vacationService";

export default async function GroupReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams?: Promise<{
    groupError?: SearchParamValue;
    groupNotice?: SearchParamValue;
    traineeError?: SearchParamValue;
    traineeNotice?: SearchParamValue;
    vacationError?: SearchParamValue;
    vacationNotice?: SearchParamValue;
  }>;
}) {
  const { groupId } = await params;
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

  const group = await getGroupById(groupId);
  if (!group) notFound();
  if (group.institutionId !== session.user.institutionId) notFound();

  const actor = {
    id: session.user.id,
    institutionId: session.user.institutionId,
    role: session.user.role,
  };
  const canView = await resolvePermission(
    actor,
    "VIEW_REPORTS",
    { groupId: group.id },
  );
  const canManageGroup = await resolvePermission(actor, "MANAGE_GROUPS", { groupId: group.id });
  const canManageTrainees = await resolvePermission(actor, "MANAGE_TRAINEES", {
    groupId: group.id,
  });
  const canEnterReports = await resolvePermission(actor, "ENTER_REPORTS", { groupId: group.id });
  const canEditReports = await resolvePermission(actor, "EDIT_REPORTS", { groupId: group.id });
  const canManageVacations = await resolvePermission(actor, "MANAGE_VACATIONS", {
    groupId: group.id,
  });
  const canManageGroupSettings = await resolvePermission(actor, "MANAGE_GROUP_SETTINGS", {
    groupId: group.id,
  });

  if (
    !canView &&
    !canManageGroup &&
    !canManageTrainees &&
    !canEnterReports &&
    !canEditReports &&
    !canManageVacations &&
    !canManageGroupSettings
  ) {
    return (
      <AppShell user={session.user} backHref="/" backLabel="חזרה לקבוצות">
        <section className={styles.emptyState}>
          <h1>אין הרשאה</h1>
          <p>אין לך הרשאה לצפות בדוח התאמה של קבוצה זו.</p>
        </section>
      </AppShell>
    );
  }

  const groupIsActive = group.active !== false;
  const report = canView ? await buildGroupFitReport(groupId, group.institutionId) : [];
  const reportEntryTrainees =
    (canEnterReports || canEditReports) && !canView && groupIsActive
      ? await listTraineesByGroup(group.id, group.institutionId)
      : [];
  const reportEntryLinks = [
    ...report.map((traineeReport) => ({
      id: traineeReport.traineeId,
      firstName: traineeReport.firstName,
      lastName: traineeReport.lastName,
    })),
    ...reportEntryTrainees,
  ];
  const canShowTraineeCount = canView || ((canEnterReports || canEditReports) && groupIsActive);
  const staffUsers = canManageGroup ? await listStaffByInstitution(group.institutionId) : [];
  const assignedStaffIds = canManageGroup ? await listGroupStaffIds(group.id) : [];
  const stageProgramVersion =
    canManageTrainees && groupIsActive
      ? await getPrimaryStageProgramVersion(group.institutionId)
      : null;
  const stageOptions = stageProgramVersion?.stages ?? [];
  const vacationPeriods = canManageVacations
    ? await listVacationPeriodsByInstitution(group.institutionId)
    : [];
  const groupVacations = vacationPeriods.filter(
    (vacation) => vacation.groupId === group.id && !vacation.traineeId,
  );
  const groupMessage = groupErrorMessage(query.groupError) ?? groupNoticeMessage(query.groupNotice);
  const traineeMessage =
    traineeErrorMessage(query.traineeError) ?? traineeNoticeMessage(query.traineeNotice);
  const vacationMessage =
    vacationErrorMessage(query.vacationError) ?? vacationNoticeMessage(query.vacationNotice);

  return (
    <AppShell user={session.user} backHref="/" backLabel="חזרה לקבוצות">
      <section className={styles.pageTitle}>
        <p className={styles.kicker}>דוח התאמה קבוצתי</p>
        <div className={styles.titleRow}>
          <div>
            <h1>{group.name}</h1>
            <p>{group.description ?? "ציון אחרון, שלב נוכחי וסימון מיעוט נתונים לכל חניך."}</p>
          </div>
          <span className={groupIsActive ? styles.metricPill : styles.archiveBadge}>
            {groupIsActive ? (canShowTraineeCount ? `${reportEntryLinks.length} חניכים` : "פעילה") : "בארכיון"}
          </span>
        </div>
      </section>

      {groupMessage && (
        <p className={query.groupError ? styles.errorMessage : styles.successMessage} role="status">
          {groupMessage}
        </p>
      )}

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

      {canManageGroupSettings && (
        <section className={styles.sectionBlock} aria-labelledby="group-stage-settings-title">
          <div className={styles.sectionHeader}>
            <h2 id="group-stage-settings-title">הגדרות פרופיל ניקוד</h2>
            <Link href={`/stage-settings/groups/${group.id}`} className={styles.secondaryButton}>
              ניהול הגדרות קבוצה
            </Link>
          </div>
        </section>
      )}

      {canManageGroup && (
        <section className={styles.sectionBlock} aria-labelledby="edit-group-title">
          <div className={styles.sectionHeader}>
            <h2 id="edit-group-title">עריכת קבוצה</h2>
            <form action={setGroupActiveAction}>
              <input type="hidden" name="groupId" value={group.id} />
              <input type="hidden" name="active" value={groupIsActive ? "false" : "true"} />
              <button
                type="submit"
                className={groupIsActive ? styles.dangerButton : styles.primaryButton}
              >
                {groupIsActive ? "העברה לארכיון" : "שחזור קבוצה"}
              </button>
            </form>
          </div>
          <form action={updateGroupAction} className={styles.managementForm}>
            <input type="hidden" name="groupId" value={group.id} />
            <label className={styles.fieldLabel}>
              שם קבוצה
              <input name="name" type="text" required maxLength={120} defaultValue={group.name} />
            </label>
            <label className={styles.fieldLabel}>
              תיאור
              <textarea
                name="description"
                rows={3}
                maxLength={500}
                defaultValue={group.description ?? ""}
              />
            </label>
            <label className={styles.fieldLabel}>
              אנשי צוות
              <select
                name="staffIds"
                multiple
                className={styles.multiSelect}
                defaultValue={assignedStaffIds}
              >
                {staffUsers.map((staffUser) => (
                  <option key={staffUser.id} value={staffUser.id}>
                    {staffUser.name} ({staffUser.email})
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

      {canManageTrainees && groupIsActive && (
        <section className={styles.sectionBlock} aria-labelledby="create-trainee-title">
          <div className={styles.sectionHeader}>
            <h2 id="create-trainee-title">הוספת חניך</h2>
          </div>
          <form action={createTraineeAction} className={styles.managementForm}>
            <input type="hidden" name="groupId" value={group.id} />
            <label className={styles.fieldLabel}>
              שם פרטי
              <input name="firstName" type="text" required maxLength={120} />
            </label>
            <label className={styles.fieldLabel}>
              שם משפחה
              <input name="lastName" type="text" required maxLength={120} />
            </label>
            <label className={styles.fieldLabel}>
              שלב נוכחי
              <select name="currentStageId" defaultValue="">
                <option value="">ללא שלב</option>
                {stageOptions.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={styles.primaryButton}>
              הוספה
            </button>
          </form>
        </section>
      )}

      {canManageVacations && (
        <VacationManagement
          heading="חופשות קבוצה"
          vacations={groupVacations}
          returnTo={`/groups/${group.id}`}
          groupId={group.id}
        />
      )}

      {(canEnterReports || canEditReports) && groupIsActive && (
        <section className={styles.sectionBlock} aria-labelledby="group-report-entry-title">
          <div className={styles.sectionHeader}>
            <h2 id="group-report-entry-title">דיווח</h2>
            <span>בחירת חניך למילוי דיווח</span>
          </div>
          {reportEntryLinks.length > 0 ? (
            <div className={styles.dayList}>
              {reportEntryLinks.map((traineeForReport) => (
                <Link
                  key={traineeForReport.id}
                  href={`/trainees/${traineeForReport.id}/report`}
                  className={styles.dayRow}
                >
                  <span>
                    {traineeForReport.firstName} {traineeForReport.lastName}
                  </span>
                  <strong>דיווח</strong>
                </Link>
              ))}
            </div>
          ) : (
            <p className={styles.mutedText}>אין חניכים פעילים לדיווח.</p>
          )}
        </section>
      )}

      {!canView ? (
        <section className={styles.emptyState}>
          <h2>אין הרשאה לדוח</h2>
        </section>
      ) : report.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.dataTable} aria-label={`דוח התאמה קבוצתי עבור ${group.name}`}>
            <thead>
              <tr>
                <th scope="col">חניך</th>
                <th scope="col">שלב נוכחי</th>
                <th scope="col">ציון אחרון</th>
                <th scope="col">נתונים</th>
              </tr>
            </thead>
            <tbody>
              {report.map((traineeReport) => (
                <tr key={traineeReport.traineeId}>
                  <td>
                    <Link href={`/trainees/${traineeReport.traineeId}`} className={styles.tableLink}>
                      {traineeReport.firstName} {traineeReport.lastName}
                    </Link>
                  </td>
                  <td>{traineeReport.currentStageName ?? "לא מוגדר"}</td>
                  <td className={styles.scoreCell}>
                    {traineeReport.mostRecentScore
                      ? traineeReport.mostRecentScore.totalScore.toFixed(1)
                      : "אין נתונים"}
                  </td>
                  <td>
                    {traineeReport.dataSufficiency.isSufficient ? (
                      <span className={styles.successBadge}>מספיק נתונים</span>
                    ) : (
                      <span className={styles.warningBadge}>
                        {`מיעוט נתונים: ${traineeReport.dataSufficiency.measurementDaysIncluded}/${traineeReport.dataSufficiency.measurementDaysRequired} ימים, ${traineeReport.dataSufficiency.parametersIncluded}/${traineeReport.dataSufficiency.parametersExpected} פרמטרים`}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <section className={styles.emptyState}>
          <h2>אין חניכים להצגה</h2>
          <p>לא נמצאו חניכים עם דוח התאמה בקבוצה זו.</p>
        </section>
      )}
    </AppShell>
  );
}
