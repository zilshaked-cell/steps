import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/app/AppShell";
import styles from "@/app/page.module.css";
import { auth } from "@/lib/auth";
import { getGroupById } from "@/repositories/groupRepository";
import { resolvePermission } from "@/services/permissions/resolvePermission";
import { buildGroupFitReport } from "@/services/stagePrograms/fitReport";

export default async function GroupReportPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
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

  const canView = await resolvePermission(
    { id: session.user.id, institutionId: session.user.institutionId, role: session.user.role },
    "VIEW_REPORTS",
    { groupId: group.id },
  );

  if (!canView) {
    return (
      <AppShell user={session.user} backHref="/" backLabel="חזרה לקבוצות">
        <section className={styles.emptyState}>
          <h1>אין הרשאה</h1>
          <p>אין לך הרשאה לצפות בדוח התאמה של קבוצה זו.</p>
        </section>
      </AppShell>
    );
  }

  const report = await buildGroupFitReport(groupId, group.institutionId);

  return (
    <AppShell user={session.user} backHref="/" backLabel="חזרה לקבוצות">
      <section className={styles.pageTitle}>
        <p className={styles.kicker}>דוח התאמה קבוצתי</p>
        <div className={styles.titleRow}>
          <div>
            <h1>{group.name}</h1>
            <p>ציון אחרון, שלב נוכחי וסימון מיעוט נתונים לכל חניך.</p>
          </div>
          <span className={styles.metricPill}>{report.length} חניכים</span>
        </div>
      </section>

      {report.length > 0 ? (
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
