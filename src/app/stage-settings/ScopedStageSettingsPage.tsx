import { AppShell } from "@/app/AppShell";
import type { InstitutionStageSettingsData } from "@/app/stage-settings/data";
import {
  stageSettingsErrorMessage,
  stageSettingsNoticeMessage,
  type SearchParamValue,
} from "@/app/stage-settings/stageSettingsActionMessages";
import styles from "@/app/page.module.css";
import type { ConfigurationStatus, ScoreScale } from "@/generated/prisma/enums";

type AppShellUser = {
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

type ScopedStageSettingsPageProps = {
  user: AppShellUser;
  title: string;
  kicker: string;
  backHref: string;
  backLabel: string;
  scopeFieldName: "groupId" | "traineeId";
  scopeId: string;
  returnTo: string;
  settingsData: InstitutionStageSettingsData;
  settingsError?: SearchParamValue;
  settingsNotice?: SearchParamValue;
  saveAction: (formData: FormData) => Promise<void>;
  publishAction: (formData: FormData) => Promise<void>;
};

type LocalEditableParameter = {
  sourceParameterDefinitionId: string | null;
  stageId: string | null;
  name: string;
  nameInherited: boolean;
  verbalDefinition: string;
  definitionInherited: boolean;
  scoreScale: ScoreScale;
  scoreScaleInherited: boolean;
  weightPercent: number;
  weightInherited: boolean;
  active: boolean;
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

function editableFromData(
  data: InstitutionStageSettingsData,
): { profileId: string | null; profileName: string; sourceLabel: string; parameters: LocalEditableParameter[] } {
  const profile = data.draftProfile ?? data.publishedProfile;
  if (profile) {
    return {
      profileId: data.draftProfile ? profile.id : null,
      profileName: profile.name ?? "",
      sourceLabel: data.draftProfile ? "טיוטה פתוחה" : "מבוסס על הפרסום האחרון",
      parameters: profile.parameters.map((parameter) => {
        const source = parameter.sourceParameterDefinition;
        const hasSource = source !== null;
        return {
          sourceParameterDefinitionId: parameter.sourceParameterDefinitionId,
          stageId: parameter.stageId ?? source?.stageId ?? null,
          name: parameter.name ?? source?.name ?? "",
          nameInherited: hasSource && parameter.name == null,
          verbalDefinition: parameter.verbalDefinition ?? source?.verbalDefinition ?? "",
          definitionInherited: hasSource && parameter.verbalDefinition == null,
          scoreScale: parameter.scoreScale ?? source?.scoreScale ?? "ONE_TO_TEN",
          scoreScaleInherited: hasSource && parameter.scoreScale == null,
          weightPercent: parameter.weightPercent ?? source?.weightPercent ?? 0,
          weightInherited: hasSource && parameter.weightPercent == null,
          active: parameter.active,
          origin: source ? `מקור: ${source.name}` : "פרמטר מקומי חדש",
          required: true,
        };
      }),
    };
  }

  return {
    profileId: null,
    profileName: "",
    sourceLabel: "הכול בירושה מההגדרות המוסדיות",
    parameters: (data.version?.parameters ?? []).map((parameter) => ({
      sourceParameterDefinitionId: parameter.id,
      stageId: parameter.stageId,
      name: parameter.name,
      nameInherited: true,
      verbalDefinition: parameter.verbalDefinition ?? "",
      definitionInherited: true,
      scoreScale: parameter.scoreScale,
      scoreScaleInherited: true,
      weightPercent: parameter.weightPercent,
      weightInherited: true,
      active: parameter.active,
      origin: "פרמטר מקור",
      required: true,
    })),
  };
}

function inheritanceLabel(parameter: LocalEditableParameter): "בירושה" | "מותאם" {
  if (!parameter.sourceParameterDefinitionId) return "מותאם";
  return parameter.nameInherited &&
    parameter.definitionInherited &&
    parameter.scoreScaleInherited &&
    parameter.weightInherited
    ? "בירושה"
    : "מותאם";
}

function InheritToggle({
  name,
  defaultChecked,
  disabled,
}: {
  name: string;
  defaultChecked: boolean;
  disabled: boolean;
}) {
  if (disabled) {
    return <input type="hidden" name={name} value="false" />;
  }

  return (
    <label className={styles.inlineCheck}>
      <input type="checkbox" name={name} value="true" defaultChecked={defaultChecked} />
      <input type="hidden" name={name} value="false" />
      בירושה
    </label>
  );
}

function LocalParameterRows({
  parameters,
  stages,
}: {
  parameters: LocalEditableParameter[];
  stages: Array<{ id: string; name: string }>;
}) {
  const rows: LocalEditableParameter[] = [
    ...parameters,
    {
      sourceParameterDefinitionId: null,
      stageId: null,
      name: "",
      nameInherited: false,
      verbalDefinition: "",
      definitionInherited: false,
      scoreScale: "ONE_TO_TEN",
      scoreScaleInherited: false,
      weightPercent: 0,
      weightInherited: false,
      active: true,
      origin: "פרמטר מקומי חדש",
      required: false,
    },
  ];

  return (
    <>
      <input type="hidden" name="rowCount" value={rows.length} />
      <div className={styles.tableWrap}>
        <table className={`${styles.dataTable} ${styles.settingsTable}`} aria-label="פרמטרי ניקוד מקומיים">
          <thead>
            <tr>
              <th scope="col">פעיל</th>
              <th scope="col">שם</th>
              <th scope="col">הגדרה</th>
              <th scope="col">סולם</th>
              <th scope="col">משקל</th>
              <th scope="col">תחולה</th>
              <th scope="col">מצב</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((parameter, index) => {
              const hasSource = parameter.sourceParameterDefinitionId !== null;
              const label = inheritanceLabel(parameter);
              return (
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
                      required={parameter.required && !parameter.nameInherited}
                      maxLength={160}
                      defaultValue={parameter.name}
                      aria-label="שם פרמטר"
                    />
                    <InheritToggle
                      name={`inheritName_${index}`}
                      defaultChecked={parameter.nameInherited}
                      disabled={!hasSource}
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
                    <InheritToggle
                      name={`inheritDefinition_${index}`}
                      defaultChecked={parameter.definitionInherited}
                      disabled={!hasSource}
                    />
                  </td>
                  <td>
                    <select
                      name={`scoreScale_${index}`}
                      required={parameter.required && !parameter.scoreScaleInherited}
                      defaultValue={parameter.scoreScale}
                      aria-label="סולם ניקוד"
                    >
                      {Object.entries(SCORE_SCALE_LABELS).map(([value, scaleLabel]) => (
                        <option key={value} value={value}>
                          {scaleLabel}
                        </option>
                      ))}
                    </select>
                    <InheritToggle
                      name={`inheritScoreScale_${index}`}
                      defaultChecked={parameter.scoreScaleInherited}
                      disabled={!hasSource}
                    />
                  </td>
                  <td>
                    <input
                      name={`weightPercent_${index}`}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      required={parameter.required && !parameter.weightInherited}
                      defaultValue={parameter.required ? parameter.weightPercent : ""}
                      aria-label="אחוז משקל"
                    />
                    <InheritToggle
                      name={`inheritWeight_${index}`}
                      defaultChecked={parameter.weightInherited}
                      disabled={!hasSource}
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
                  <td>
                    <span className={label === "בירושה" ? styles.successBadge : styles.warningBadge}>
                      {label}
                    </span>
                    <span className={styles.mutedText}>{parameter.origin}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function ScopedStageSettingsPage({
  user,
  title,
  kicker,
  backHref,
  backLabel,
  scopeFieldName,
  scopeId,
  returnTo,
  settingsData,
  settingsError,
  settingsNotice,
  saveAction,
  publishAction,
}: ScopedStageSettingsPageProps) {
  const message =
    stageSettingsErrorMessage(settingsError) ?? stageSettingsNoticeMessage(settingsNotice);

  if (!settingsData.version) {
    return (
      <AppShell user={user} backHref={backHref} backLabel={backLabel}>
        <section className={styles.emptyState}>
          <h1>אין תכנית שלבים פעילה</h1>
          <p>צריך תכנית שלבים פעילה לפני ניהול פרופיל ניקוד מקומי.</p>
        </section>
      </AppShell>
    );
  }

  const editable = editableFromData(settingsData);
  const inheritedCount = editable.parameters.filter(
    (parameter) => inheritanceLabel(parameter) === "בירושה",
  ).length;
  const customizedCount = editable.parameters.length - inheritedCount;

  return (
    <AppShell user={user} backHref={backHref} backLabel={backLabel}>
      <section className={styles.pageTitle}>
        <p className={styles.kicker}>{kicker}</p>
        <div className={styles.titleRow}>
          <div>
            <h1>{title}</h1>
            <p>ניהול פרופיל ניקוד מקומי עם ירושה מההגדרות שמעליו.</p>
          </div>
          <span className={customizedCount > 0 ? styles.warningBadge : styles.successBadge}>
            {customizedCount > 0 ? "פרופיל ניקוד מותאם" : "בירושה מלאה"}
          </span>
        </div>
      </section>

      {message && (
        <p className={settingsError ? styles.errorMessage : styles.successMessage} role="status">
          {message}
        </p>
      )}

      <section className={styles.overviewGrid} aria-label="מצב הגדרות מקומיות">
        <div className={styles.metricCard}>
          <span>גרסת תכנית</span>
          <strong>{settingsData.version.versionNumber}</strong>
        </div>
        <div className={styles.metricCard}>
          <span>בירושה</span>
          <strong>{inheritedCount}</strong>
        </div>
        <div className={styles.metricCard}>
          <span>מותאם</span>
          <strong>{customizedCount}</strong>
        </div>
        <div className={styles.metricCard}>
          <span>טיוטה</span>
          <strong>{settingsData.draftProfile ? "קיימת" : "אין"}</strong>
        </div>
      </section>

      <section className={styles.sectionBlock} aria-labelledby="local-stage-settings-title">
        <div className={styles.sectionHeader}>
          <h2 id="local-stage-settings-title">פרופיל ניקוד מקומי</h2>
          <span>{editable.sourceLabel}</span>
        </div>
        <form action={saveAction} className={styles.settingsForm}>
          <input type="hidden" name="returnTo" value={returnTo} />
          <input type="hidden" name={scopeFieldName} value={scopeId} />
          <input type="hidden" name="stageProgramVersionId" value={settingsData.version.id} />
          {editable.profileId && <input type="hidden" name="profileId" value={editable.profileId} />}
          <label className={styles.fieldLabel}>
            שם פרופיל
            <input name="profileName" type="text" maxLength={160} defaultValue={editable.profileName} />
          </label>
          <LocalParameterRows parameters={editable.parameters} stages={settingsData.version.stages} />
          <button type="submit" className={styles.primaryButton}>
            שמירת טיוטה
          </button>
        </form>
      </section>

      <section className={styles.sectionBlock} aria-labelledby="local-publish-title">
        <div className={styles.sectionHeader}>
          <h2 id="local-publish-title">פרסום</h2>
          <span>
            {settingsData.draftProfile
              ? PROFILE_STATUS_LABELS[settingsData.draftProfile.status]
              : "אין טיוטה לפרסום"}
          </span>
        </div>
        {settingsData.draftProfile ? (
          <form action={publishAction} className={styles.managementForm}>
            <input type="hidden" name="returnTo" value={returnTo} />
            <input type="hidden" name={scopeFieldName} value={scopeId} />
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
    </AppShell>
  );
}
