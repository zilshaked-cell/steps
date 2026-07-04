import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>שלבים — שלד פרויקט</h1>
      {session?.user ? (
        <p>
          מחובר כ־{session.user.name} ({session.user.role})
        </p>
      ) : (
        <p>לא מחובר.</p>
      )}
    </main>
  );
}
