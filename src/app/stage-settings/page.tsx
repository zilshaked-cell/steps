import Link from "next/link";
import { AppShell } from "@/app/AppShell";
import {
  publishInstitutionStageSettingsAction,
  saveInstitutionStageSettingsDraftAction,
} from "@/app/stage-settings/actions";
import { loadInstitutionStageSettings } from "@/app/stage-settings/data";
import {
  stageSettingsErrorMessage,
  stageSettingsNoticeMessage,
  type SearchParamValue,
} from "@/app/stage-settings/stageSettingsActionMessages";
import styles from "@/app/page.module.css";
import { auth } from "@/lib/auth";
import { getInstitutionById } from "@/repositories/institutionRepository";
import { resolvePermission } from "@/services/permissions/resolvePermission";
import type { ConfigurationStatus, ScoreScale } from "@/generated/prisma/enums";

type StageSettingsPageProps = {
  searchParams?: Promise<{
    settingsError?: SearchParamValue;
    settingsNotice?: SearchParamValue;
  }>;
};

type EditableParameter = {
  sourceParameterDefinitionId: string | null;
  stageId: string | null;
  name: string;
  verbalDefinition: string;
  scoreScale: ScoreScale;
  weightPercent: number;
  active: boolean;
  displayOrder: number | null;
  origin: string;
  required: boolean;
};

const SCORE_SCALE_LABELS: Record<ScoreScale, string> = {
  ONE_TO_THREE: "1-3",
  ONE_TO_TEN: "1-10",
  ONE_TO_ONE_HUNDRED: "1-100",
};

const PROFILE_STATUS_LABELS: Record<ConfigurationStatus, string> = {
  DRAFT: "טיוטה",
  PUBLISHED: "פורסם",
  REPLACED: "הוחלף",
};

function dateInputValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shortDate(value: Date | null): string {
  if (!value) return "לא פורסם";
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "short" }).format(value);
}

function editableFromData(
  data: Awaited<ReturnType<typeof loadInstitutionStageSettings>>,
): { profileId: string | null; profileName: string; sourceLabel: string; parameters: EditableParameter[] } {
  const profile = data.draftProfile ?? data.publishedProfile;
  if (profile) {
    return {
      profileId: data.draftProfile ? profile.id : null,
      profileName: profile.name ?? "",
      sourceLabel: data.draftProfile ? "טיוטה פתוחה" : "מבוסס על הפרסום האחרון",
      parameters: profile.parameters.map((parameter) => {
        const source = parameter.sourceParameterDefinition;
        const name = parameter.name ?? source?.name ?? "פרמטר ללא שם";
        return {
          sourceParameterDefinitionId: parameter.sourceParameterDefinitionId,
          stageId: parameter.stageId ?? source?.stageId ?? null,
          name,
          verbalDefinition: parameter.verbalDefinition ?? source?.verbalDefinition ?? "",
          scoreScale: parameter.scoreScale ?? source?.scoreScale ?? "ONE_TO_TEN",
          weightPercent: parameter.weightPercent ?? source?.weightPercent ?? 0,
          active: parameter.active,
          displayOrder: parameter.displayOrder,
          origin: source ? `מקור: ${source.name}` : "פרמטר מוסדי מותאם",
          required: true,
        };
      }),
    };
  }

  return {
    profileId: null,
    profileName: "",
    sourceLabel: "מבוסס על תכנית השלבים הפעילה",
    parameters: (data.version?.parameters ?? []).map((parameter) => ({
      sourceParameterDefinitionId: parameter.id,
      stageId: parameter.stageId,
      name: parameter.name,
      verbalDefinition: parameter.verbalDefinition ?? "",
      scoreScale: parameter.scoreScale,
      weightPercent: parameter.weightPercent,
      active: parameter.active,
      displayOrder: parameter.displayOrder,
      origin: "פרמטר מקור",
      required: true,
    })),
  };
}

function stageName(stageId: string | null, stages: Array<{ id: string; name: string }>): string {
  if (!stageId) return "כל השלבים";
  return stages.find((stage) => stage.id === stageId)?.name ?? "שלב לא ידוע";
}

