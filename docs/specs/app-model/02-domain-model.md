# מודל דומיין וקשרים

סטטוס: מאוחד לפי `prisma/schema.prisma`, האפיון והלוח.

## גבולות דומיין

הדומיין הפעיל הוא "תכניות שלבים", כולל אפליקציית ניהול לצוות ואפליקציית
חניך לצפייה עצמית. כל מה שמחוץ לתכנית שלבים נחשב עתידי עד אפיון נפרד:

- תכניות שנתיות.
- תכניות אסימונים.
- סיכומי יום כלליים.
- ממשק הורה.

## מוסד

מודל: `Institution`

תפקיד:

- יחידת הבעלות הראשית לכל נתוני המערכת.
- כל משתמש, קבוצה, חניך, הרשאה, תכנית שלבים, חופשה, דיווח ואודיט שייכים למוסד.

חוקי פרטיות:

- משתמש מחובר רואה רק את המוסד שלו.
- כל service שמקבל `institutionId` חייב לוודא שה-actor שייך אליו.

## אנשי צוות ותפקידים

מודלים: `StaffUser`, `StaffRole`

תפקידים קיימים:

- `ADMIN`
- `LEAD_COORDINATOR`
- `COUNSELOR`
- `YOUTH_WORKER`
- `TRAINEE`

התחברות:

- Google OAuth מאמת זהות.
- האפליקציה מאשרת רק `StaffUser.active = true` עם אימייל תואם.
- `passwordHash` הוא legacy ומסומן לבדיקת cleanup.

קשרים:

- איש צוות יכול להיות משויך לקבוצות דרך `GroupStaffAssignment`.
- איש צוות יכול לקבל `UserPermissionOverride`.
- פעולות רגישות נרשמות ב-`AuditLogEntry`.

סטטוס:

- `TRAINEE` כ-login role קיים בסכמה, וממשק חניך הוא חלק מחזון המוצר, אך
  login/identity binding לחניך עדיין לא מאופיין.
- LCU-02 אימת שאין נתיב runtime/test פעיל ל-Credentials/bcrypt; `passwordHash` נשאר artifact סכמתי בלבד.
- הסרת `passwordHash` חסומה עד אישור migration מסודר והחלטת תאימות נתונים מקומית.

## קבוצות

מודל: `Group`

שדות מרכזיים:

- `institutionId`
- `name`
- `description`
- `active`
- `createdAt`, `updatedAt`

קשרים:

- חניכים נוכחיים דרך `Trainee.groupId`.
- צוות משויך דרך `GroupStaffAssignment`.
- היסטוריית מעבר דרך `TraineeGroupMembershipHistory`.
- חופשות קבוצה דרך `VacationPeriod.groupId`.
- פרופילי ניקוד מקומיים דרך `ScoringProfile.groupId`.
- דיווחים דרך `MeasurementReport.groupId`.

חוקים:

- קבוצה לא פעילה היא ארכיון.
- קבוצות ארכיון מוסתרות מרשימת העבודה השוטפת.
- לא מוסיפים חניכים חדשים ולא פותחים דיווחים חדשים לקבוצה לא פעילה.
- דוחות היסטוריים נשארים זמינים בהרשאה מתאימה.

## חניכים

מודל: `Trainee`

שדות מרכזיים:

- `institutionId`
- `groupId`
- `firstName`
- `lastName`
- `active`
- `measurementMode`
- `currentStageId`

חוקים:

- חניך חדש נוצר עם `measurementMode = STANDARD`.
- חניך חדש חייב להשתייך לקבוצה.
- שלב נוכחי אופציונלי.
- העברה בין קבוצות נשמרת בהיסטוריה עם `effectiveFrom`.

סטטוס correctness:

- Task C עדכן את `traineeService` כך ש-`currentStageId` חייב להיות מתוך גרסת תכנית השלבים הפעילה של המוסד, ולא רק מתוך אותו מוסד.
- Task C דוחה מעבר קבוצה עתידי בקוד השירות במקום לשנות את `Trainee.groupId` לפני תאריך התחולה.
- נוספו רגרסיות אינטגרציה ממוקדות לתיקונים האלה. הרצות ממוקדות בעותק non-Dropbox עברו לפי הלוח, אך broad runner בסביבת Dropbox עדיין לא יציב.

## תכניות שלבים וגרסאות

מודלים:

- `StageProgram`
- `StageProgramVersion`
- `Stage`
- `StageProvision`

חוקים:

- גרסאות אינן נמחקות.
- `DRAFT`, `PUBLISHED`, `REPLACED` מנהלים lifecycle.
- דוחות שפורסמו צריכים להישאר מוצמדים לגרסה שהייתה בתוקף בזמן הפרסום.
- "רק קדימה" יוצר גרסה חדשה עם `effectiveFrom`.
- "החלפת הקיים האחרון" יוצרת גרסה מחליפה ומסמנת את הקודמת כ-replaced.

סטטוס:

- החלטת מוצר: צריך לאפשר כמה תכניות שלבים. תכנית היא מסגרת גג עם הגדרות
  דיפולט לקבוצה אחת או יותר. מוסד יכול לחלק קבוצות לפי גיל, מגדר, יכולות
  רגשיות/קוגניטיביות או כל חלוקה אחרת, ואין גבול מוצרי לכמות התכניות.
