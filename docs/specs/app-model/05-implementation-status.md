# סטטוס מימוש, משימות וסנכרון סוכנים

סטטוס: תמונת מצב לפי הקוד והלוח נכון ל-2026-07-07 08:48 +03:00.

המסמך הזה לא מחליף את `AGENT_CONVERSATION.md`. הוא מסביר את מצב האפיון מול
המימוש. לפני עבודה, תמיד לקרוא גם את סוף הלוח כדי לראות claims חדשים.

עדכון אימות 2026-07-07: בעותק non-Dropbox
`C:\Users\Still\AppData\Local\steps-verify-20260706-143621`, הלוח מתעד
מעבר של `tsc --noEmit`, Vitest unit/page ‏60/60, integration מול Postgres
אמיתי ‏89/89, ESLint בהרצת Node ישירה, ו-Next build `--webpack`. עדיין יש
caveats סביב `npm run lint` באותה מעטפת בגלל `node` חסר ב-PATH, ו-plain
Turbopack build בעותק האימות בגלל junction של `node_modules`; אלו caveats
סביבתיים, לא כשל קוד חדש.

## ממומש או ממומש בעיקר

| תחום | סטטוס | הערות |
| --- | --- | --- |
| Google OAuth לצוות | ממומש | תלוי ב-env ובשורות StaffUser פעילות. |
| בית ורשימת קבוצות | ממומש | כולל ארכיון, יצירת קבוצה וחופשות מוסד לפי הרשאות. |
| דף קבוצה | ממומש חלקית | דוח, עריכת קבוצה, יצירת חניך, חופשות, קישור לדיווח, settings; חסר bulk reporting grid. |
| דף חניך | ממומש חלקית | דוח, עריכה, מעבר קבוצה, חופשות, כניסה לדיווח, settings. |
| ממשק הרשאות | ממומש, אומת | Task G סגר את widening של scope חסר ב-server action; `src/app/permissions/actions.test.ts` נוסף ועבר בהרצת DB-free Vitest ממוקדת לפי הלוח, ונכלל גם במסלול הרחב non-Dropbox ב-2026-07-07. |
| ניהול קבוצות backend+UI | ממומש | כולל active/archive ו-staff assignment. |
| ניהול חניכים backend+UI | ממומש, אומת | Task C תיקן stage validation מול גרסה פעילה ודחיית future transfer; `traineeService.integration` עבר בהרצות non-Dropbox, כולל המסלול הרחב ב-2026-07-07. |
| חופשות backend+UI | ממומש, אומת | כולל scopes. Task D סגר את ברירות מחדל תאריכי UI לפי local date; `vacationService.integration` עבר בהרצות non-Dropbox, כולל המסלול הרחב ב-2026-07-07. |
| Stage settings backend | ממומש חלקית, אומת | services קיימים; Task C תיקן active-version/effective-weight validation, ו-`stageSettingsService.integration` עבר בהרצות non-Dropbox, כולל המסלול הרחב ב-2026-07-07. |
| Stage settings UI מוסדי | ממומש חלקית, אומת | `/stage-settings` קיים לטיוטה/פרסום מוסדי ופרמטרי עבר; route/type blockers נסגרו, ו-`appRoutes` נכלל ב-60/60 unit/page ב-2026-07-07. |
| Stage settings UI קבוצה/חניך | ממומש חלקית, אומת/חסום מודל | `/stage-settings/groups/[groupId]` ו-`/stage-settings/trainees/[traineeId]` קיימים עם ירושה/מותאם/reset-to-inherit, ו-`appRoutes` נכלל ב-60/60 unit/page ב-2026-07-07. Batch 21 סימן שירושת חניך מפרופיל קבוצה חסומה בחוזה source/merge הנוכחי, ו-Batch 22 סימן שירושת `active`/תחולת שלב חסומה כי אין מצב persisted נפרד ל-inherit. |
| Reporting backend | ממומש חלקית, אומת | Task B תיקן pinning/draft data. `reportService.integration` עבר 7/7 נקודתית וגם כחלק מ-integration ‏89/89 בעותק non-Dropbox ב-2026-07-07; runner רחב בתוך Dropbox עדיין לא יציב. |
| Reporting UI | ממומש חלקית, אומת | Task H הוסיף route חניך יחיד, קישורי כניסה, בחירת יום, טיוטה/פרסום וסימון חופשה. Batch 19 closeout תיקן הרשאה לפי קבוצת מועד המדידה וספירת חניכים למשתמשי דיווח בלבד; `appRoutes` נכלל ב-60/60 unit/page, ו-`tsc`/Next webpack build עברו בעותק non-Dropbox ב-2026-07-07. bulk/aggregation מחוץ ל-MVP. |
| Fit reports | ממומש חלקית, אומת | עובד לימים נפרדים; Task B תיקן profile-backed gaps, ו-`fitReport.integration` עבר בהרצות non-Dropbox, כולל המסלול הרחב ב-2026-07-07. aggregation עדיין חסום אפיון. |
| Real-Postgres integration harness | ממומש, אומת | רץ מול `steps_test`; ב-2026-07-07 integration עבר 89/89 בעותק non-Dropbox. יש עדיין בעיות I/O בסביבת Dropbox. |
| E2E auth/page smoke | ממומש | דרך endpoints כבויים כברירת מחדל. |

