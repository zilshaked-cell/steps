# הרשאות, אודיט ואבטחת מידע

סטטוס: מאוחד לפי הקוד, האפיון והביקורות.

## עקרונות

- כל פעולת כתיבה חדשה משתמשת בהרשאה מפורשת, לא ב-`EDIT` כללי.
- ברירת מחדל: רק `ADMIN` מקבל הרשאות כתיבה/ניהול.
- `UserPermissionOverride` גובר על `RolePermission`.
- `DENY` גובר על `ALLOW` בהתנגשות באותה ספציפיות.
- scope צר: חניך > קבוצה > מוסד.
- כל service חייב לאמת מוסד ו-scope מול DB, לא לסמוך על קלט מה-UI.
- אפליקציית הניהול מיועדת למנהל, רכז, מדריך, ש"ש וכל משתמש צוות אחר; כל
  משתמש רואה רק מוסדות/קבוצות/חניכים שרלוונטיים לתפקיד ול-scope שלו.
- אפליקציית החניך מיועדת לחשיפה עצמית בלבד: חניך רואה את הנתונים של עצמו,
  ולא נתוני חניכים אחרים, קבוצות אחרות או נתוני צוות שאינם מיועדים לו.

## פעולות הרשאה

פעולות פעילות:

- `VIEW_REPORTS`
- `MANAGE_PERMISSIONS`
- `MANAGE_GROUPS`
- `MANAGE_TRAINEES`
- `TRANSFER_TRAINEES`
- `ENTER_REPORTS`
- `EDIT_REPORTS`
- `MANAGE_STAGE_SETTINGS`
- `MANAGE_GROUP_SETTINGS`
- `MANAGE_TRAINEE_SETTINGS`
- `MANAGE_VACATIONS`

פעולות legacy/future:

- `VIEW`
- `EDIT`
- `EDIT_SETTINGS`
- `CHANGE_STAGE`

סטטוס legacy/future:

- אין להסיר בלי החלטת migration ובדיקת נתונים.
- LCU-03 סיווג אותן כ-hide-until-implemented/remove-by-migration-later, לא safe-delete.
- UI הרשאות מציג לניהול רק פעולות פעילות; legacy/future נשארות ב-DB וב-default seed עד החלטת migration.
- החלטת מוצר לגבי שינוי שלב: אין דיפולט תפקידי קשיח למי רשאי לעדכן שלב;
  מנהל מגדיר את ההרשאות דרך מנגנון ההרשאות. `CHANGE_STAGE` עדיין לא מיושמת
  כ-workflow פעיל עד אפיון שינוי שלב מלא.

## אלגוריתם resolvePermission

קובץ: `src/services/permissions/resolvePermission.ts`

זרימה:

1. אם נמסר `traineeId`, נטען החניך ומוודאים שהוא באותו מוסד.
2. אם נמסר `groupId`, נטענת הקבוצה ומוודאים שהיא באותו מוסד.
3. אם נמסרו גם חניך וגם קבוצה, מוודאים שהחניך שייך לקבוצה.
4. נטענות חריגות המשתמש לאותה פעולה.
5. חריגה malformed שנוגעת ל-scope גורמת denial.
6. בוחרים חריגות רלוונטיות לפי specificity.
7. אם יש tie, כל `DENY` מנצח.
8. אם אין חריגה, משתמשים ב-role default.
9. אם אין role default, התוצאה false.

## מסך הרשאות

Route: `/permissions`

דורש:

- `MANAGE_PERMISSIONS`.

יכולות:

- שינוי הרשאות לפי role.
- יצירת/עדכון חריגת משתמש.
- scope מוסד/קבוצה/חניך.
- הצגת טבלת מצב role.
- הצגת חריגות פעילות.

פערים:

- Task G ביצע closeout מקור ב-2026-07-06: `setUserPermissionOverrideAction()` דוחה direct POST של `scopeType=group` בלי `groupId` ושל `scopeType=trainee` בלי `traineeId`, ומעביר לשירות רק את ה-scope הצר שנבחר.
- נוספה רגרסיה ב-`src/app/permissions/actions.test.ts`, ולפי הלוח היא עברה בהרצת DB-free Vitest ממוקדת. אימות רחב נוסף ממשיך להיות מתועד במסלול ה-non-Dropbox בגלל בעיות runner בסביבת Dropbox.

## Audit log

מודל: `AuditLogEntry`

פעולות שנרשמות:

- שינוי role permission.
- שינוי user override.
- שמירת/פרסום פרופילי ניקוד.
- יצירת/עדכון/מחיקת חופשות.
- שמירת/פרסום/עריכת דיווח.

עקרון:

- פעולה רגישה ושורת audit צריכות להיות באותה transaction כאשר אפשר.

סטטוס:

- `setManagedRolePermission` אטומי.
- Task A סגר source-level גם את managed user override + audit וגם את vacation
  mutation + audit בתוך transaction. רגרסיות rollback קיימות; אימות רחב
  נוסף מתבצע/מתועד במסלול ה-non-Dropbox כדי לעקוף את בעיות ה-runner ב-Dropbox.

## אבטחת התחברות

Route: `/login`

חוקים:

- Google OAuth בלבד.
- Google email חייב להיות verified.
- `StaffUser.email` חייב להתאים ולשורת הצוות להיות active.
- אין להדפיס secrets בלוגים/מסמכים.

פערים:

- Task A סגר source-level את סיכון stale JWT: כאשר לא נמצאת עוד שורת צוות
  active, claims של האפליקציה מתנקים ו-`session.user` מוסר אם חסרים claims
  נדרשים. אימות runner רחב מתועד בנפרד.
- Trainee login הוא חלק מחזון המוצר אך עדיין לא מאופיין: נדרש להחליט אם חניך
  משתמש ב-Google/OAuth, קוד חד-פעמי, הזמנה, או מודל משתמש נפרד, ואיך החשבון
  נקשר ל-`Trainee`.
- Parent login אינו בסקופ הנוכחי עד החלטה מפורשת.

## פרטיות ומוסדות

דרישות:

- אין רשימת מוסדות גלובלית למשתמשים.
- בית מציג רק את מוסד המשתמש המחובר.
- דפי קבוצה וחניך עושים `notFound()` אם הישות ממוסד אחר.
- services צריכים לבצע אותה בדיקת מוסד גם אם UI כבר הסתיר.
- מדריך של קבוצה X לא אמור לראות נתונים של חניך מקבוצה Y.
- רכז של קבוצות X ו-Y לא אמור לראות קבוצות Z ו-A אם הן מחוץ לסמכותו.
- חניך לא רואה שום מידע מזהה או מדדי התקדמות של חניכים אחרים.

בדיקות קיימות:

- integration tests מכסים cross-institution permission denial.
- E2E מכסה foreign group 404 במסלול הבדיקה.

פערים:

- בכל מסך חדש צריך להוסיף בדיקת denial/foreign scope בהתאם לסיכון.