function ParameterRows({
  parameters,
  stages,
}: {
  parameters: EditableParameter[];
  stages: Array<{ id: string; name: string }>;
}) {
  const rows: EditableParameter[] = [
    ...parameters,
    {
      sourceParameterDefinitionId: null,
      stageId: null,
      name: "",
      verbalDefinition: "",
      scoreScale: "ONE_TO_TEN",
      weightPercent: 0,
      active: true,
      displayOrder: null,
      origin: "פרמטר חדש",
      required: false,
    },
  ];

  return (
    <>
      <input type="hidden" name="rowCount" value={rows.length} />
      <div className={styles.tableWrap}>
        <table className={`${styles.dataTable} ${styles.settingsTable}`} aria-label="פרמטרי ניקוד מוסדיים">
          <thead>
            <tr>
              <th scope="col">פעיל</th>
              <th scope="col">שם</th>
              <th scope="col">הגדרה</th>
              <th scope="col">סולם</th>
              <th scope="col">משקל</th>
              <th scope="col">תחולה</th>
              <th scope="col">מקור</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((parameter, index) => (
              <tr key={`${parameter.sourceParameterDefinitionId ?? "new"}-${index}`}>
                <td>
                  <input
                    type="checkbox"
                    name={`active_${index}`}
                    value="true"
                    defaultChecked={parameter.active}
                    aria-label={`סימון פעיל עבור ${parameter.name || "פרמטר חדש"}`}
                  />
                  <input type="hidden" name={`active_${index}`} value="false" />
                </td>
                <td>
                  {parameter.sourceParameterDefinitionId && (
                    <input
                      type="hidden"
                      name={`sourceParameterDefinitionId_${index}`}
                      value={parameter.sourceParameterDefinitionId}
                    />
                  )}
                  <input
                    name={`name_${index}`}
                    type="text"
                    required={parameter.required}
                    maxLength={160}
                    defaultValue={parameter.name}
                    aria-label="שם פרמטר"
                  />
                </td>
                <td>
                  <textarea
                    name={`verbalDefinition_${index}`}
                    rows={2}
                    maxLength={500}
                    defaultValue={parameter.verbalDefinition}
                    aria-label="הגדרה מילולית"
                  />
                </td>
                <td>
                  <select
                    name={`scoreScale_${index}`}
                    required={parameter.required}
                    defaultValue={parameter.scoreScale}
                    aria-label="סולם ניקוד"
                  >
                    {Object.entries(SCORE_SCALE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    name={`weightPercent_${index}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    required={parameter.required}
                    defaultValue={parameter.required ? parameter.weightPercent : ""}
                    aria-label="אחוז משקל"
                  />
                </td>
                <td>
                  <select name={`stageId_${index}`} defaultValue={parameter.stageId ?? ""} aria-label="תחולת שלב">
                    <option value="">כל השלבים</option>
                    {stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{parameter.origin}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default async function StageSettingsPage({ searchParams }: StageSettingsPageProps) {
  const session = await auth();
  const query = searchParams ? await searchParams : {};

  if (!session?.user) {
    return (
      <AppShell>
        <section className={styles.emptyState}>
          <h1>נדרשת התחברות</h1>
          <p>יש להתחבר כדי לנהל הגדרות שלבים.</p>
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
  const canManageStageSettings = await resolvePermission(actor, "MANAGE_STAGE_SETTINGS");

  if (!canManageStageSettings) {
    return (
      <AppShell user={session.user} backHref="/" backLabel="חזרה לקבוצות">
        <section className={styles.emptyState}>
          <h1>אין הרשאה</h1>
          <p>אין לך הרשאה לנהל הגדרות שלבים.</p>
        </section>
      </AppShell>
    );
  }

  const [institution, settingsData] = await Promise.all([
    getInstitutionById(session.user.institutionId),
    loadInstitutionStageSettings(session.user.institutionId),
  ]);
  const message =
    stageSettingsErrorMessage(query.settingsError) ??
    stageSettingsNoticeMessage(query.settingsNotice);

  if (!settingsData.version) {
    return (
      <AppShell user={session.user} backHref="/" backLabel="חזרה לקבוצות">
        <section className={styles.emptyState}>
          <h1>אין תכנית שלבים פעילה</h1>
          <p>צריך תכנית שלבים פעילה לפני ניהול פרמטרים מוסדיים.</p>
        </section>
      </AppShell>
    );
  }

  const editable = editableFromData(settingsData);
  const version = settingsData.version;
  const activeParameters = editable.parameters.filter((parameter) => parameter.active);
  const inactiveParameters = editable.parameters.filter((parameter) => !parameter.active);

  return (
    <AppShell user={session.user} backHref="/" backLabel="חזרה לקבוצות">
      <section className={styles.pageTitle}>
        <p className={styles.kicker}>הגדרות שלבים</p>
        <div className={styles.titleRow}>
          <div>
            <h1>{institution?.name ?? "הגדרות פרמטרים מוסדיות"}</h1>
            <p>ניהול פרמטרי ניקוד מוסדיים, טיוטה ופרסום.</p>
          </div>
          <span className={styles.metricPill}>{activeParameters.length} פרמטרים פעילים</span>
        </div>
      </section>

      {message && (
        <p className={query.settingsError ? styles.errorMessage : styles.successMessage} role="status">
          {message}
        </p>
      )}

      <section className={styles.overviewGrid} aria-label="מצב הגדרות">
        <div className={styles.metricCard}>
          <span>גרסת תכנית</span>
          <strong>{version.versionNumber}</strong>
        </div>
        <div className={styles.metricCard}>
          <span>ימי מדידה</span>
          <strong>{version.requiredMeasurementDays}</strong>
        </div>
        <div className={styles.metricCard}>
          <span>טיוטה</span>
          <strong>{settingsData.draftProfile ? "קיימת" : "אין"}</strong>
        </div>
        <div className={styles.metricCard}>
          <span>פרסום נוכחי</span>
          <strong>{shortDate(settingsData.publishedProfile?.effectiveFrom ?? null)}</strong>
        </div>
      </section>

      <section className={styles.sectionBlock} aria-labelledby="stage-settings-form-title">
        <div className={styles.sectionHeader}>
          <h2 id="stage-settings-form-title">פרופיל ניקוד מוסדי</h2>
          <span>{editable.sourceLabel}</span>
        </div>
        <form action={saveInstitutionStageSettingsDraftAction} className={styles.settingsForm}>
          <input type="hidden" name="stageProgramVersionId" value={version.id} />
          {editable.profileId && <input type="hidden" name="profileId" value={editable.profileId} />}
          <label className={styles.fieldLabel}>
            שם פרופיל
            <input name="profileName" type="text" maxLength={160} defaultValue={editable.profileName} />
          </label>
          <ParameterRows parameters={editable.parameters} stages={version.stages} />
          <div className={styles.formFooter}>
            <button type="submit" className={styles.primaryButton}>
              שמירת טיוטה
            </button>
          </div>
        </form>
      </section>

      <section className={styles.sectionBlock} aria-labelledby="publish-profile-title">
        <div className={styles.sectionHeader}>
          <h2 id="publish-profile-title">פרסום</h2>
          <span>
            {settingsData.draftProfile
              ? PROFILE_STATUS_LABELS[settingsData.draftProfile.status]
              : "אין טיוטה לפרסום"}
          </span>
        </div>
        {settingsData.draftProfile ? (
          <form action={publishInstitutionStageSettingsAction} className={styles.managementForm}>
            <input type="hidden" name="profileId" value={settingsData.draftProfile.id} />
            <label className={styles.fieldLabel}>
              תאריך תחולה
              <input name="effectiveFrom" type="date" required defaultValue={dateInputValue()} />
            </label>
            <button type="submit" className={styles.primaryButton}>
              פרסום פרופיל
            </button>
          </form>
        ) : (
          <p className={styles.mutedText}>שמירת טיוטה תפתח פרופיל לפרסום.</p>
        )}
      </section>

      <section className={styles.sectionBlock} aria-labelledby="inactive-parameters-title">
        <div className={styles.sectionHeader}>
          <h2 id="inactive-parameters-title">פרמטרי עבר</h2>
          <span>{inactiveParameters.length} פרמטרים</span>
        </div>
        {inactiveParameters.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.dataTable} aria-label="פרמטרים לא פעילים">
              <thead>
                <tr>
                  <th scope="col">שם</th>
                  <th scope="col">תחולה</th>
                  <th scope="col">סולם</th>
                  <th scope="col">משקל אחרון</th>
                </tr>
              </thead>
              <tbody>
                {inactiveParameters.map((parameter, index) => (
                  <tr key={`${parameter.sourceParameterDefinitionId ?? parameter.name}-${index}`}>
                    <td>{parameter.name}</td>
                    <td>{stageName(parameter.stageId, version.stages)}</td>
                    <td>{SCORE_SCALE_LABELS[parameter.scoreScale]}</td>
                    <td>{parameter.weightPercent.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.mutedText}>אין פרמטרי עבר להצגה.</p>
        )}
      </section>
    </AppShell>
  );
}
