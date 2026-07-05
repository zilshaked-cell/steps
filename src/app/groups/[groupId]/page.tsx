import Link from "next/link";
import { notFound } from "next/navigation";
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
      <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <p>
          יש להתחבר כדי לצפות בדוח. <Link href="/login">התחברות</Link>
        </p>
      </main>
    );
  }

  const group = await getGroupById(groupId);
  if (!group) notFound();

  const canView = await resolvePermission(
    { id: session.user.id, institutionId: session.user.institutionId, role: session.user.role },
    "VIEW_REPORTS",
    { groupId: group.id },
  );

  if (!canView) {
    return (
      <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <p>אין לך הרשאה לצפות בדוח התאמה של קבוצה זו.</p>
      </main>
    );
  }

  const report = await buildGroupFitReport(groupId);

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 800 }}>
      <p>
        <Link href="/">← חזרה</Link>
      </p>
      <h1>דוח התאמה — {group.name}</h1>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "right" }}>חניך</th>
            <th style={{ textAlign: "right" }}>שלב נוכחי</th>
            <th style={{ textAlign: "right" }}>ציון אחרון</th>
            <th style={{ textAlign: "right" }}>נתונים</th>
          </tr>
        </thead>
        <tbody>
          {report.map((traineeReport) => (
            <tr key={traineeReport.traineeId}>
              <td>
                <Link href={`/trainees/${traineeReport.traineeId}`}>
                  {traineeReport.firstName} {traineeReport.lastName}
                </Link>
              </td>
              <td>{traineeReport.currentStageName ?? "—"}</td>
              <td>
                {traineeReport.mostRecentScore
                  ? traineeReport.mostRecentScore.totalScore.toFixed(1)
                  : "אין נתונים"}
              </td>
              <td>
                {traineeReport.dataSufficiency.isSufficient
                  ? "מספיק נתונים"
                  : `מיעוט נתונים (${traineeReport.dataSufficiency.measurementDaysIncluded}/${traineeReport.dataSufficiency.measurementDaysRequired} ימים, ${traineeReport.dataSufficiency.parametersIncluded}/${traineeReport.dataSufficiency.parametersExpected} פרמטרים)`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