## סטטוס slices שהיו מוכנים לביצוע

| Task | תחום | הערות |
| --- | --- | --- |
| Task B | Reporting/fit-report correctness | בוצע ונבדק נקודתית; אין לקחת מחדש כ-slice כללי. |
| Task C | Stage settings/active version/trainee semantics | בוצע ברמת קוד ורגרסיות; broad Dropbox runner עדיין לא יציב. המשך רק כתיקון ממוקד או אחרי החלטת model/service. |
| Task D | Tooling/date/docs sync | בוצע. |
| Task E | Institutional stage-settings UI | MVP קיים; targeted route/type blockers נסגרו. |
| Task F | Local group/trainee settings UI | MVP קיים; ירושת חניך מקבוצה וירושת `active`/תחולת שלב חסומות model/service ולא לתיקון UI בלבד. |
| Task G | Permissions UI verification | source/regression coverage בוצע; אם נוגעים בהרשאות, להריץ/להוסיף בדיקה ממוקדת. |
| Task H | Reporting UI MVP | בוצע ונבדק: `tsc`, unit/page Vitest ‏60/60, `reportService.integration` נקודתי 7/7, integration רחב ‏89/89, ו-Next build `--webpack` בעותק non-Dropbox. bulk/aggregation מחוץ ל-MVP. |
| Hebrew UI localization | UI עברית | בוצע; ב-2026-07-06 17:44 נעשתה בדיקת UI עברי חוזרת אחרי reporting/stage-settings ולא נמצאה בעיה גלויה. |
| LCU tasks | legacy cleanup | לא פנוי כמחיקה כללית: schema/model removals דורשים החלטת migration/product, ו-generated/cache cleanup לא להריץ בזמן runners/שרתים חיים. |

הטבלה הזו אינה רשימת משימות פנויות. משימה חדשה צריכה להגיע מרשומת claim עדכנית
ב-`AGENT_CONVERSATION.md`, מתיקון ממוקד שנמצא בביקורת קוד, או מתשובת Product
Spec Owner שסוגרת אחד מפערי האפיון.

## פעיל בלוח בזמן הסקירה

עדכון 2026-07-06 17:42: הרשימה הבאה היא snapshot היסטורי. הלוח הפעיל
ב-`AGENT_CONVERSATION.md` עודכן ב-17:37, ולאחריו נסגרו גם אימות IMP-11
וה-claim הכפול של README. אין להשתמש בבולטים הישנים כ-claims חיים.

- Task A — Auth and audit atomicity, claimed by Claude.
- LCU-01 — generated/cache and public assets, claimed by Codex Legacy Janitor.
- Hebrew UI localization, claimed by Codex UI Builder.
- App specification consolidation, claimed by Codex Spec Coordinator.

סוכן חדש חייב לבדוק את `AGENT_CONVERSATION.md` כי הרשימה הזו יכולה להתיישן במהירות.

## חסום אימות/סביבה

