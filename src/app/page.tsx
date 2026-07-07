import Link from "next/link";
import { AppShell } from "./AppShell";
import styles from "./page.module.css";
import { createGroupAction } from "@/app/groups/actions";
import {
  firstSearchParam,
  groupErrorMessage,
  groupNoticeMessage,
  type SearchParamValue,
} from "@/app/groups/groupActionMessages";
import { VacationManagement } from "@/app/vacations/VacationManagement";
import {
  vacationErrorMessage,
  vacationNoticeMessage,
} from "@/app/vacations/vacationActionMessages";
import { auth } from "@/lib/auth";
import { getInstitutionById } from "@/repositories/institutionRepository";
import { listGroupsByInstitution } from "@/repositories/groupRepository";
import { listStaffByInstitution } from "@/repositories/staffUserRepository";
import { resolvePermission } from "@/services/permissions/resolvePermission";
import { listVacationPeriodsByInstitution } from "@/services/vacations/vacationService";

type HomeSearchParams = {
  archive?: SearchParamValue;
  groupError?: SearchParamValue;
  groupNotice?: SearchParamValue;
  vacationError?: SearchParamValue;
  vacationNotice?: SearchParamValue;
};

type HomeProps = {
  searchParams?: Promise<HomeSearchParams>;
};

export default async function Home({ searchParams }: HomeProps) {
  const session = await auth();
  const query = searchParams ? await searchParams : {};

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
  const showArchive = firstSearchParam(query.archive) === "1";
  const groups = institution
    ? showArchive
      ? await listGroupsByInstitution(institution.id, { includeInactive: true })
      : await listGroupsByInstitution(institution.id)
    : [];
  const actor = {
    id: session.user.id,
    institutionId: session.user.institutionId,
    role: session.user.role,
  };
  const canManageGroups = institution
    ? await resolvePermission(actor, "MANAGE_GROUPS")
    : false;
  const canManageVacations = institution
    ? await resolvePermission(actor, "MANAGE_VACATIONS")
    : false;
  const canManagePermissions = institution
    ? await resolvePermission(actor, "MANAGE_PERMISSIONS")
    : false;
  const canManageStageSettings = institution
    ? await resolvePermission(actor, "MANAGE_STAGE_SETTINGS")
    : false;
  const staffUsers =
    canManageGroups && institution ? await listStaffByInstitution(institution.id) : [];
  const vacationPeriods =
    canManageVacations && institution ? await listVacationPeriodsByInstitution(institution.id) : [];
  const institutionVacations = vacationPeriods.filter(
    (vacation) => !vacation.groupId && !vacation.traineeId,
  );
  const activeGroups = groups.filter((group) => group.active !== false);
  const archivedGroups = showArchive ? groups.filter((group) => group.active === false) : [];
  const groupMessage = groupErrorMessage(query.groupError) ?? groupNoticeMessage(query.groupNotice);
  const vacationMessage =
    vacationErrorMessage(query.vacationError) ?? vacationNoticeMessage(query.vacationNotice);
  const returnTo = showArchive ? "/?archive=1" : "/";

  return (
    <AppShell user={session.user}>
      <section className={styles.pageTitle}>
        <p className={styles.kicker}>מוסד</p>
        <div className={styles.titleRow}>
          <div>
            <h1>{institution?.name ?? "אין מוסד מוגדר"}</h1>
            <p>בחרו קבוצה כדי לפתוח דוח התאמה קבוצתי.</p>
          </div>
          <span className={styles.metricPill}>{activeGroups.length} קבוצות פעילות</span>
        </div>
        <div className={styles.viewToggle} aria-label="סינון קבוצות">
          <Link
            href="/"
            className={showArchive ? styles.secondaryButton : styles.primaryButton}
            aria-current={showArchive ? undefined : "page"}
          >
            שוטף
          </Link>
          <Link
            href="/?archive=1"
            className={showArchive ? styles.primaryButton : styles.secondaryButton}
            aria-current={showArchive ? "page" : undefined}
          >
            ארכיון
          </Link>
          {canManagePermissions && (
            <Link href="/permissions" className={styles.secondaryButton}>
              הרשאות
            </Link>
          )}
          {canManageStageSettings && (
            <Link href="/stage-settings" className={styles.secondaryButton}>
              הגדרות שלבים
            </Link>
          )}
        </div>
      </section>

      {groupMessage && (
        <p className={query.groupError ? styles.errorMessage : styles.successMessage} role="status">
          {groupMessage}
        </p>
      )}

      {vacationMessage && (
        <p className={query.vacationError ? styles.errorMessage : styles.successMessage} role="status">
          {vacationMessage}
        </p>
      )}

      {canManageGroups && institution && (
        <section className={styles.sectionBlock} aria-labelledby="create-group-title">
          <div className={styles.sectionHeader}>
            <h2 id="create-group-title">הוספת קבוצה</h2>
          </div>
          <form action={createGroupAction} className={styles.managementForm}>
            <label className={styles.fieldLabel}>
              שם קבוצה
              <input name="name" type="text" required maxLength={120} />
            </label>
            <label className={styles.fieldLabel}>
              תיאור
              <textarea name="description" rows={3} maxLength={500} />
            </label>
            <label className={styles.fieldLabel}>
              אנשי צוות
              <select name="staffIds" multiple className={styles.multiSelect}>
                {staffUsers.map((staffUser) => (
                  <option key={staffUser.id} value={staffUser.id}>
                    {staffUser.name} ({staffUser.email})
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
          heading="חופשות מוסד"
          vacations={institutionVacations}
          returnTo={returnTo}
        />
      )}

      {activeGroups.length > 0 ? (
        <section className={styles.groupGrid} aria-label="רשימת קבוצות">
          {activeGroups.map((group) => (
            <Link
              key={group.id}
              href={`/groups/${group.id}`}
              className={styles.groupCard}
              aria-label={`פתיחת דוח התאמה עבור ${group.name}`}
            >
              <span className={styles.groupName}>{group.name}</span>
              {group.description && <span className={styles.groupMeta}>{group.description}</span>}
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

      {showArchive && (
        archivedGroups.length > 0 ? (
          <section className={styles.sectionBlock} aria-labelledby="archived-groups-title">
            <div className={styles.sectionHeader}>
              <h2 id="archived-groups-title">ארכיון קבוצות</h2>
              <span>{archivedGroups.length} קבוצות</span>
            </div>
            <div className={styles.groupGrid}>
              {archivedGroups.map((group) => (
                <Link
                  key={group.id}
                  href={`/groups/${group.id}`}
                  className={styles.groupCard}
                  aria-label={`פתיחת דוח היסטורי עבור ${group.name}`}
                >
                  <span className={styles.groupName}>{group.name}</span>
                  {group.description && <span className={styles.groupMeta}>{group.description}</span>}
                  <span className={styles.archiveBadge}>בארכיון</span>
                  <span className={styles.groupAction}>דוח היסטורי</span>
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <section className={styles.emptyState}>
            <h2>אין קבוצות בארכיון</h2>
          </section>
        )
      )}
    </AppShell>
  );
}
