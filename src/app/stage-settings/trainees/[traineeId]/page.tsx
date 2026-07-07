import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/app/AppShell";
import {
  publishTraineeStageSettingsAction,
  saveTraineeStageSettingsDraftAction,
} from "@/app/stage-settings/actions";
import { loadTraineeStageSettings } from "@/app/stage-settings/data";
import { ScopedStageSettingsPage } from "@/app/stage-settings/ScopedStageSettingsPage";
import type { SearchParamValue } from "@/app/stage-settings/stageSettingsActionMessages";
import styles from "@/app/page.module.css";
import { auth } from "@/lib/auth";
import { getTraineeById } from "@/repositories/traineeRepository";
import { resolvePermission } from "@/services/permissions/resolvePermission";

export default async function TraineeStageSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ traineeId: string }>;
  searchParams?: Promise<{
    settingsError?: SearchParamValue;
    settingsNotice?: SearchParamValue;
  }>;
}) {
  const { traineeId } = await params;
  const query = searchParams ? await searchParams : {};
  const session = await auth();

  if (!session?.user) {
    return (
      <AppShell>
        <section className={styles.emptyState}>
          <h1>נדרשת התחברות</h1>
          <p>יש להתחבר כדי לנהל הגדרות חניך.</p>
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

  const actor = {
    id: session.user.id,
    institutionId: session.user.institutionId,
    role: session.user.role,
  };
  const canManageTraineeSettings = await resolvePermission(actor, "MANAGE_TRAINEE_SETTINGS", {
    traineeId: trainee.id,
    ...(trainee.groupId ? { groupId: trainee.groupId } : {}),
  });

  if (!canManageTraineeSettings) {
    return (
      <AppShell user={session.user} backHref={`/trainees/${trainee.id}`} backLabel="חזרה לחניך">
        <section className={styles.emptyState}>
          <h1>אין הרשאה</h1>
          <p>אין לך הרשאה לנהל הגדרות חניך.</p>
        </section>
      </AppShell>
    );
  }

  const settingsData = await loadTraineeStageSettings(trainee.institutionId, trainee.id);
  const traineeName = `${trainee.firstName} ${trainee.lastName}`;

  return (
    <ScopedStageSettingsPage
      user={session.user}
      title={traineeName}
      kicker="הגדרות חניך"
      backHref={`/trainees/${trainee.id}`}
      backLabel="חזרה לחניך"
      scopeFieldName="traineeId"
      scopeId={trainee.id}
      returnTo={`/stage-settings/trainees/${trainee.id}`}
      settingsData={settingsData}
      settingsError={query.settingsError}
      settingsNotice={query.settingsNotice}
      saveAction={saveTraineeStageSettingsDraftAction}
      publishAction={publishTraineeStageSettingsAction}
    />
  );
}
