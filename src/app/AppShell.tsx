import Link from "next/link";
import styles from "./page.module.css";
import { signOutAction } from "./authActions";

type AppShellUser = {
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

type AppShellProps = {
  children: React.ReactNode;
  user?: AppShellUser | null;
  backHref?: string;
  backLabel?: string;
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "מנהל",
  LEAD_COORDINATOR: "רכז מוביל",
  COUNSELOR: "מדריך",
  YOUTH_WORKER: 'ש"ש',
  TRAINEE: "חניך",
};

export function AppShell({ children, user, backHref, backLabel }: AppShellProps) {
  const displayName = user?.name ?? user?.email ?? "משתמש";
  const roleLabel = user?.role ? (ROLE_LABELS[user.role] ?? user.role) : null;

  return (
    <main className={styles.appShell}>
      <header className={styles.appHeader}>
        <div className={styles.brandBlock}>
          <Link href="/" className={styles.brand}>
            שלבים
          </Link>
          <span className={styles.brandCaption}>מעקב חינוכי-התנהגותי</span>
        </div>

        <div className={styles.headerActions}>
          {backHref && (
            <Link href={backHref} className={styles.secondaryButton}>
              {backLabel ?? "חזרה"}
            </Link>
          )}
          {user && (
            <div className={styles.userBox}>
              <span className={styles.userName}>{displayName}</span>
              {roleLabel && <span className={styles.userRole}>{roleLabel}</span>}
            </div>
          )}
          {user && (
            <form action={signOutAction}>
              <button type="submit" className={styles.secondaryButton} aria-label="יציאה מהמערכת">
                יציאה
              </button>
            </form>
          )}
        </div>
      </header>
      {children}
    </main>
  );
}
