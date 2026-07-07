const PERMISSION_ERROR_MESSAGES: Record<string, string> = {
  "actor-out-of-scope": "לא ניתן לנהל הרשאות מחוץ למוסד שלך.",
  forbidden: "אין לך הרשאה לנהל הרשאות.",
  "group-out-of-scope": "הקבוצה שנבחרה אינה שייכת למוסד שלך.",
  "institution-not-found": "המוסד לא נמצא.",
  "malformed-scope": "יש לבחור טווח הרשאה תקין: מוסד, קבוצה עם קבוצה נבחרת, או חניך עם חניך נבחר.",
  "staff-out-of-scope": "איש הצוות שנבחר אינו שייך למוסד שלך.",
  "trainee-out-of-scope": "החניך שנבחר אינו שייך למוסד שלך.",
};

const PERMISSION_NOTICE_MESSAGES: Record<string, string> = {
  "override-updated": "הרשאת המשתמש נשמרה.",
  "role-updated": "הרשאת התפקיד נשמרה.",
};

export type SearchParamValue = string | string[] | undefined;

export function permissionErrorMessage(value: SearchParamValue): string | null {
  const key = Array.isArray(value) ? value[0] : value;
  return key ? (PERMISSION_ERROR_MESSAGES[key] ?? "לא ניתן לשמור את ההרשאה.") : null;
}

export function permissionNoticeMessage(value: SearchParamValue): string | null {
  const key = Array.isArray(value) ? value[0] : value;
  return key ? (PERMISSION_NOTICE_MESSAGES[key] ?? null) : null;
}
