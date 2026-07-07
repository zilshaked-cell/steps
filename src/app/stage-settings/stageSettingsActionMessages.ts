const STAGE_SETTINGS_ERROR_MESSAGES: Record<string, string> = {
  "actor-out-of-scope": "לא ניתן לנהל הגדרות מחוץ למוסד שלך.",
  forbidden: "אין לך הרשאה לנהל הגדרות שלבים.",
  "group-not-found": "הקבוצה לא נמצאה.",
  "invalid-date": "יש לבחור תאריך תחולה תקין.",
  "invalid-parameters": "יש למלא לפחות פרמטר אחד עם שם, סולם ומשקל תקינים.",
  "parameter-invalid": "אחד הפרמטרים אינו תקין.",
  "parameter-out-of-scope": "הפרמטר או השלב שנבחרו אינם שייכים לתכנית הפעילה.",
  "profile-not-draft": "אפשר לערוך או לפרסם רק טיוטה.",
  "profile-not-found": "טיוטת פרופיל הניקוד לא נמצאה.",
  "stage-program-version-not-found": "לא נמצאה תכנית שלבים פעילה.",
  "trainee-not-found": "החניך לא נמצא.",
  "weights-unbalanced": "אי אפשר לפרסם לפני שסך המשקלים האפקטיבי הוא 100%.",
};

const STAGE_SETTINGS_NOTICE_MESSAGES: Record<string, string> = {
  "draft-saved": "טיוטת ההגדרות נשמרה.",
  published: "פרופיל הניקוד פורסם.",
};

export type SearchParamValue = string | string[] | undefined;

export function firstSearchParam(value: SearchParamValue): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function stageSettingsErrorMessage(value: SearchParamValue): string | null {
  const key = firstSearchParam(value);
  return key ? (STAGE_SETTINGS_ERROR_MESSAGES[key] ?? "לא ניתן לשמור את ההגדרות.") : null;
}

export function stageSettingsNoticeMessage(value: SearchParamValue): string | null {
  const key = firstSearchParam(value);
  return key ? (STAGE_SETTINGS_NOTICE_MESSAGES[key] ?? null) : null;
}
