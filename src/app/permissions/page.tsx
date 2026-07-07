import Link from "next/link";
import { AppShell } from "@/app/AppShell";
import {
  setRolePermissionAction,
  setUserPermissionOverrideAction,
} from "@/app/permissions/actions";
import {
  permissionErrorMessage,
  permissionNoticeMessage,
  type SearchParamValue,
} from "@/app/permissions/permissionActionMessages";
import styles from "@/app/page.module.css";
import { auth } from "@/lib/auth";
import { listGroupsByInstitution } from "@/repositories/groupRepository";
import { getInstitutionById } from "@/repositories/institutionRepository";
import {
  listRolePermissionsByInstitution,
  listUserPermissionOverridesByInstitution,
} from "@/repositories/permissionRepository";
import { listStaffByInstitution } from "@/repositories/staffUserRepository";
import { listTraineesByInstitution } from "@/repositories/traineeRepository";
import {
  MANAGEABLE_PERMISSION_ACTIONS,
  STAFF_ROLES,
  isRolePermissionAllowedByDefault,
} from "@/services/permissions/actions";
import { resolvePermission } from "@/services/permissions/resolvePermission";
import type { PermissionAction, StaffRole } from "@/generated/prisma/enums";

const ROLE_LABELS: Record<StaffRole, string> = {
  ADMIN: "מנהל",
  LEAD_COORDINATOR: "רכז מוביל",
  COUNSELOR: "מדריך",
  YOUTH_WORKER: 'ש"ש',
  TRAINEE: "חניך",
};

const PERMISSION_ACTION_LABELS: Record<PermissionAction, string> = {
  VIEW: "צפייה כללית",
  EDIT: "עריכה כללית",
  CHANGE_STAGE: "שינוי שלב",
  VIEW_REPORTS: "צפייה בדוחות",
  EDIT_SETTINGS: "עריכת הגדרות כלליות",
  MANAGE_PERMISSIONS: "ניהול הרשאות",
  MANAGE_GROUPS: "ניהול קבוצות",
  MANAGE_TRAINEES: "ניהול חניכים",
  TRANSFER_TRAINEES: "העברת חניכים",
  ENTER_REPORTS: "הזנת דיווחים",
  EDIT_REPORTS: "עריכת דיווחים",
  MANAGE_STAGE_SETTINGS: "ניהול הגדרות שלבים",
  MANAGE_GROUP_SETTINGS: "ניהול הגדרות קבוצה",
  MANAGE_TRAINEE_SETTINGS: "ניהול הגדרות חניך",
  MANAGE_VACATIONS: "ניהול חופשות",
};

const PERMISSION_EFFECT_LABELS: Record<string, string> = {
  ALLOW: "מאושר",
  DENY: "חסום",
};

type PermissionsPageProps = {
  searchParams?: Promise<{
    permissionError?: SearchParamValue;
    permissionNotice?: SearchParamValue;
  }>;
};

function rolePermissionKey(role: StaffRole, action: PermissionAction): string {
  return `${role}:${action}`;
}

function permissionActionLabel(action: PermissionAction): string {
  return PERMISSION_ACTION_LABELS[action];
}

function permissionEffectLabel(effect: string): string {
  return PERMISSION_EFFECT_LABELS[effect] ?? effect;
}

