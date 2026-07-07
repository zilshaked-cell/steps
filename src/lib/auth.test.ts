import { describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { syncSessionStaffUser, syncStaffClaims } from "./auth";

vi.mock("next-auth", () => ({
  default: () => ({
    handlers: {},
    auth: () => null,
    signIn: () => null,
    signOut: () => null,
  }),
}));

vi.mock("next-auth/providers/google", () => ({
  default: () => ({ id: "google" }),
}));

vi.mock("@/repositories/staffUserRepository", () => ({
  findActiveStaffUserByEmail: async () => null,
}));

describe("syncStaffClaims", () => {
  it("clears app authorization claims when no active staff row is found", () => {
    const token = {
      email: "stale@example.test",
      name: "Stale User",
      staffUserId: "staff-old",
      role: "COUNSELOR",
      institutionId: "inst-old",
    } as JWT;

    syncStaffClaims(token, null);

    expect(token).toMatchObject({
      email: "stale@example.test",
      name: "Stale User",
    });
    expect(token.staffUserId).toBeUndefined();
    expect(token.role).toBeUndefined();
    expect(token.institutionId).toBeUndefined();
  });

  it("replaces app authorization claims from the active staff row", () => {
    const token = {
      email: "old@example.test",
      name: "Old User",
      staffUserId: "staff-old",
      role: "COUNSELOR",
      institutionId: "inst-old",
    } as JWT;

    syncStaffClaims(token, {
      id: "staff-new",
      name: "Admin User",
      email: "admin@example.test",
      role: "ADMIN",
      institutionId: "inst-new",
    });

    expect(token).toMatchObject({
      email: "admin@example.test",
      name: "Admin User",
      staffUserId: "staff-new",
      role: "ADMIN",
      institutionId: "inst-new",
    });
  });

  it("removes the session user when token authorization claims are missing", () => {
    const session = {
      expires: "2026-07-06T00:00:00.000Z",
      user: { name: "Stale User", email: "stale@example.test" },
    } as Session;

    syncSessionStaffUser(session, {
      email: "stale@example.test",
      name: "Stale User",
    } as JWT);

    expect(session.user).toBeUndefined();
  });

  it("copies token authorization claims into the session user", () => {
    const session = {
      expires: "2026-07-06T00:00:00.000Z",
      user: { name: "Admin User", email: "admin@example.test" },
    } as Session;

    syncSessionStaffUser(session, {
      staffUserId: "staff-1",
      role: "ADMIN",
      institutionId: "inst-1",
    } as JWT);

    expect(session.user).toMatchObject({
      id: "staff-1",
      role: "ADMIN",
      institutionId: "inst-1",
    });
  });
});
