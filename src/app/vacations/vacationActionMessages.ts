const VACATION_ERROR_MESSAGES: Record<string, string> = {
  "actor-out-of-scope": "לא ניתן לשמור חופשה מחוץ למוסד שלך.",
  "date-range-invalid": "טווח התאריכים אינו תקין.",
  forbidden: "אין לך הרשאה לנהל חופשות.",
  "group-out-of-scope": "הקבוצה שנבחרה אינה שייכת למוסד שלך.",
  "invalid-date": "אחד מתאריכי החופשה אינו תקין.",
  "malformed-scope": "חופשה יכולה להיות משויכת למוסד, לקבוצה או לחניך בלבד.",
  "title-invalid": "שם חופשה הוא שדה חובה.",
  "trainee-out-of-scope": "החניך שנבחר אינו שייך למוסד שלך.",
  "vacation-not-found": "החופשה לא נמצאה.",
};

const VACATION_NOTICE_MESSAGES: Record<string, string> = {
  created: "החופשה נוספה.",
  deleted: "החופשה נמחקה.",
  updated: "החופשה נשמרה.",
};

export type SearchParamValue = string | string[] | undefined;

export function vacationErrorMessage(value: SearchParamValue): string | null {
  const key = Array.isArray(value) ? value[0] : value;
  return key ? (VACATION_ERROR_MESSAGES[key] ?? "לא ניתן לשמור את החופשה.") : null;
}

export function vacationNoticeMessage(value: SearchParamValue): string | null {
  const key = Array.isArray(value) ? value[0] : value;
  return key ? (VACATION_NOTICE_MESSAGES[key] ?? null) : null;
}
