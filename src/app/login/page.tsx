import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import styles from "../page.module.css";
import { auth, signIn } from "@/lib/auth";

const ERROR_MESSAGES: Record<string, string> = {
  setup: "חסרה הגדרת Google OAuth ב-.env.",
  AccessDenied: "חשבון Google לא מאושר למערכת. ודאו שהאימייל מאומת וקיים כמשתמש צוות פעיל.",
  OAuthCallbackError: "Google החזירה שגיאת התחברות. נסו שוב.",
  OAuthSignin: "לא הצלחנו להתחיל התחברות מול Google.",
  Configuration: "יש בעיה בהגדרת Google OAuth. בדרך כלל זה Client Secret שגוי או Secret שלא שייך ל-Client ID.",
};

function isGoogleAuthConfigured() {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

async function googleLoginAction() {
  "use server";
  if (!isGoogleAuthConfigured()) redirect("/login?error=setup");

  try {
    await signIn("google", { redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/login?error=${error.type}`);
    }
    throw error;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const session = await auth();
  if (session?.user?.institutionId) redirect("/");
  const isConfigured = isGoogleAuthConfigured();

  return (
    <main className={styles.loginPage}>
      <section className={styles.loginPanel}>
        <p className={styles.kicker}>כניסת צוות</p>
        <h1>התחברות</h1>
        <p>
          הכניסה זמינה רק לאנשי צוות שמוגדרים במערכת עם אותו אימייל Google מאומת.
        </p>

        {error && (
          <p className={styles.errorMessage}>
            {ERROR_MESSAGES[error] ?? "לא הצלחנו להתחבר עם Google."}
          </p>
        )}
        {!isConfigured && (
          <p className={styles.warningMessage}>
            יש להגדיר `AUTH_GOOGLE_ID` ו-`AUTH_GOOGLE_SECRET` לפני התחברות עם Google.
          </p>
        )}
        <form action={googleLoginAction}>
          <button type="submit" disabled={!isConfigured} className={styles.primaryButton}>
            התחברות עם Google
          </button>
        </form>
      </section>
    </main>
  );
}
