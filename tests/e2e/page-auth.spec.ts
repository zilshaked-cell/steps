import { expect, test, type Page } from "@playwright/test";

interface E2eFixture {
  adminEmail: string;
  deniedEmail: string;
  groupId: string;
  foreignGroupId: string;
  traineeId: string;
}

let fixture: E2eFixture;

test.beforeEach(async ({ request }) => {
  const response = await request.post("/api/e2e/fixture");
  expect(response.ok()).toBe(true);
  fixture = (await response.json()) as E2eFixture;
});

async function signInAs(page: Page, email: string) {
  const response = await page.request.post("/api/e2e/session", { data: { email } });
  expect(response.ok()).toBe(true);
}

test("renders the login page and logged-out report guard without Google credentials", async ({ page }) => {
  await page.goto("/login?error=AccessDenied");

  await expect(page.getByRole("heading", { name: "התחברות" })).toBeVisible();
  await expect(page.getByRole("button", { name: "התחברות עם Google" })).toBeVisible();
  await expect(page.getByText("חשבון Google לא מאושר למערכת")).toBeVisible();

  await page.goto(`/groups/${fixture.groupId}`);

  await expect(page.getByRole("heading", { name: "נדרשת התחברות" })).toBeVisible();
  await expect(page.getByRole("link", { name: "התחברות" })).toHaveAttribute("href", "/login");
});

test("renders authenticated home, group report, and trainee report", async ({ page }) => {
  await signInAs(page, fixture.adminEmail);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "מוסד E2E" })).toBeVisible();
  await expect(page.getByRole("link", { name: "פתיחת דוח התאמה עבור קבוצת ארז" })).toBeVisible();

  await page.goto(`/groups/${fixture.groupId}`);
  await expect(page.getByRole("heading", { name: "קבוצת ארז" })).toBeVisible();
  await expect(page.getByRole("table", { name: "דוח התאמה קבוצתי עבור קבוצת ארז" })).toBeVisible();
  await expect(page.getByRole("link", { name: "דנה כהן" })).toBeVisible();
  await expect(page.getByText("32.0")).toBeVisible();

  await page.goto(`/trainees/${fixture.traineeId}`);
  await expect(page.getByRole("heading", { name: "דנה כהן" })).toBeVisible();
  await expect(page.getByRole("table", { name: "פירוט פרמטרים ליום המדידה האחרון" })).toBeVisible();
  await expect(page.getByText("עמידה בשגרה")).toBeVisible();
  await expect(page.getByText("לא נוקד")).toBeVisible();
});

test("shows a denied state for authenticated staff without VIEW_REPORTS", async ({ page }) => {
  await signInAs(page, fixture.deniedEmail);

  await page.goto(`/groups/${fixture.groupId}`);

  await expect(page.getByRole("heading", { name: "אין הרשאה" })).toBeVisible();
  await expect(page.getByText("אין לך הרשאה לצפות בדוח התאמה של קבוצה זו.")).toBeVisible();
});

test("does not expose a foreign institution group to an authenticated admin", async ({ page }) => {
  await signInAs(page, fixture.adminEmail);

  const response = await page.goto(`/groups/${fixture.foreignGroupId}`);

  expect(response?.status()).toBe(404);
});