- בדיקות רחבות (`npm test`, integration, lint, tsc, build) נתקעו בעבר בגלל I/O/Dropbox וריבוי agents.
- יש dev server חי מעותק מחוץ ל-Dropbox, אבל הוא לא עושה hot reload לשינויים בתיקיית Dropbox.
- ב-2026-07-06 17:39 `tsc --noEmit` נתקע ב-Workspace של Dropbox אחרי 124 שניות, אבל עבר תוך 4.8 שניות בעותק non-Dropbox; תהליך ה-`tsc` שנתקע נעצר ידנית וה-dev server נשאר פעיל.
- ב-2026-07-07 08:48, מסלול אימות רחב ובטוח בעותק non-Dropbox עבר דרך Node ישיר: `tsc`, unit/page Vitest ‏60/60, migration check ללא pending migrations, integration ‏89/89, ESLint, ו-Next webpack build.
- caveat סביבתי שנותר: `npm run lint` באותה מעטפת לא מצא `node` ב-PATH אף ש-ESLint הישיר עבר, ו-plain Turbopack build בעותק האימות נחסם בגלל junction של `node_modules` מחוץ לשורש הקבצים; webpack build עבר.
- רצוי להמשיך להריץ targeted tests או lane non-Dropbox מתועד במקום להריץ broad verification כפול בתוך Dropbox בזמן שיש שרתים/agents פעילים.

## חסום אפיון

- הצגת סטטוס/משוב לפי thresholds: הכיוון הוכרע כנתונים וטקסטים מוגדרים על ידי
  הצוות, לא החלטה אוטומטית. שורות חוקים חופשיות הוגדרו מוצרית, כולל כיסוי
  0-100 ללא חפיפות/פערים ושוויון מפורש; חסר עיצוב UI/ולידציה מפורט.
- period aggregation/snapshots: תקופה נמדדת במספר ימים ו/או שבועות, ומועד
  חסר לא נכנס לחישוב. אחוז הצלחה הוא אחוז אחד לכל התקופה ומתחת לרף מינימום
  נתונים שמנהל קבע מוצג שאין מספיק נתונים. תקופה מתחילה ביום מסוים, ורף
  מינימום יכול להיות מספר דיווחים ו/או אחוז כיסוי; עדיין חסרים UI מדויק
  ליום התחלה, שילוב רפים אם הוגדרו יחד ו-snapshots.
- stage-change workflow: האפליקציה לא קובעת שלב לבד, אך חסר workflow לעדכון
  השלב הנוכחי אחרי החלטת צוות. אין דיפולט הרשאות; מנהל מגדיר מי רשאי, ועדכון
  רטרואקטיבי מותר. תיארוך עתידי והערה עדיין פתוחים.
- multi-program selection: צריך לאפשר כמה תכניות שלבים, אך חסר מודל שיוך,
  היסטוריה והתנהגות דוחות. תכנית היא מסגרת גג עם דיפולט לקבוצה אחת או יותר,
  וחניך יכול לקבל תכנית מותאמת.
- previous-period comparison.
- trainee-facing UI: חלק מחזון המוצר, אך חסרים login, scope, נתונים מוצגים
  בפירוט, היררכיית מסך ויכולת/אי-יכולת הזנה עצמית. חניך לא רואה הערות צוות
  מקוריות, אלא רק טקסט ייעודי לחניך.
- annual/token/day-summary domains אינם בסקופ הנוכחי; ירדו מהסבב עד החלטת
  הרחבה עתידית.
- התאמות חניך נדרשות מוצרית; עדיין חסום אם להשתמש רק ב-`ScoringProfile` או
  להשאיר legacy custom override models פעילים.

## כללי סנכרון

- אם סוכן משנה קוד שמשנה התנהגות מסך, לעדכן גם `01-pages-and-surfaces.md`.
- אם סוכן משנה schema או service contract, לעדכן `02-domain-model.md` ו/או `04-stage-programs-reporting-and-scoring.md`.
- אם סוכן סוגר blocker, לעדכן `05-implementation-status.md` או לפתוח רשומת docs sync בלוח.
- אם Product Spec Owner עונה על שאלה, לעדכן `06-open-spec-gaps.md` ולהוציא task ready חדש.
