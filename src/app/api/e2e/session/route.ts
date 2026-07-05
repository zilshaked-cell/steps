import { encode } from "@auth/core/jwt";
import { cookies } from "next/headers";
import { findActiveStaffUserByEmail } from "@/repositories/staffUserRepository";

const SESSION_COOKIE_NAME = "authjs.session-token";
const SESSION_MAX_AGE_SECONDS = 60 * 60;

function isLoopbackUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  } catch {
    return false;
  }
}

function isE2eAuthEnabled() {
  return process.env.E2E_TEST_AUTH === "1" && isLoopbackUrl(process.env.AUTH_URL);
}

function notFoundResponse() {
  return new Response(null, { status: 404 });
}

function requestEmail(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const email = (body as { email?: unknown }).email;
  return typeof email === "string" && email.trim() ? email.trim() : null;
}

export async function POST(request: Request) {
  if (!isE2eAuthEnabled()) return notFoundResponse();

  const email = requestEmail(await request.json().catch(() => null));
  if (!email) {
    return Response.json({ error: "email is required" }, { status: 400 });
  }

  const staffUser = await findActiveStaffUserByEmail(email);
  if (!staffUser) {
    return Response.json({ error: "staff user not found" }, { status: 404 });
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return Response.json({ error: "AUTH_SECRET is required" }, { status: 500 });
  }

  const token = await encode({
    secret,
    salt: SESSION_COOKIE_NAME,
    maxAge: SESSION_MAX_AGE_SECONDS,
    token: {
      sub: staffUser.id,
      staffUserId: staffUser.id,
      name: staffUser.name,
      email: staffUser.email,
      role: staffUser.role,
      institutionId: staffUser.institutionId,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: false,
  });

  return Response.json({
    ok: true,
    user: {
      id: staffUser.id,
      email: staffUser.email,
      role: staffUser.role,
      institutionId: staffUser.institutionId,
    },
  });
}

export async function DELETE() {
  if (!isE2eAuthEnabled()) return notFoundResponse();

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  return Response.json({ ok: true });
}
