const GROUP_ERROR_MESSAGES: Record<string, string> = {
  "actor-out-of-scope": "לא ניתן לשמור קבוצה מחוץ למוסד שלך.",
  forbidden: "אין לך הרשאה לנהל קבוצות.",
  "group-not-found": "הקבוצה לא נמצאה.",
  "invalid-name": "שם קבוצה הוא שדה חובה.",
  "staff-out-of-scope": "ניתן לשייך רק אנשי צוות פעילים מהמוסד שלך.",
};

const GROUP_NOTICE_MESSAGES: Record<string, string> = {
  archived: "הקבוצה הועברה לארכיון.",
  created: "הקבוצה נוספה.",
  restored: "הקבוצה שוחזרה לרשימת העבודה.",
  updated: "הקבוצה נשמרה.",
};

export type SearchParamValue = string | string[] | undefined;

export function firstSearchParam(value: SearchParamValue): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function groupErrorMessage(value: SearchParamValue): string | null {
  const key = firstSearchParam(value);
  return key ? (GROUP_ERROR_MESSAGES[key] ?? "לא ניתן לשמור את הקבוצה.") : null;
}

export function groupNoticeMessage(value: SearchParamValue): string | null {
  const key = firstSearchParam(value);
  return key ? (GROUP_NOTICE_MESSAGES[key] ?? null) : null;
}
