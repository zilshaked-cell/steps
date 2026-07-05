import { beforeEach, describe, expect, it } from "vitest";
import {
  appendAuditLogEntry,
  AuditLogValidationError,
} from "@/services/audit/auditLogService";
import { createInstitution, createStaffUser, resetDatabase, testPrisma } from "./db";

beforeEach(async () => {
  await resetDatabase();
});

describe("appendAuditLogEntry (real Postgres)", () => {
  it("appends a system audit entry with explicit action and metadata", async () => {
    const institution = await createInstitution();

    const entry = await appendAuditLogEntry({
      institutionId: institution.id,
      action: "PERMISSION_OVERRIDE_CREATE",
      metadata: { staffId: "staff-1", effect: "ALLOW" },
    });

    expect(entry).toMatchObject({
      institutionId: institution.id,
      actorId: null,
      action: "PERMISSION_OVERRIDE_CREATE",
      metadata: { staffId: "staff-1", effect: "ALLOW" },
    });
  });

  it("appends every call as a new row", async () => {
    const institution = await createInstitution();

    await appendAuditLogEntry({ institutionId: institution.id, action: "AUTH_LOGIN" });
    await appendAuditLogEntry({ institutionId: institution.id, action: "AUTH_LOGIN" });

    const entries = await testPrisma.auditLogEntry.findMany({
      where: { institutionId: institution.id, action: "AUTH_LOGIN" },
    });
    expect(entries).toHaveLength(2);
  });

  it("accepts an actor only when the staff user belongs to the same institution", async () => {
    const institution = await createInstitution();
    const actor = await createStaffUser({ institutionId: institution.id });

    const entry = await appendAuditLogEntry({
      institutionId: institution.id,
      actorId: actor.id,
      action: "SETTINGS_CHANGE",
    });

    expect(entry.actorId).toBe(actor.id);
  });

  it("rejects an actor from a different institution", async () => {
    const institutionA = await createInstitution("Institution A");
    const institutionB = await createInstitution("Institution B");
    const actorB = await createStaffUser({ institutionId: institutionB.id });

    await expect(
      appendAuditLogEntry({
        institutionId: institutionA.id,
        actorId: actorB.id,
        action: "SETTINGS_CHANGE",
      }),
    ).rejects.toMatchObject({
      code: "ACTOR_OUT_OF_SCOPE",
    } satisfies Partial<AuditLogValidationError>);
  });

  it("rejects unstable action names", async () => {
    const institution = await createInstitution();

    await expect(
      appendAuditLogEntry({
        institutionId: institution.id,
        action: "settings changed",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_ACTION",
    } satisfies Partial<AuditLogValidationError>);
  });
});
