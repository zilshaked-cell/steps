import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getStaffUserByEmail } from "@/repositories/staffUserRepository";

// Temporary dev-only login: email + password checked against StaffUser.passwordHash.
// Swap this provider for a real OIDC identity provider before any real deployment —
// the rest of the app should only ever depend on `auth()`/session shape, not on
// Credentials specifically, so that swap doesn't ripple outward.
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") return null;

        const user = await getStaffUserByEmail(email);
        if (!user || !user.active || !user.passwordHash) return null;

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          institutionId: user.institutionId,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.role = user.role;
        token.institutionId = user.institutionId;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user && token.role && token.institutionId) {
        session.user.id = token.sub as string;
        session.user.role = token.role;
        session.user.institutionId = token.institutionId;
      }
      return session;
    },
  },
});
