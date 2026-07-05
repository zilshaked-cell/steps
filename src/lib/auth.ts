import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { findActiveStaffUserByEmail } from "@/repositories/staffUserRepository";

function profileEmail(profile: unknown): string | null {
  if (!profile || typeof profile !== "object") return null;
  const email = (profile as { email?: unknown }).email;
  return typeof email === "string" && email.trim() ? email.trim() : null;
}

function isVerifiedGoogleProfile(profile: unknown): boolean {
  if (!profile || typeof profile !== "object") return false;
  const emailVerified = (profile as { email_verified?: unknown }).email_verified;
  return emailVerified === true || emailVerified === "true";
}

// Google verifies identity; StaffUser remains the app's authorization source.
// Only active staff rows whose email matches a verified Google profile can enter.
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    signIn: async ({ account, profile }) => {
      if (account?.provider !== "google") return false;
      const email = profileEmail(profile);
      if (!email || !isVerifiedGoogleProfile(profile)) return false;

      const staffUser = await findActiveStaffUserByEmail(email);
      return Boolean(staffUser);
    },
    jwt: async ({ token, account, profile }) => {
      const email = account?.provider === "google" ? profileEmail(profile) : token.email;
      if (typeof email === "string") {
        const staffUser = await findActiveStaffUserByEmail(email);
        if (staffUser) {
          token.staffUserId = staffUser.id;
          token.name = staffUser.name;
          token.email = staffUser.email;
          token.role = staffUser.role;
          token.institutionId = staffUser.institutionId;
        }
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user && token.staffUserId && token.role && token.institutionId) {
        session.user.id = token.staffUserId;
        session.user.role = token.role;
        session.user.institutionId = token.institutionId;
      }
      return session;
    },
  },
});
