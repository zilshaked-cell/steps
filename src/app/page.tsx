import Link from "next/link";
import { AppShell } from "./AppShell";
import styles from "./page.module.css";
import { auth } from "@/lib/auth";
import { getInstitutionById } from "@/repositories/institutionRepository";
import { listGroupsByInstitution } from "@/repositories/groupRepository";

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    return (
      <AppShell>
        <section className={styles.hero}>
          <div>
            <p className={styles.kicker}>תכניות שלבים</p>
            <h1>מעקב חינוכי-התנהגותי לצוות הפנימייה</h1>
            <p>
              הכניסה זמינה לאנשי צוות שמוגדרים במערכת עם אימייל Google מאומת.
            </p>
          </div>
          <Link href="/login" className={styles.primaryButton}>
            התחברות
          </Link>
        </section>
      </AppShell>
    );
  }

  // Scoped to the signed-in user's own institution only — never list institutions
  // globally here, or an authenticated user from one institution could be shown
  // another institution's name/groups before any permission check even runs.
  const institution = await getInstitutionById(session.user.institutionId);
  const groups = institution ? await listGroupsByInstitution(institution.id) : [];

  return (
    <AppShell user={session.user}>
      <section className={styles.pageTitle}>
        <p className={styles.kicker}>מוסד</p>
        <div className={styles.titleRow}>
          <div>
            <h1>{institution?.name ?? "אין מוסד מוגדר"}</h1>
            <p>בחרו קבוצה כדי לפתוח דוח התאמה קבוצתי.</p>
          </div>
          <span className={styles.metricPill}>{groups.length} קבוצות</span>
        </div>
      </section>

      {groups.length > 0 ? (
        <section className={styles.groupGrid} aria-label="רשימת קבוצות">
          {groups.map((group) => (
            <Link
              key={group.id}
              href={`/groups/${group.id}`}
              className={styles.groupCard}
              aria-label={`פתיחת דוח התאמה עבור ${group.name}`}
            >
              <span className={styles.groupName}>{group.name}</span>
              <span className={styles.groupAction}>פתיחת דוח</span>
            </Link>
          ))}
        </section>
      ) : (
        <section className={styles.emptyState}>
          <h2>אין קבוצות להצגה</h2>
          <p>לא נמצאו קבוצות פעילות עבור המוסד של המשתמש המחובר.</p>
        </section>
      )}
    </AppShell>
  );
}
