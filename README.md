# שלבים

מעקב חינוכי־התנהגותי — שלד ראשוני. בשלב זה תחום **תכניות שלבים** הוא תחום העבודה הממומש: ניהול צוותי, מוסדות, קבוצות, חניכים, הרשאות, חופשות, פרופילי ניקוד, דיווחים ודוחות התאמה. ממשק חניך לצפייה עצמית הוא חלק מחזון המוצר אך עדיין לא ממומש. תחומים אחרים (תכניות שנתיות, תכניות אסימונים, סיכומי יום כלליים) מחוץ לסקופ הנוכחי.

## סטאק

Next.js (App Router) + TypeScript, PostgreSQL דרך Prisma (עם driver adapter `@prisma/adapter-pg` — Prisma 7 דורש זאת במקום datasource URL ישיר), Auth.js עם Google OAuth (ראו `src/lib/auth.ts`).

## הרצה מקומית

PostgreSQL 17 מותקן מקומית (native, לא Docker — ראו `docker-compose.yml` כאלטרנטיבה אם עוברים ל-Docker בהמשך). המשתמש `steps` (סיסמה תואמת ל-`DATABASE_URL` ב-`.env`) הוא בעל בסיס הנתונים `steps_dev` ויש לו הרשאת `CREATEDB` (נדרש ל-shadow database של `prisma migrate dev`). ל-`postgres` הוגדרה סיסמת פיתוח (`postgres_dev_password`) לצורך משימות ניהול עתידיות — לא לשימוש מעבר לסביבת הפיתוח המקומית.