export default async function PermissionsPage({ searchParams }: PermissionsPageProps) {
  const session = await auth();
  const query = searchParams ? await searchParams : {};

  if (!session?.user) {
    return (
      <AppShell>
        <section className={styles.emptyState}>
          <h1>נדרשת התחברות</h1>
          <p>יש להתחבר כדי לנהל הרשאות.</p>
          <Link href="/login" className={styles.primaryButton}>
            התחברות
          </Link>
        </section>
      </AppShell>
    );
  }

  const actor = {
    id: session.user.id,
    institutionId: session.user.institutionId,
    role: session.user.role,
  };
  const canManagePermissions = await resolvePermission(actor, "MANAGE_PERMISSIONS");

  if (!canManagePermissions) {
    return (
      <AppShell user={session.user} backHref="/" backLabel="חזרה לקבוצות">
        <section className={styles.emptyState}>
          <h1>אין הרשאה</h1>
          <p>אין לך הרשאה לנהל הרשאות.</p>
        </section>
      </AppShell>
    );
  }

  const institution = await getInstitutionById(session.user.institutionId);
  const [rolePermissions, userOverrides, staffUsers, groups, trainees] = await Promise.all([
    listRolePermissionsByInstitution(session.user.institutionId),
    listUserPermissionOverridesByInstitution(session.user.institutionId),
    listStaffByInstitution(session.user.institutionId),
    listGroupsByInstitution(session.user.institutionId, { includeInactive: true }),
    listTraineesByInstitution(session.user.institutionId),
  ]);
  const rolePermissionLookup = new Map(
    rolePermissions.map((permission) => [
      rolePermissionKey(permission.role, permission.action),
      permission.allowed,
    ]),
  );
  const message =
    permissionErrorMessage(query.permissionError) ??
    permissionNoticeMessage(query.permissionNotice);

  return (
    <AppShell user={session.user} backHref="/" backLabel="חזרה לקבוצות">
      <section className={styles.pageTitle}>
        <p className={styles.kicker}>הרשאות</p>
        <div className={styles.titleRow}>
          <div>
            <h1>{institution?.name ?? "ניהול הרשאות"}</h1>
            <p>ניהול הרשאות תפקיד וחריגות משתמש לפי טווח הרשאה.</p>
          </div>
          <span className={styles.metricPill}>{userOverrides.length} חריגות</span>
        </div>
      </section>

      {message && (
        <p className={query.permissionError ? styles.errorMessage : styles.successMessage} role="status">
          {message}
        </p>
      )}

      <section className={styles.sectionBlock} aria-labelledby="role-permission-form-title">
        <div className={styles.sectionHeader}>
          <h2 id="role-permission-form-title">הרשאת תפקיד</h2>
        </div>
        <form action={setRolePermissionAction} className={styles.managementForm}>
          <label className={styles.fieldLabel}>
            תפקיד
            <select name="role" required defaultValue="COUNSELOR">
              {STAFF_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.fieldLabel}>
            פעולה
            <select name="action" required defaultValue="VIEW_REPORTS">
              {MANAGEABLE_PERMISSION_ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {permissionActionLabel(action)}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.fieldLabel}>
            מצב
            <select name="allowed" required defaultValue="false">
              <option value="true">מותר</option>
              <option value="false">חסום</option>
            </select>
          </label>
          <button type="submit" className={styles.primaryButton}>
            שמירה
          </button>
        </form>
      </section>

      <section className={styles.sectionBlock} aria-labelledby="role-permission-table-title">
        <div className={styles.sectionHeader}>
          <h2 id="role-permission-table-title">מצב הרשאות תפקיד</h2>
          <span>{MANAGEABLE_PERMISSION_ACTIONS.length} פעולות</span>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.dataTable} aria-label="מצב הרשאות לפי תפקיד">
            <thead>
              <tr>
                <th scope="col">פעולה</th>
                {STAFF_ROLES.map((role) => (
                  <th key={role} scope="col">
                    {ROLE_LABELS[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MANAGEABLE_PERMISSION_ACTIONS.map((action) => (
                <tr key={action}>
                  <th scope="row">{permissionActionLabel(action)}</th>
                  {STAFF_ROLES.map((role) => {
                    const allowed =
                      rolePermissionLookup.get(rolePermissionKey(role, action)) ??
                      isRolePermissionAllowedByDefault(role);
                    return (
                      <td key={role}>
                        <span className={allowed ? styles.successBadge : styles.warningBadge}>
                          {allowed ? "מותר" : "חסום"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.sectionBlock} aria-labelledby="user-override-form-title">
        <div className={styles.sectionHeader}>
          <h2 id="user-override-form-title">חריגת משתמש</h2>
        </div>
        <form action={setUserPermissionOverrideAction} className={styles.managementForm}>
          <label className={styles.fieldLabel}>
            משתמש
            <select name="staffId" required defaultValue="">
              <option value="" disabled>
                בחירת משתמש
              </option>
              {staffUsers.map((staffUser) => (
                <option key={staffUser.id} value={staffUser.id}>
                  {staffUser.name} ({staffUser.email})
                </option>
              ))}
            </select>
          </label>
          <label className={styles.fieldLabel}>
            פעולה
            <select name="action" required defaultValue="VIEW_REPORTS">
              {MANAGEABLE_PERMISSION_ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {permissionActionLabel(action)}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.fieldLabel}>
            תוצאה
            <select name="effect" required defaultValue="ALLOW">
              <option value="ALLOW">מאושר</option>
              <option value="DENY">חסום</option>
            </select>
          </label>
          <label className={styles.fieldLabel}>
            טווח הרשאה
            <select name="scopeType" required defaultValue="institution">
              <option value="institution">מוסד</option>
              <option value="group">קבוצה</option>
              <option value="trainee">חניך</option>
            </select>
          </label>
          <label className={styles.fieldLabel}>
            קבוצה
            <select name="groupId" defaultValue="">
              <option value="">ללא</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.fieldLabel}>
            חניך
            <select name="traineeId" defaultValue="">
              <option value="">ללא</option>
              {trainees.map((trainee) => (
                <option key={trainee.id} value={trainee.id}>
                  {trainee.firstName} {trainee.lastName}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={styles.primaryButton}>
            שמירה
          </button>
        </form>
      </section>

      <section className={styles.sectionBlock} aria-labelledby="user-overrides-title">
        <div className={styles.sectionHeader}>
          <h2 id="user-overrides-title">חריגות פעילות</h2>
          <span>{userOverrides.length} רשומות</span>
        </div>
        {userOverrides.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.dataTable} aria-label="חריגות הרשאה לפי משתמש">
              <thead>
                <tr>
                  <th scope="col">משתמש</th>
                  <th scope="col">פעולה</th>
                  <th scope="col">תוצאה</th>
                  <th scope="col">טווח הרשאה</th>
                </tr>
              </thead>
              <tbody>
                {userOverrides.map((override) => (
                  <tr key={override.id}>
                    <td>{override.staff.name}</td>
                    <td>{permissionActionLabel(override.action)}</td>
                    <td>
                      <span
                        className={
                          override.effect === "ALLOW" ? styles.successBadge : styles.warningBadge
                        }
                      >
                        {permissionEffectLabel(override.effect)}
                      </span>
                    </td>
                    <td>
                      {override.group
                        ? `קבוצה: ${override.group.name}`
                        : override.trainee
                          ? `חניך: ${override.trainee.firstName} ${override.trainee.lastName}`
                          : "מוסד"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.mutedText}>אין חריגות הרשאה להצגה.</p>
        )}
      </section>
    </AppShell>
  );
}
