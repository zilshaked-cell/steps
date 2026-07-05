import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";

async function loginAction(formData: FormData) {
  "use server";
  try {
    await signIn("credentials", formData);
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=1");
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

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 360 }}>
      <h1>התחברות</h1>
      {error && <p style={{ color: "crimson" }}>אימייל או סיסמה שגויים.</p>}
      <form action={loginAction} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label>
          אימייל
          <input name="email" type="email" required style={{ display: "block", width: "100%" }} />
        </label>
        <label>
          סיסמה
          <input name="password" type="password" required style={{ display: "block", width: "100%" }} />
        </label>
        <input type="hidden" name="redirectTo" value="/" />
        <button type="submit">התחבר</button>
      </form>
    </main>
  );
}