1. ודאו ששירות `postgresql-x64-17` רץ (`Get-Service postgresql-x64-17`).
2. `npm install`
3. `npm run db:migrate` — יוצר/מעדכן את הסכימה בפועל.
4. `npm run db:seed` — נתוני דוגמה: מוסד אחד, 2 קבוצות, 3 חניכים, 3 משתמשי צוות (`DEV_ADMIN_EMAIL`, `DEV_LEAD_EMAIL`, `DEV_COUNSELOR_EMAIL` ב-`.env`, או admin/lead/counselor@example.local כברירת מחדל), תכנית שלבים עם 3 שלבים ו-3 פרמטרים.
5. הגדירו Google OAuth ב-`.env`:
   - `AUTH_SECRET` — ניתן ליצור עם `npx auth secret`.
   - `AUTH_URL="http://localhost:3000"`.
   - `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` מתוך Google Cloud OAuth Client.
   - ב-Google Cloud יש להוסיף Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`.
6. ודאו שהאימייל של חשבון Google שמתחבר קיים כ-`StaffUser.email` פעיל במערכת. בפיתוח מקומי אפשר להגדיר את `DEV_ADMIN_EMAIL` / `DEV_LEAD_EMAIL` / `DEV_COUNSELOR_EMAIL` לפני seed, או לעדכן את רשומות הצוות הקיימות.
7. `npm run dev`

## מבנה תיקיות (`src/`)

- אין כרגע תיקיית `domain/` נפרדת; לוגיקה טהורה של תחום השלבים נמצאת בעיקר תחת `services/stagePrograms/`.
- `services/` — לוגיקה עסקית: `permissions/` (בדיקת הרשאות וגבול כתיבה ל-overrides), `stagePrograms/` (חישוב ציון, מיעוט נתונים, הגדרות/פרופילי ניקוד, `fitReport.ts` — דוח התאמה קבוצתי/פרטני), `trainees/`, `vacations/`, ו-`audit/` (כתיבה append-only ל-Audit Log).
- `repositories/` — גישה לנתונים דרך Prisma (institution/group/trainee/staffUser/stageProgram/scoreEntry) — שכבה דקה שהשירותים והעמודים קוראים לה, במקום לגשת ל-Prisma ישירות.
- `lib/` — Prisma client singleton, קונפיגורציית Auth.js.

## אפיון ומפת ביצוע

האפיונים העדכניים נמצאים ב-`docs/specs/`.

נקודת הכניסה הראשית היא:

- `docs/specs/app-model/README.md` — מודל אפיון מאוחד לפי מסכים, דומיין, הרשאות, דיווח, סטטוס מימוש ופערי אפיון. זה המקום הראשון לקריאה כאשר רוצים להבין מה אמור להיות באפליקציה ומה כבר קיים בפועל.

מסמכי המקור וההקשר ההיסטורי:

- `docs/specs/base-data-and-daily-reporting.md` — ניהול קבוצות, חניכים, מעבר קבוצות ודיווח.
- `docs/specs/stage-program-parameter-settings.md` — פרמטרים, משקלים, ירושה, פרופיל ניקוד מקומי וחופשות.
- `docs/specs/implementation-task-map.md` — מפת משימות `ready` לסוכני ביצוע, תלויות, ומה לא לממש עדיין.

כאשר יש פער בין רשימת "החלטות פתוחות" ההיסטורית במסמך זה לבין `docs/specs/implementation-task-map.md`, מפת המשימות עדכנית יותר עבור הסבב הנוכחי.

## מסכים קיימים

- `/` — מוסד + רשימת קבוצות.
- `/login` — התחברות עם Google. Google מאמת את הזהות, והאפליקציה מאשרת כניסה רק אם האימייל המאומת קיים כמשתמש צוות פעיל במערכת.
- `/permissions` — ממשק מנהל להרשאות תפקיד וחריגות משתמש לפי טווח הרשאה.
- `/stage-settings` — הגדרות פרופיל ניקוד מוסדיות: טיוטה, פרסום, פרמטרים פעילים/לא פעילים, סולם, משקל ותחולת שלב. מוצג רק למי שיש `MANAGE_STAGE_SETTINGS`.
- `/stage-settings/groups/[groupId]` — הגדרות פרופיל ניקוד מקומיות לקבוצה, עם סימון "בירושה"/"מותאם" ואיפוס שדות נתמכים לירושה. מוצג למי שיש `MANAGE_GROUP_SETTINGS`.
- `/stage-settings/trainees/[traineeId]` — הגדרות פרופיל ניקוד מקומיות לחניך. מוצג למי שיש `MANAGE_TRAINEE_SETTINGS`. ירושת חניך מפרופיל קבוצה וירושת `active`/תחולת שלב חסומות כרגע בחוזה המודל/שירות (ראו "פערים ידועים").
- `/groups/[groupId]` — דוח התאמה קבוצתי (ברירת המחדל לפי האפיון): שלב נוכחי, ציון אחרון, אזהרת מיעוט נתונים. באותה מעטפת קיימים גם עריכת קבוצה, ארכיון קבוצה, שיוך אנשי צוות, הוספת חניך, חופשות קבוצה, כניסה להגדרות קבוצה וכניסה לדיווח לפי הרשאות. גישה לדוח דורשת סשן מחובר + הרשאת `VIEW_REPORTS` (נבדק דרך `resolvePermission`, כולל scope לקבוצה — הבעלות על הקבוצה/חניך מאומתת מול ה-DB בתוך `resolvePermission` עצמו, לא רק על ידי הקורא).
- `/trainees/[traineeId]` — דוח פרטני עם פירוט לפי פרמטר (ליום האחרון) — נגיש רק בלחיצה על חניך, כפי שהאפיון דורש. באותה מעטפת קיימות עריכת פרטי חניך, שינוי שלב ידני, העברת קבוצה, חופשות חניך, כניסה להגדרות חניך וכניסה לדיווח לפי הרשאות. השוואה לתקופות קודמות והמלצת שלב **אינן ממומשות** (ראו למטה).
- `/trainees/[traineeId]/report` — MVP דיווח לחניך יחיד: בחירת מועד מדידה בלחיצה, סימון טיוטה/פורסם/חופשה, טופס פרמטרים לפי הפרופיל הפעיל, הערה, שמירת טיוטה ופרסום. יצירת דיווח דורשת `ENTER_REPORTS`; עריכת דיווח מפורסם דורשת `EDIT_REPORTS`; ההרשאה נבדקת מול קבוצת מועד המדידה שנפתרת מהיסטוריית החניך.

שכבות ההרשאה, החישוב וה-DB מכוסות בסוויטת האינטגרציה מול Postgres אמיתי (ראו "בדיקות" למטה) — לא רק unit tests טהורים. עמודי Auth והמסכים הממומשים מכוסים בשילוב של בדיקות page-level ממוקדות, בדיקות אינטגרציה, ו-E2E smoke מול שרת Next מקומי ללא Google אמיתי; כיסוי E2E מלא לכל זרימות UI חדשות עדיין מתרחב בהדרגה.

## בדיקות

- `npm test` — יוניט/page-level טסטים מהירים (`src/**/*.test.ts` ו-`src/**/*.test.tsx`), ללא תלות ב-DB. לא נוגע ב-Postgres בכלל.
- `npm run test:integration` — סוויטת אינטגרציה מול **Postgres אמיתי**, לא mocks, ב-DB נפרד ומבודד לגמרי מ-`steps_dev` (כדי לא להסתמך על ה-seed ולא לסכן אותו):
  1. חד-פעמי: `psql -U postgres -h 127.0.0.1 -c "CREATE DATABASE steps_test OWNER steps;"`
  2. `cp .env.test.example .env.test` (הערכים כבר תואמים למשתמש `steps` הקיים — אין צורך ביצירת role חדש).
  3. `npm run test:integration` — מריץ `prisma migrate deploy` מול `steps_test` (idempotent, לא נוגע ב-`DATABASE_URL` הרגיל) ואז את הטסטים. הסקריפט מסרב לרוץ אם `TEST_DATABASE_URL` זהה ל-`DATABASE_URL`.
  - כל קובץ טסט מרוקן (`TRUNCATE ... CASCADE`) את כל הטבלאות לפני שהוא מתחיל ובונה את הנתונים שלו בעצמו דרך `tests/integration/db.ts` — אין תלות בנתוני seed.
  - `tests/integration/vitestSetup.ts` דורס את `DATABASE_URL` בזמן ריצה כדי ש-`@/lib/prisma` (וכל repository/service שמייבא אותו) ידבר עם `steps_test` באופן שקוף — כלומר הטסטים מפעילים את הקוד האמיתי (`resolvePermission`, `buildTraineeFitReport` וכו׳), לא re-implementation שלו. יש גם guard מפורש: אם `TEST_DATABASE_URL` שווה בטעות ל-`DATABASE_URL` הרגיל, הריצה נכשלת מיד במקום למחוק בטעות את `steps_dev`.
  - מכסה: חסימת הרשאות בין מוסדות, override גובר על ברירת מחדל (allow/deny), גבול כתיבה בטוח ל-`UserPermissionOverride`, כתיבת Audit Log, backfill ל-NOT_SCORED לפרמטר בלי רשומה, החרגת NOT_APPLICABLE מהבסיס, ומיעוט נתונים מול נתונים אמיתיים מה-DB.
- `npm run test:e2e` — בדיקות Playwright למסכי ה-Next/Auth הממומשים מול `steps_test`. הסוויטה מריצה את `scripts/test-db-migrate.mjs`, בונה את האפליקציה, מרימה `next start` על פורט 3100 עם `E2E_TEST_AUTH=1`, מזריעה נתוני בדיקה מבודדים דרך endpoint כבוי-כברירת-מחדל, ויוצרת cookie בדיקה של Auth.js שמוגבל ל-loopback. היא אינה משתמשת ב-Google אמיתי ואינה נוגעת ב-`steps_dev`.

## החלטות פתוחות שלא ננעלו בכוונה

- `src/services/stagePrograms/recommendation.ts` זורק שגיאה במפורש — המוצר קבע שהאפליקציה מציגה נתונים וטקסטים שהצוות הגדיר, ולא קובעת לבד שינוי שלב. עדיין חסרות סמנטיקות גבול, חפיפה/פערים, ושוויון סף עבור שורות חוקי אחוז הצלחה.
- דוח ההתאמה (`fitReport.ts`) מציג ציון לכל מועד מדידה בנפרד, ולא ציון תקופתי מאוחד. נקבע שתקופת חישוב יכולה להיות במספר ימים ו/או שבועות ושמועד חסר לא נכנס לחישוב, אבל נוסחת aggregation, rolling מול תקופה קבועה, ו-snapshots עדיין פתוחים.
- המוצר דורש התאמות אישיות לחניך בפרמטרים, משקלים וספים/חוקי תצוגה. עדיין פתוח האם לממש זאת רק דרך היררכיית `ScoringProfile` או להשאיר גם את מודלי legacy (`TraineeParameterOverride` / `TraineeThresholdOverride`, מצב `CUSTOM`) פעילים.
- המוצר דורש תמיכה בכמה תכניות שלבים כמסגרות גג לקבוצות, ללא גבול מוצרי לכמות התכניות. הקוד עדיין מניח "תכנית ראשית" אחת (`getPrimaryStageProgramVersion`), ומודל שיוך/היסטוריה/דוחות קיימים עדיין לא אופיין.
- השוואה לתקופות קודמות בדוח הפרטני לא מומשה, ותלויה בהגדרת התקופה וה-aggregation.
- ממשק חניך לצפייה עצמית הוא חלק מחזון המוצר, אך login, קישור לחשבון חניך, שדות חשופים, הערות צוות והזנה עצמית עדיין חסומים אפיון.

אין להניח החלטה בנקודות האלה לפני שהן נסגרות במוצר.

## פערים ידועים (לא שאלות מוצר, אלא חוב טכני מתועד)

- `UserPermissionOverride` לא אוכף ב-DB "בדיוק groupId או traineeId אחד" (התיאור בקוד הוא כוונה, לא אילוץ). נתיב השירות `upsertUserPermissionOverride()` כן מאמת scope ובעלות מוסד ומנקה כפילויות same-scope, אך CHECK/unique constraints ב-DB עדיין לא קיימים ודורשים תיאום migration נפרד.
- ולידציית משקלי הפרמטרים (סכום 100%) נאכפת בנתיבי פרסום הגדרות/פרופילי ניקוד, כולל חישוב משקל אפקטיבי כאשר פרמטרים כלל-שלביים ופרמטרים ייעודיים לשלב חלים יחד.
- במסכי הגדרות קבוצה/חניך, ירושת `active` ותחולת שלב אינה ניתנת לייצוג מלא כרגע כי `ScoringProfileParameter.active` אינו nullable ו-`stageId = null` כבר משמש ל"כל השלבים". נדרש שינוי חוזה מודל/שירות לפני UI שמבטיח ירושה מלאה לשדות האלה.
- הגדרות חניך אינן יכולות לרשת בפועל מפרופיל קבוצה כהורה ביניים בלי החלטת source/merge בשירות, כי runtime בוחר פרופיל אפקטיבי אחד (חניך אחרת קבוצה אחרת מוסד) ולא ממזג חניך מעל קבוצה מעל מוסד.
