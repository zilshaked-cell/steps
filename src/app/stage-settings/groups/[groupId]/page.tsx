import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/app/AppShell";
import {
  publishGroupStageSettingsAction,
  saveGroupStageSettingsDraftAction,
} from "@/app/stage-settings/actions";
import { loadGroupStageSettings } from "@/app/stage-settings/data";
import { ScopedStageSettingsPage } from "@/app/stage-settings/ScopedStageSettingsPage";
import type { SearchParamValue } from "@/app/stage-settings/stageSettingsActionMessages";
import styles from "@/app/page.module.css";
import { auth } from "@/lib/auth";
import { getGroupById } from "@/repositories/groupRepository";
import { resolvePermission } from "@/services/permissions/resolvePermission";

export default async function GroupStageSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams?: Promise<{
    settingsError?: SearchParamValue;
    settingsNotice?: SearchParamValue;
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
          <p>יש להתחבר כדי לנהל הגדרות קבוצה.</p>
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
  const canManageGroupSettings = await resolvePermission(actor, "MANAGE_GROUP_SETTINGS", {
    groupId: group.id,
  });

  if (!canManageGroupSettings) {
    return (
      <AppShell user={session.user} backHref={`/groups/${group.id}`} backLabel="חזרה לקבוצה">
        <section className={styles.emptyState}>
          <h1>אין הרשאה</h1>
          <p>אין לך הרשאה לנהל הגדרות קבוצה.</p>
        </section>
      </AppShell>
    );
  }

  const settingsData = await loadGroupStageSettings(group.institutionId, group.id);

  return (
    <ScopedStageSettingsPage
      user={session.user}
      title={group.name}
      kicker="הגדרות קבוצה"
      backHref={`/groups/${group.id}`}
      backLabel="חזרה לקבוצה"
      scopeFieldName="groupId"
      scopeId={group.id}
      returnTo={`/stage-settings/groups/${group.id}`}
      settingsData={settingsData}
      settingsError={query.settingsError}
      settingsNotice={query.settingsNotice}
      saveAction={saveGroupStageSettingsDraftAction}
      publishAction={publishGroupStageSettingsAction}
    />
  );
}
