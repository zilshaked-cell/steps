import { beforeEach, describe, expect, it } from "vitest";
import { toDateOnlyKey } from "@/lib/dateOnly";
import { ensureDefaultRolePermissions } from "@/services/permissions/rolePermissionDefaults";
import {
  createVacationPeriod,
  deleteVacationPeriod,
  getVacationDayKeysForTrainee,
  isVacationDayForTrainee,
  listEffectiveVacationPeriodsForTrainee,
  updateVacationPeriod,
  VacationMutationError,
} from "@/services/vacations/vacationService";
import {
  createGroup,
  createInstitution,
  createStaffUser,
  createTrainee,
  resetDatabase,
  setUserPermissionOverride,
  testPrisma,
} from "./db";

beforeEach(async () => {
  await resetDatabase();
});

function day(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`);
}

describe("vacation management service (real Postgres)", () => {
  it("lets an admin create, update, and delete a vacation with audit entries", async () => {
    const institution = await createInstitution();
    const admin = await createStaffUser({ institutionId: institution.id, role: "ADMIN" });
    await ensureDefaultRolePermissions(institution.id);
    const actor = { id: admin.id, institutionId: institution.id, role: "ADMIN" as const };

    const vacation = await createVacationPeriod({
      actor,
      institutionId: institution.id,
      title: "  Summer closure  ",
      note: "  Staff planning  ",
      startsOn: day("2026-07-01"),
      endsOn: day("2026-07-03"),
    });

    expect(vacation).toMatchObject({
      institutionId: institution.id,
      title: "Summer closure",
      note: "Staff planning",
      groupId: null,
      traineeId: null,
      createdById: admin.id,
    });
    expect(toDateOnlyKey(vacation.startsOn)).toBe("2026-07-01");
    expect(toDateOnlyKey(vacation.endsOn)).toBe("2026-07-03");

    const updated = await updateVacationPeriod({
      actor,
      institutionId: institution.id,
      id: vacation.id,
      title: "Updated closure",
      note: "",
      startsOn: day("2026-07-02"),
      endsOn: day("2026-07-04"),
    });

    expect(updated).toMatchObject({
      id: vacation.id,
      title: "Updated closure",
      note: null,
    });
    expect(toDateOnlyKey(updated.startsOn)).toBe("2026-07-02");
    expect(toDateOnlyKey(updated.endsOn)).toBe("2026-07-04");

    const deleted = await deleteVacationPeriod({
      actor,
      institutionId: institution.id,
      id: vacation.id,
    });

    expect(deleted.id).toBe(vacation.id);
    await expect(
      testPrisma.vacationPeriod.findUnique({ where: { id: vacation.id } }),
    ).resolves.toBeNull();

    const auditActions = await testPrisma.auditLogEntry.findMany({
      where: { institutionId: institution.id, actorId: admin.id },
      select: { action: true },
    });
    expect(auditActions.map((entry) => entry.action).sort()).toEqual([
      "VACATION.CREATE",
      "VACATION.DELETE",
      "VACATION.UPDATE",
    ]);
  });

  it("denies vacation edits to a role without MANAGE_VACATIONS", async () => {
    const institution = await createInstitution();
    const lead = await createStaffUser({
      institutionId: institution.id,
      role: "LEAD_COORDINATOR",
    });
    await ensureDefaultRolePermissions(institution.id);

    await expect(
      createVacationPeriod({
        actor: { id: lead.id, institutionId: institution.id, role: "LEAD_COORDINATOR" },
        institutionId: institution.id,
        title: "Denied closure",
        startsOn: day("2026-07-01"),
        endsOn: day("2026-07-01"),
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    } satisfies Partial<VacationMutationError>);

    await expect(testPrisma.vacationPeriod.count()).resolves.toBe(0);
  });

  it("rolls back vacation creation when audit cannot be written", async () => {
    const institution = await createInstitution();
    await ensureDefaultRolePermissions(institution.id);

    await expect(
      createVacationPeriod({
        actor: { id: "missing-admin-actor", institutionId: institution.id, role: "ADMIN" },
        institutionId: institution.id,
        title: "Unaudited closure",
        startsOn: day("2026-07-01"),
        endsOn: day("2026-07-01"),
      }),
    ).rejects.toThrow();

    await expect(testPrisma.vacationPeriod.count()).resolves.toBe(0);
  });

  it("rolls back vacation updates when audit cannot be written", async () => {
    const institution = await createInstitution();
    const admin = await createStaffUser({ institutionId: institution.id, role: "ADMIN" });
    await ensureDefaultRolePermissions(institution.id);
    const vacation = await createVacationPeriod({
      actor: { id: admin.id, institutionId: institution.id, role: "ADMIN" },
      institutionId: institution.id,
      title: "Original closure",
      startsOn: day("2026-07-01"),
      endsOn: day("2026-07-01"),
    });

    await expect(
      updateVacationPeriod({
        actor: { id: "missing-admin-actor", institutionId: institution.id, role: "ADMIN" },
        institutionId: institution.id,
        id: vacation.id,
        title: "Unaudited update",
        startsOn: day("2026-07-02"),
        endsOn: day("2026-07-02"),
      }),
    ).rejects.toThrow();

    await expect(
      testPrisma.vacationPeriod.findUniqueOrThrow({ where: { id: vacation.id } }),
    ).resolves.toMatchObject({
      title: "Original closure",
      startsOn: vacation.startsOn,
      endsOn: vacation.endsOn,
    });
  });

  it("rolls back vacation deletes when audit cannot be written", async () => {
    const institution = await createInstitution();
    const admin = await createStaffUser({ institutionId: institution.id, role: "ADMIN" });
    await ensureDefaultRolePermissions(institution.id);
    const vacation = await createVacationPeriod({
      actor: { id: admin.id, institutionId: institution.id, role: "ADMIN" },
      institutionId: institution.id,
      title: "Protected closure",
      startsOn: day("2026-07-01"),
      endsOn: day("2026-07-01"),
    });

    await expect(
      deleteVacationPeriod({
        actor: { id: "missing-admin-actor", institutionId: institution.id, role: "ADMIN" },
        institutionId: institution.id,
        id: vacation.id,
      }),
    ).rejects.toThrow();

    await expect(
      testPrisma.vacationPeriod.findUnique({ where: { id: vacation.id } }),
    ).resolves.toMatchObject({
      id: vacation.id,
      title: "Protected closure",
    });
  });

  it("lets a group-scoped MANAGE_VACATIONS override create a trainee vacation", async () => {
    const institution = await createInstitution();
    const counselor = await createStaffUser({ institutionId: institution.id, role: "COUNSELOR" });
    const group = await createGroup(institution.id, "Permitted Group");
    const otherGroup = await createGroup(institution.id, "Other Group");
    const trainee = await createTrainee({ institutionId: institution.id, groupId: group.id });
    const otherTrainee = await createTrainee({
      institutionId: institution.id,
      groupId: otherGroup.id,
    });
    await ensureDefaultRolePermissions(institution.id);
    await setUserPermissionOverride({
      institutionId: institution.id,
      staffId: counselor.id,
      action: "MANAGE_VACATIONS",
      effect: "ALLOW",
      groupId: group.id,
    });
    const actor = {
      id: counselor.id,
      institutionId: institution.id,
      role: "COUNSELOR" as const,
    };

    const vacation = await createVacationPeriod({
      actor,
      institutionId: institution.id,
      traineeId: trainee.id,
      title: "Trainee leave",
      startsOn: day("2026-07-05"),
      endsOn: day("2026-07-05"),
    });

    expect(vacation).toMatchObject({
      traineeId: trainee.id,
      groupId: null,
    });

    await expect(
      createVacationPeriod({
        actor,
        institutionId: institution.id,
        traineeId: otherTrainee.id,
        title: "Wrong group leave",
        startsOn: day("2026-07-06"),
        endsOn: day("2026-07-06"),
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    } satisfies Partial<VacationMutationError>);
  });

  it("rejects malformed and cross-institution vacation scopes", async () => {
    const institutionA = await createInstitution("Institution A");
    const institutionB = await createInstitution("Institution B");
    const adminA = await createStaffUser({ institutionId: institutionA.id, role: "ADMIN" });
    const groupA = await createGroup(institutionA.id, "Group A");
    const groupB = await createGroup(institutionB.id, "Group B");
    const traineeA = await createTrainee({ institutionId: institutionA.id, groupId: groupA.id });
    const traineeB = await createTrainee({ institutionId: institutionB.id, groupId: groupB.id });
    await ensureDefaultRolePermissions(institutionA.id);
    const actor = { id: adminA.id, institutionId: institutionA.id, role: "ADMIN" as const };

    await expect(
      createVacationPeriod({
        actor,
        institutionId: institutionA.id,
        groupId: groupA.id,
        traineeId: traineeA.id,
        title: "Malformed",
        startsOn: day("2026-07-01"),
        endsOn: day("2026-07-01"),
      }),
    ).rejects.toMatchObject({
      code: "MALFORMED_SCOPE",
    } satisfies Partial<VacationMutationError>);

    await expect(
      createVacationPeriod({
        actor,
        institutionId: institutionA.id,
        groupId: groupB.id,
        title: "Foreign group",
        startsOn: day("2026-07-01"),
        endsOn: day("2026-07-01"),
      }),
    ).rejects.toMatchObject({
      code: "GROUP_OUT_OF_SCOPE",
    } satisfies Partial<VacationMutationError>);

    await expect(
      createVacationPeriod({
        actor,
        institutionId: institutionA.id,
        traineeId: traineeB.id,
        title: "Foreign trainee",
        startsOn: day("2026-07-01"),
        endsOn: day("2026-07-01"),
      }),
    ).rejects.toMatchObject({
      code: "TRAINEE_OUT_OF_SCOPE",
    } satisfies Partial<VacationMutationError>);
  });

  it("lists the union of institution, group, and trainee vacations for a trainee", async () => {
    const institution = await createInstitution();
    const admin = await createStaffUser({ institutionId: institution.id, role: "ADMIN" });
    const group = await createGroup(institution.id, "Target Group");
    const otherGroup = await createGroup(institution.id, "Other Group");
    const trainee = await createTrainee({ institutionId: institution.id, groupId: group.id });
    const otherTrainee = await createTrainee({
      institutionId: institution.id,
      groupId: group.id,
    });
    await ensureDefaultRolePermissions(institution.id);
    const actor = { id: admin.id, institutionId: institution.id, role: "ADMIN" as const };

    await createVacationPeriod({
      actor,
      institutionId: institution.id,
      title: "Institution closure",
      startsOn: day("2026-07-01"),
      endsOn: day("2026-07-02"),
    });
    await createVacationPeriod({
      actor,
      institutionId: institution.id,
      groupId: group.id,
      title: "Group trip",
      startsOn: day("2026-07-04"),
      endsOn: day("2026-07-04"),
    });
    await createVacationPeriod({
      actor,
      institutionId: institution.id,
      traineeId: trainee.id,
      title: "Trainee leave",
      startsOn: day("2026-07-06"),
      endsOn: day("2026-07-06"),
    });
    await createVacationPeriod({
      actor,
      institutionId: institution.id,
      groupId: otherGroup.id,
      title: "Other group",
      startsOn: day("2026-07-05"),
      endsOn: day("2026-07-05"),
    });
    await createVacationPeriod({
      actor,
      institutionId: institution.id,
      traineeId: otherTrainee.id,
      title: "Other trainee",
      startsOn: day("2026-07-07"),
      endsOn: day("2026-07-07"),
    });
    await createVacationPeriod({
      actor,
      institutionId: institution.id,
      title: "Outside range",
      startsOn: day("2026-06-20"),
      endsOn: day("2026-06-21"),
    });

    const effective = await listEffectiveVacationPeriodsForTrainee({
      institutionId: institution.id,
      traineeId: trainee.id,
      from: day("2026-07-01"),
      to: day("2026-07-07"),
    });

    expect(effective.map((vacation) => vacation.title)).toEqual([
      "Institution closure",
      "Group trip",
      "Trainee leave",
    ]);

    const dayKeys = await getVacationDayKeysForTrainee({
      institutionId: institution.id,
      traineeId: trainee.id,
      from: day("2026-07-01"),
      to: day("2026-07-07"),
    });
    expect([...dayKeys].sort()).toEqual([
      "2026-07-01",
      "2026-07-02",
      "2026-07-04",
      "2026-07-06",
    ]);
    await expect(
      isVacationDayForTrainee({
        institutionId: institution.id,
        traineeId: trainee.id,
        date: day("2026-07-04"),
      }),
    ).resolves.toBe(true);
    await expect(
      isVacationDayForTrainee({
        institutionId: institution.id,
        traineeId: trainee.id,
        date: day("2026-07-05"),
      }),
    ).resolves.toBe(false);
  });
});
