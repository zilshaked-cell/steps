const TRAINEE_ERROR_MESSAGES: Record<string, string> = {
  "actor-out-of-scope": "לא ניתן לשמור חניך מחוץ למוסד שלך.",
  forbidden: "אין לך הרשאה לנהל חניכים.",
  "group-inactive": "לא ניתן לשייך חניך לקבוצה בארכיון.",
  "group-not-found": "הקבוצה לא נמצאה.",
  "invalid-date": "תאריך התחולה אינו תקין.",
  "invalid-name": "שם פרטי ושם משפחה הם שדות חובה.",
  "noop-transfer": "החניך כבר משויך לקבוצה שנבחרה.",
  "stage-not-found": "השלב שנבחר לא נמצא במוסד שלך.",
  "trainee-not-found": "החניך לא נמצא.",
};

const TRAINEE_NOTICE_MESSAGES: Record<string, string> = {
  created: "החניך נוסף.",
  transferred: "החניך הועבר קבוצה.",
  updated: "פרטי החניך נשמרו.",
};

export type SearchParamValue = string | string[] | undefined;

export function firstSearchParam(value: SearchParamValue): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function traineeErrorMessage(value: SearchParamValue): string | null {
  const key = firstSearchParam(value);
  return key ? (TRAINEE_ERROR_MESSAGES[key] ?? "לא ניתן לשמור את החניך.") : null;
}

export function traineeNoticeMessage(value: SearchParamValue): string | null {
  const key = firstSearchParam(value);
  return key ? (TRAINEE_NOTICE_MESSAGES[key] ?? null) : null;
}
