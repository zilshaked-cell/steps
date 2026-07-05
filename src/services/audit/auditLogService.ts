import { prisma } from "@/lib/prisma";
import type { AuditLogEntry, Prisma } from "@/generated/prisma/client";

export type AuditLogValidationCode =
  | "INVALID_ACTION"
  | "INSTITUTION_NOT_FOUND"
  | "ACTOR_OUT_OF_SCOPE";

export class AuditLogValidationError extends Error {
  constructor(
    readonly code: AuditLogValidationCode,
    message: string,
  ) {
    super(message);
    this.name = "AuditLogValidationError";
  }
}

export interface AppendAuditLogEntryInput {
  institutionId: string;
  actorId?: string | null;
  action: string;
  metadata?: Prisma.InputJsonValue;
}

const ACTION_PATTERN = /^[A-Z][A-Z0-9_.:-]{1,127}$/;

function normalizeAction(action: string): string {
  const normalized = action.trim();
  if (!ACTION_PATTERN.test(normalized)) {
    throw new AuditLogValidationError(
      "INVALID_ACTION",
      "Audit log action must be a stable uppercase identifier without whitespace.",
    );
  }
  return normalized;
}

export async function appendAuditLogEntry(
  input: AppendAuditLogEntryInput,
): Promise<AuditLogEntry> {
  const action = normalizeAction(input.action);

  const institution = await prisma.institution.findUnique({
    where: { id: input.institutionId },
    select: { id: true },
  });
  if (!institution) {
    throw new AuditLogValidationError("INSTITUTION_NOT_FOUND", "Audit institution was not found.");
  }

  if (input.actorId) {
    const actor = await prisma.staffUser.findUnique({
      where: { id: input.actorId },
      select: { institutionId: true },
    });
    if (!actor || actor.institutionId !== input.institutionId) {
      throw new AuditLogValidationError(
        "ACTOR_OUT_OF_SCOPE",
        "Audit actor does not belong to institution.",
      );
    }
  }

  return prisma.auditLogEntry.create({
    data: {
      institutionId: input.institutionId,
      actorId: input.actorId ?? null,
      action,
      metadata: input.metadata,
    },
  });
}
