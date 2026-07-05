import Link from "next/link";
import { notFound } from "next/navigation";
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
      <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <p>
          יש להתחבר כדי לצפות בדוח. <Link href="/login">התחברות</Link>
        </p>
      </main>
    );
  }

  const trainee = await getTraineeById(traineeId);
  if (!trainee) notFound();

  const canView = await resolvePermission(
    { id: session.user.id, institutionId: session.user.institutionId, role: session.user.role },
    "VIEW_REPORTS",
    { traineeId: trainee.id, groupId: trainee.groupId },
  );

  if (!canView) {
    return (
      <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <p>אין לך הרשאה לצפות בדוח התאמה של חניך זה.</p>
      </main>
    );
  }

  const report = await buildTraineeFitReport(traineeId);
  if (!report) notFound();

  const latestDay = report.dailyScores.at(-1);

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 640 }}>
      <p>
        {trainee.groupId ? (
          <Link href={`/groups/${trainee.groupId}`}>← חזרה לקבוצה</Link>
        ) : (
          <Link href="/">← חזרה</Link>
        )}
      </p>
      <h1>
        {report.firstName} {report.lastName}
      </h1>
      <p>שלב נוכחי: {report.currentStageName ?? "—"}</p>

      {!report.dataSufficiency.isSufficient && (
        <p style={{ color: "darkorange" }}>
          מיעוט נתונים: {report.dataSufficiency.measurementDaysIncluded} מתוך{" "}
          {report.dataSufficiency.measurementDaysRequired} ימי מדידה נדרשים,{" "}
          {report.dataSufficiency.parametersIncluded} מתוך {report.dataSufficiency.parametersExpected}{" "}
          פרמטרים.
        </p>
      )}

      <h2>ימי מדידה בטווח</h2>
      <ul>
        {report.dailyScores.map((day) => (
          <li key={day.date.toISOString()}>
            {day.date.toLocaleDateString("he-IL")} — ציון: {day.totalScore.toFixed(1)}
          </li>
        ))}
      </ul>

      {latestDay && (
        <>
          <h2>פירוט פרמטרים — {latestDay.date.toLocaleDateString("he-IL")}</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "right" }}>פרמטר</th>
                <th style={{ textAlign: "right" }}>משקל</th>
                <th style={{ textAlign: "right" }}>סטטוס</th>
                <th style={{ textAlign: "right" }}>ציון</th>
              </tr>
            </thead>
            <tbody>
              {latestDay.parameterDetails.map((detail) => (
                <tr key={detail.parameterDefinitionId}>
                  <td>{detail.name}</td>
                  <td>{detail.weightPercent}%</td>
                  <td>{STATUS_LABELS[detail.status] ?? detail.status}</td>
                  <td>{detail.status === "SCORED" ? detail.rawScore : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <p style={{ fontSize: "0.85rem", opacity: 0.7 }}>
        {
          "השוואה לתקופות קודמות (per spec) עדיין לא אופיינה לעומק ואינה ממומשת כאן. גם המלצת עלייה/ירידה בשלב אינה מוצגת — סמנטיקת הסף עדיין שאלה פתוחה."
        }
      </p>
    </main>
  );
}
