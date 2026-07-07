// Fixture factories + reset for the real-Postgres integration suite.
//
// Deliberately imports the app's own `@/lib/prisma` singleton (not a separate test
// client) — by the time a test file's imports run, tests/integration/vitestSetup.ts
// (a Vitest setupFile) has already overwritten process.env.DATABASE_URL to point at
// TEST_DATABASE_URL, so this singleton — and every repository/service that imports
// it — transparently talks to the test database. That means these tests exercise
// the real resolvePermission/fitReport code paths, not a reimplementation of them.
import { prisma } from "@/lib/prisma";
import { toDateOnly } from "@/lib/dateOnly";
import type {
  StaffRole,
  PermissionAction,
  PermissionEffect,
  ParameterEntryStatus,
  ScoreScale,
} from "@/generated/prisma/enums";

export { prisma as testPrisma };

const TABLES_IN_TRUNCATE_ORDER = [
  "AuditLogEntry",
  "SettingsChangeLogEntry",
  "StageChangeEvent",
  "StagePeriodSnapshot",
  "ScoreEntry",
  "MeasurementReport",
  "ScoringProfileParameter",
  "ScoringProfile",
  "VacationPeriod",
  "TraineeGroupMembershipHistory",
  "TraineeThresholdOverride",
  "TraineeParameterOverride",
  "StageThreshold",
  "ParameterDefinition",
  "StageProvision",
  "Stage",
  "StageProgramVersion",
  "StageProgram",
  "UserPermissionOverride",
  "RolePermission",
  "Trainee",
  "GroupStaffAssignment",
  "StaffUser",
  "Group",
  "Institution",
];

export async function resetDatabase(): Promise<void> {
  const quoted = TABLES_IN_TRUNCATE_ORDER.map((table) => `"${table}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`);
}

let uniqueCounter = 0;
function unique(prefix: string): string {
  uniqueCounter += 1;
  return `${prefix}-${Date.now()}-${uniqueCounter}`;
}

export function createInstitution(name = "Test Institution") {
  return prisma.institution.create({ data: { name: unique(name) } });
}

export async function createStaffUser(params: {
  institutionId: string;
  role?: StaffRole;
  name?: string;
}) {
  return prisma.staffUser.create({
    data: {
      institutionId: params.institutionId,
      name: params.name ?? "Test Staff",
      email: `${unique("staff")}@example.test`,
      role: params.role ?? "COUNSELOR",
    },
  });
}

export function createGroup(institutionId: string, name = "Test Group") {
  return prisma.group.create({ data: { institutionId, name: unique(name) } });
}

export function createTrainee(params: {
  institutionId: string;
  groupId?: string | null;
  currentStageId?: string | null;
}) {
  return prisma.trainee.create({
    data: {
      institutionId: params.institutionId,
      groupId: params.groupId ?? null,
      firstName: "Test",
      lastName: unique("Trainee"),
      currentStageId: params.currentStageId ?? null,
    },
  });
}

export function setRolePermission(params: {
  institutionId: string;
  role: StaffRole;
  action: PermissionAction;
  allowed: boolean;
}) {
  return prisma.rolePermission.create({ data: params });
}

export function setUserPermissionOverride(params: {
  institutionId: string;
  staffId: string;
  action: PermissionAction;
  effect: PermissionEffect;
  groupId?: string | null;
  traineeId?: string | null;
}) {
  return prisma.userPermissionOverride.create({ data: params });
}

// One stage, and parameters whose weights sum to 100 by default — matching the
// schema's 100%-total invariant (enforced at the service layer, not the DB).
export async function createStageProgramVersion(params: {
  institutionId: string;
  requiredMeasurementDays?: number;
  parameterWeights?: number[];
  parameterScoreScales?: ScoreScale[];
}) {
  const program = await prisma.stageProgram.create({
    data: { institutionId: params.institutionId, name: unique("Program") },
  });
  const version = await prisma.stageProgramVersion.create({
    data: {
      stageProgramId: program.id,
      versionNumber: 1,
      requiredMeasurementDays: params.requiredMeasurementDays ?? 14,
    },
  });
  const stage = await prisma.stage.create({
    data: { stageProgramVersionId: version.id, order: 1, name: "Stage 1" },
  });

  const weights = params.parameterWeights ?? [50, 50];
  const parameters = [];
  for (const [index, weightPercent] of weights.entries()) {
    parameters.push(
      await prisma.parameterDefinition.create({
        data: {
          stageProgramVersionId: version.id,
          name: `Parameter ${index + 1}`,
          weightPercent,
          scoreScale: params.parameterScoreScales?.[index] ?? "ONE_TO_TEN",
        },
      }),
    );
  }

  return { program, version, stage, parameters };
}

export function createScoreEntry(params: {
  traineeId: string;
  parameterDefinitionId: string;
  measurementDate: Date;
  status: ParameterEntryStatus;
  rawScore?: number | null;
  recordedById: string;
}) {
  return prisma.scoreEntry.create({
    data: { ...params, measurementDate: toDateOnly(params.measurementDate) },
  });
}
