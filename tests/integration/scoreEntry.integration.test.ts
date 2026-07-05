import { beforeEach, describe, expect, it } from "vitest";
import { upsertScoreEntry } from "@/repositories/scoreEntryRepository";
import { toDateOnly } from "@/lib/dateOnly";
import {
  resetDatabase,
  createInstitution,
  createStaffUser,
  createTrainee,
  createStageProgramVersion,
  testPrisma,
} from "./db";

beforeEach(async () => {
  await resetDatabase();
});

describe("upsertScoreEntry (real Postgres)", () => {
  it("accepts SCORED with an integer rawScore between 1 and 10", async () => {
    const institution = await createInstitution();
    const staff = await createStaffUser({ institutionId: institution.id });
    const { parameters } = await createStageProgramVersion({ institutionId: institution.id });
    const trainee = await createTrainee({ institutionId: institution.id });

    const entry = await upsertScoreEntry({
      traineeId: trainee.id,
      parameterDefinitionId: parameters[0].id,
      measurementDate: new Date(),
      status: "SCORED",
      rawScore: 7,
      recordedById: staff.id,
    });

    expect(entry.rawScore).toBe(7);
  });

  // upsertScoreEntry is declared `async` specifically so validation failures always
  // surface as a rejected Promise (never a synchronous throw) — assert with
  // `.rejects`, not a sync `expect(() => ...).toThrow()`, or these would pass for
  // the wrong reason (or not at all, depending on how the assertion is written).
  it.each([null, undefined, 0, 11, 5.5])(
    "rejects SCORED with an invalid rawScore: %s",
    async (invalidRawScore) => {
      const institution = await createInstitution();
      const staff = await createStaffUser({ institutionId: institution.id });
      const { parameters } = await createStageProgramVersion({ institutionId: institution.id });
      const trainee = await createTrainee({ institutionId: institution.id });

      await expect(
        upsertScoreEntry({
          traineeId: trainee.id,
          parameterDefinitionId: parameters[0].id,
          measurementDate: new Date(),
          status: "SCORED",
          rawScore: invalidRawScore as number | null | undefined,
          recordedById: staff.id,
        }),
      ).rejects.toThrow(/rawScore/);
    },
  );

  it("forces rawScore to null for NOT_SCORED even if the caller passes a value", async () => {
    const institution = await createInstitution();
    const staff = await createStaffUser({ institutionId: institution.id });
    const { parameters } = await createStageProgramVersion({ institutionId: institution.id });
    const trainee = await createTrainee({ institutionId: institution.id });

    const entry = await upsertScoreEntry({
      traineeId: trainee.id,
      parameterDefinitionId: parameters[0].id,
      measurementDate: new Date(),
      status: "NOT_SCORED",
      rawScore: 9, // deliberately wrong input — must be ignored, not stored
      recordedById: staff.id,
    });

    expect(entry.rawScore).toBeNull();
  });

  it("clears a stale rawScore across SCORED -> NOT_SCORED -> SCORED -> NOT_APPLICABLE transitions", async () => {
    const institution = await createInstitution();
    const staff = await createStaffUser({ institutionId: institution.id });
    const { parameters } = await createStageProgramVersion({ institutionId: institution.id });
    const trainee = await createTrainee({ institutionId: institution.id });
    const measurementDate = new Date();
    const key = {
      traineeId_parameterDefinitionId_measurementDate: {
        traineeId: trainee.id,
        parameterDefinitionId: parameters[0].id,
        measurementDate: toDateOnly(measurementDate),
      },
    };

    await upsertScoreEntry({
      traineeId: trainee.id,
      parameterDefinitionId: parameters[0].id,
      measurementDate,
      status: "SCORED",
      rawScore: 8,
      recordedById: staff.id,
    });

    const clearedByNotScored = await upsertScoreEntry({
      traineeId: trainee.id,
      parameterDefinitionId: parameters[0].id,
      measurementDate,
      status: "NOT_SCORED",
      rawScore: 8, // deliberately wrong input — must be cleared, not carried over
      recordedById: staff.id,
    });
    expect(clearedByNotScored.rawScore).toBeNull();
    await expect(testPrisma.scoreEntry.findUniqueOrThrow({ where: key })).resolves.toMatchObject({
      status: "NOT_SCORED",
      rawScore: null,
    });

    await upsertScoreEntry({
      traineeId: trainee.id,
      parameterDefinitionId: parameters[0].id,
      measurementDate,
      status: "SCORED",
      rawScore: 6,
      recordedById: staff.id,
    });

    const clearedByNotApplicable = await upsertScoreEntry({
      traineeId: trainee.id,
      parameterDefinitionId: parameters[0].id,
      measurementDate,
      status: "NOT_APPLICABLE",
      rawScore: 6,
      recordedById: staff.id,
    });
    expect(clearedByNotApplicable.rawScore).toBeNull();
    await expect(testPrisma.scoreEntry.findUniqueOrThrow({ where: key })).resolves.toMatchObject({
      status: "NOT_APPLICABLE",
      rawScore: null,
    });
  });

  it("normalizes measurementDate to one entry per trainee, parameter, and day", async () => {
    const institution = await createInstitution();
    const staff = await createStaffUser({ institutionId: institution.id });
    const { parameters } = await createStageProgramVersion({ institutionId: institution.id });
    const trainee = await createTrainee({ institutionId: institution.id });
    const morning = new Date("2026-07-05T03:00:00.000Z");
    const evening = new Date("2026-07-05T21:00:00.000Z");

    await upsertScoreEntry({
      traineeId: trainee.id,
      parameterDefinitionId: parameters[0].id,
      measurementDate: morning,
      status: "SCORED",
      rawScore: 4,
      recordedById: staff.id,
    });

    const updated = await upsertScoreEntry({
      traineeId: trainee.id,
      parameterDefinitionId: parameters[0].id,
      measurementDate: evening,
      status: "SCORED",
      rawScore: 9,
      recordedById: staff.id,
    });

    const entries = await testPrisma.scoreEntry.findMany({
      where: { traineeId: trainee.id, parameterDefinitionId: parameters[0].id },
    });
    expect(entries).toHaveLength(1);
    expect(updated.rawScore).toBe(9);
    expect(updated.measurementDate.toISOString()).toBe(toDateOnly(morning).toISOString());
  });

  it("does not mutate an existing row when an invalid SCORED update is rejected", async () => {
    const institution = await createInstitution();
    const staff = await createStaffUser({ institutionId: institution.id });
    const { parameters } = await createStageProgramVersion({ institutionId: institution.id });
    const trainee = await createTrainee({ institutionId: institution.id });
    const measurementDate = new Date("2026-07-05T15:30:00.000Z");

    await upsertScoreEntry({
      traineeId: trainee.id,
      parameterDefinitionId: parameters[0].id,
      measurementDate,
      status: "SCORED",
      rawScore: 5,
      recordedById: staff.id,
    });

    await expect(
      upsertScoreEntry({
        traineeId: trainee.id,
        parameterDefinitionId: parameters[0].id,
        measurementDate,
        status: "SCORED",
        rawScore: 11,
        recordedById: staff.id,
      }),
    ).rejects.toThrow(/rawScore/);

    const entry = await testPrisma.scoreEntry.findUniqueOrThrow({
      where: {
        traineeId_parameterDefinitionId_measurementDate: {
          traineeId: trainee.id,
          parameterDefinitionId: parameters[0].id,
          measurementDate: toDateOnly(measurementDate),
        },
      },
    });
    expect(entry).toMatchObject({ status: "SCORED", rawScore: 5 });
  });
});
