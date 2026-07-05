import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/app/AppShell";
import styles from "@/app/page.module.css";
import { auth } from "@/lib/auth";
import { getTraineeById } from "@/repositories/traineeRepository";
import { resolvePermission } from "@/services/permissions/resolvePermission";
import { buildTraineeFitReport } from "@/services/stagePrograms/fitReport";

const STATUS_LABELS: Record<string, string> = {
  SCORED: "נוקד",
  NOT_SCORED: "לא נוקד",
  NOT_APPLICABLE: "לא רלוונטי",
};

export default async function TraineeReportPage({
  params,
}: {
  params: Promise<{ traineeId: string }>;
}) {
  const { traineeId } = await params;
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

  const canView = await resolvePermission(
    { id: session.user.id, institutionId: session.user.institutionId, role: session.user.role },
    "VIEW_REPORTS",
    { traineeId: trainee.id, groupId: trainee.groupId },
  );

  if (!canView) {
    return (
      <AppShell user={session.user} backHref="/" backLabel="חזרה לקבוצות">
        <section className={styles.emptyState}>
          <h1>אין הרשאה</h1>
          <p>אין לך הרשאה לצפות בדוח התאמה של חניך זה.</p>
        </section>
      </AppShell>
    );
  }

  const report = await buildTraineeFitReport(traineeId, trainee.institutionId);
  if (!report) notFound();

  const latestDay = report.dailyScores.at(-1);
  const latestScoreText = latestDay ? latestDay.totalScore.toFixed(1) : "אין נתונים";
  const backHref = trainee.groupId ? `/groups/${trainee.groupId}` : "/";
  const backLabel = trainee.groupId ? "חזרה לקבוצה" : "חזרה לקבוצות";

  return (
    <AppShell user={session.user} backHref={backHref} backLabel={backLabel}>
      <section className={styles.pageTitle}>
        <p className={styles.kicker}>דוח התאמה פרטני</p>
        <div className={styles.titleRow}>
          <div>
            <h1>
              {report.firstName} {report.lastName}
            </h1>
            <p>פירוט ציונים לפי יום מדידה ולפי פרמטר.</p>
          </div>
          <span className={styles.metricPill}>{report.currentStageName ?? "שלב לא מוגדר"}</span>
        </div>
      </section>

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
          {report.dataSufficiency.parametersIncluded} מתוך {report.dataSufficiency.parametersExpected}{" "}
          פרמטרים.
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
          "השוואה לתקופות קודמות (per spec) עדיין לא אופיינה לעומק ואינה ממומשת כאן. גם המלצת עלייה/ירידה בשלב אינה מוצגת — סמנטיקת הסף עדיין שאלה פתוחה."
        }
      </p>
    </AppShell>
  );
}
