# שלבים

מעקב חינוכי־התנהגותי — שלד ראשוני. בשלב זה רק תחום **תכניות שלבים** ממומש; שאר התחומים (תכניות שנתיות, תכניות אסימונים, סיכומי יום) מכוונים ארכיטקטונית אך לא ממומשים.

## סטאק

Next.js (App Router) + TypeScript, PostgreSQL דרך Prisma (עם driver adapter `@prisma/adapter-pg` — Prisma 7 דורש זאת במקום datasource URL ישיר), Auth.js עם ספק Credentials **זמני** (ראו `src/lib/auth.ts`).

## הרצה מקומית

PostgreSQL 17 מותקן מקומית (native, לא Docker — ראו `docker-compose.yml` כאלטרנטיבה אם עוברים ל-Docker בהמשך). המשתמש `steps` (סיסמה תואמת ל-`DATABASE_URL` ב-`.env`) הוא בעל בסיס הנתונים `steps_dev` ויש לו הרשאת `CREATEDB` (נדרש ל-shadow database של `prisma migrate dev`). ל-`postgres` הוגדרה סיסמת פיתוח (`postgres_dev_password`) לצורך משימות ניהול עתידיות — לא לשימוש מעבר לסביבת הפיתוח המקומית.

1. ודאו ששירות `postgresql-x64-17` רץ (`Get-Service postgresql-x64-17`).
2. `npm install`
3. `npx prisma migrate dev` — יוצר/מעדכן את הסכימה בפועל.
4. `npm run dev`

## מבנה תיקיות (`src/`)

- `domain/` — טיפוסים/לוגיקה טהורה של תחום השלבים, ללא תלות ב-DB.
- `services/` — לוגיקה עסקית: `permissions/resolvePermission.ts` (הרשאות), `stagePrograms/` (חישוב ציון, מיעוט נתונים, המלצת שלב).
- `repositories/` — גישה לנתונים (Prisma) — ייבנה בהמשך לפי הצורך.
- `audit/` — כתיבה ל-Audit Log — ייבנה בהמשך לפי הצורך.
- `lib/` — Prisma client singleton, קונפיגורציית Auth.js.

## החלטות פתוחות שלא ננעלו בכוונה

`src/services/stagePrograms/recommendation.ts` זורק שגיאה במפורש — סמנטיקת גבולות הסף (כולל/לא כולל, טווח "דורש בדיקה") טרם הוגדרה במוצר. אין להניח החלטה כאן לפני שהיא נסגרת.
