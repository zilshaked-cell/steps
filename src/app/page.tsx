import Link from "next/link";
import { auth } from "@/lib/auth";
import { listInstitutions } from "@/repositories/institutionRepository";
import { listGroupsByInstitution } from "@/repositories/groupRepository";

export default async function Home() {
  const session = await auth();
  const institutions = await listInstitutions();
  const institution = institutions[0];
  const groups = institution ? await listGroupsByInstitution(institution.id) : [];

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 640 }}>
      <h1>שלבים</h1>
      <p>
        {session?.user ? (
          `מחובר כ־${session.user.name} (${session.user.role})`
        ) : (
          <Link href="/login">התחברות</Link>
        )}
      </p>

      <h2>{institution?.name ?? "אין מוסד מוגדר"}</h2>
      <ul>
        {groups.map((group) => (
          <li key={group.id}>
            <Link href={`/groups/${group.id}`}>{group.name}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
