const REPORT_ERROR_MESSAGES: Record<string, string> = {
  "actor-out-of-scope": "לא ניתן לדווח מחוץ למוסד שלך.",
  "entry-invalid": "יש למלא לפחות פרמטר אחד לדיווח.",
  forbidden: "אין לך הרשאה לשמור או לפרסם דיווח.",
  "group-inactive": "אי אפשר לפתוח דיווח חדש לקבוצה בארכיון.",
  "group-not-found": "לא נמצאה קבוצה תקפה לדיווח.",
  "invalid-date": "יש לבחור מועד מדידה תקין.",
  "invalid-entries": "יש למלא סטטוס תקין לכל פרמטר.",
  "parameter-duplicate": "אותו פרמטר מופיע יותר מפעם אחת בדיווח.",
  "parameter-out-of-scope": "אחד הפרמטרים אינו פעיל לדיווח הזה.",
  "report-already-published": "דיווח מפורסם ניתן לעריכה רק דרך פרסום מחדש.",
  "report-conflict": "כבר קיימים ציונים גלויים למועד הזה. יש לפרסם החלפה במקום לשמור טיוטה.",
  "report-not-found": "הדיווח לא נמצא.",
  "score-out-of-range": "אחד הציונים מחוץ לסולם המותר.",
  "stage-program-version-not-found": "לא נמצאה תכנית שלבים פעילה לדיווח.",
  "trainee-inactive": "אי אפשר לפתוח דיווח חדש לחניך לא פעיל.",
  "trainee-not-found": "החניך לא נמצא.",
};

const REPORT_NOTICE_MESSAGES: Record<string, string> = {
  "draft-saved": "טיוטת הדיווח נשמרה.",
  published: "הדיווח פורסם.",
};

export type SearchParamValue = string | string[] | undefined;

function firstSearchParam(value: SearchParamValue): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function reportErrorMessage(value: SearchParamValue): string | null {
  const key = firstSearchParam(value);
  return key ? (REPORT_ERROR_MESSAGES[key] ?? "לא ניתן לשמור את הדיווח.") : null;
}

export function reportNoticeMessage(value: SearchParamValue): string | null {
  const key = firstSearchParam(value);
  return key ? (REPORT_NOTICE_MESSAGES[key] ?? null) : null;
}