- החלטת מוצר: חניך יכול לקבל תכנית שלבים מותאמת ששונה מתכנית הקבוצה שלו.
- החלטת מוצר: כאשר משנים תכנית לקבוצה או לחניך, מבצע השינוי בוחר את אופן
  התחולה. כל אפשרות תחולה חייבת לשמור audit והיסטוריית דוחות.
- חסום אפיון: מודל שיוך לקבוצות/חניכים, היסטוריה והתנהגות דוחות לאחר שינוי
  שיוך, ורשימת אפשרויות התחולה המדויקת. כרגע הקוד מניח תכנית ראשית אחת למוסד.
- Task C עדכן את lookup הגרסה הפעילה כך שיתחשב ב-`PUBLISHED`, `effectiveFrom`, `effectiveTo`, וגרסאות מוחלפות.
- רגרסיות ממוקדות ל-lookup הפעיל נוספו ונבדקו בנתיבי אימות ממוקדים; broad runner בסביבת Dropbox עדיין לא יציב.

## פרמטרים ופרופילי ניקוד

מודלים:

- `ParameterDefinition`
- `ScoringProfile`
- `ScoringProfileParameter`

פרמטר מוסדי:

- שם.
- הגדרה מילולית.
- סולם: `ONE_TO_THREE`, `ONE_TO_TEN`, `ONE_TO_ONE_HUNDRED`.
- משקל.
- active/inactive.
- stage-specific או all-stage.

פרופיל ניקוד:

- יכול להיות מוסדי, קבוצתי או חניך.
- טיוטה יכולה להיות לא מאוזנת.
- פרסום דורש סכום משקלים 100%.
- שדות nullable בפרופיל מקומי מייצגים ירושה.
- החלטת מוצר: צריך לאפשר התאמות אישיות לחניך בפרמטרים, משקלים וספים/חוקי
  תצוגה, גם כאשר ברירת המחדל מגיעה מהקבוצה או מהתכנית.

חוקי ירושה:

1. מוסד.
2. קבוצה.
3. חניך.

ההגדרה הספציפית ביותר גוברת, אך שדות שלא נדרסו יורשים שינויים מהמקור.

סטטוס:

- UI מוסדי קיים חלקית ב-`/stage-settings`.
- UI קבוצה/חניך קיים חלקית ב-`/stage-settings/groups/[groupId]` ו-`/stage-settings/trainees/[traineeId]`, כולל ירושה/מותאם ואיפוס שדות לירושה.
- Task C עדכן את ולידציית המשקל האפקטיבית כך שתשלב all-stage ו-stage-specific בזמן פרסום פרופיל מוסדי/קבוצה/חניך.
- Task B טיפל ב-fit report כך שפרופיל מקומי עם `weightPercent = null` יורש את משקל המקור, ונוספה רגרסיה לכך.
- חסום טכני/מוצרי: האם התאמות חניך צריכות להשתמש רק ב-`ScoringProfile`, או
  שגם מודלי legacy של custom overrides נשארים פעילים.

## דיווחים וציונים

מודלים:

- `MeasurementReport`
- `ScoreEntry`

יחידת דיווח:

- חניך + מועד מדידה.
- סטטוס `DRAFT` או `PUBLISHED`.
- הערה אופציונלית.
- `isVacationOverride`.
- pinning ל-`stageProgramVersionId` ול-`scoringProfileId`.

חוקים:

- טיוטה לא נספרת בחישובי דוח.
- פרסום יוצר/מעדכן `ScoreEntry`.
- ציון חייב להיות בטווח הסולם של הפרמטר.
- `NOT_APPLICABLE` יוצא מהמכנה.
- `NOT_SCORED` נספר כאפס.

תיקוני correctness שנסגרו:

- Task B שומר pinning היסטורי של `stageProgramVersionId` ו-`scoringProfileId` בעת עריכת דיווח מפורסם.
- Task B מונע משמירת טיוטה למחוק `ScoreEntry` גלוי לפני פרסום.
- `reportService.integration` כולל רגרסיות לשני המצבים האלה ועבר בהרצה ממוקדת בעותק non-Dropbox לפי הלוח.

## חופשות

מודל: `VacationPeriod`

Scopes:

- מוסד: ללא `groupId` וללא `traineeId`.
- קבוצה: `groupId`.
- חניך: `traineeId`.

חוקים:

- חופשות מצטברות: מוסד + קבוצה + חניך.
- חופשה ספציפית לא מבטלת חופשה כללית.
- יום חופשה מסומן בדיווח.
- דיווח חריג ביום חופשה מותר ונספר אם פורסם.

סטטוס:

- סימון חופשה בבחירת ימי דיווח קיים ב-Reporting UI MVP.

פערים:

- השפעת חופשות על חלונות תקופתיים חסומה עד אפיון aggregation/period.

## היסטוריה ואודיט

מודלים:

- `TraineeGroupMembershipHistory`
- `SettingsChangeLogEntry`
- `AuditLogEntry`
- `StagePeriodSnapshot`
- `StageChangeEvent`

מה פעיל עכשיו:

- היסטוריית מעבר קבוצה.
- Settings change log לפרופילי ניקוד.
- Audit log לפעולות רגישות.

מה חסום:

- `StagePeriodSnapshot` דורש אפיון תקופות.
- `StageChangeEvent` דורש אפיון שינוי שלב והמלצות.
