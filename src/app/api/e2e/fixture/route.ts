import { prisma } from "@/lib/prisma";
import { toDateOnly } from "@/lib/dateOnly";

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

function isLoopbackUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  } catch {
    return false;
  }
}

function isE2eFixtureEnabled() {
  return process.env.E2E_TEST_AUTH === "1" && isLoopbackUrl(process.env.AUTH_URL);
}

function notFoundResponse() {
  return new Response(null, { status: 404 });
}

async function resetDatabase(): Promise<void> {
  const quoted = TABLES_IN_TRUNCATE_ORDER.map((table) => `"${table}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`);
}

export async function POST() {
  if (!isE2eFixtureEnabled()) return notFoundResponse();

  await resetDatabase();

  const [institution, foreignInstitution] = await Promise.all([
    prisma.institution.create({ data: { name: "מוסד E2E" } }),
    prisma.institution.create({ data: { name: "מוסד זר" } }),
  ]);

  const [group, foreignGroup] = await Promise.all([
    prisma.group.create({ data: { institutionId: institution.id, name: "קבוצת ארז" } }),
    prisma.group.create({ data: { institutionId: foreignInstitution.id, name: "קבוצה זרה" } }),
  ]);

  const [admin, deniedStaff] = await Promise.all([
    prisma.staffUser.create({
      data: {
        institutionId: institution.id,
        name: "מנהלת E2E",
        email: "admin.e2e@example.test",
        role: "ADMIN",
      },
    }),
    prisma.staffUser.create({
      data: {
        institutionId: institution.id,
        name: "מדריך ללא הרשאה",
        email: "denied.e2e@example.test",
        role: "COUNSELOR",
      },
    }),
  ]);

  await Promise.all([
    prisma.rolePermission.create({
      data: {
        institutionId: institution.id,
        role: "ADMIN",
        action: "VIEW_REPORTS",
        allowed: true,
      },
    }),
    prisma.rolePermission.create({
      data: {
        institutionId: institution.id,
        role: "COUNSELOR",
        action: "VIEW_REPORTS",
        allowed: false,
      },
    }),
  ]);

  const stageProgram = await prisma.stageProgram.create({
    data: { institutionId: institution.id, name: "תכנית בדיקות" },
  });
  const version = await prisma.stageProgramVersion.create({
    data: {
      stageProgramId: stageProgram.id,
      versionNumber: 1,
      requiredMeasurementDays: 14,
    },
  });
  const stage = await prisma.stage.create({
    data: { stageProgramVersionId: version.id, order: 1, name: "כניסה" },
  });
  const [routineParameter, responsibilityParameter] = await Promise.all([
    prisma.parameterDefinition.create({
      data: {
        stageProgramVersionId: version.id,
        name: "עמידה בשגרה",
        weightPercent: 40,
      },
    }),
    prisma.parameterDefinition.create({
      data: {
        stageProgramVersionId: version.id,
        name: "אחריות אישית",
        weightPercent: 60,
      },
    }),
  ]);
  const trainee = await prisma.trainee.create({
    data: {
      institutionId: institution.id,
      groupId: group.id,
      firstName: "דנה",
      lastName: "כהן",
      currentStageId: stage.id,
    },
  });

  await Promise.all([
    prisma.scoreEntry.create({
      data: {
        traineeId: trainee.id,
        parameterDefinitionId: routineParameter.id,
        measurementDate: toDateOnly(new Date()),
        status: "SCORED",
        rawScore: 8,
        recordedById: admin.id,
      },
    }),
    prisma.scoreEntry.create({
      data: {
        traineeId: trainee.id,
        parameterDefinitionId: responsibilityParameter.id,
        measurementDate: toDateOnly(new Date()),
        status: "NOT_SCORED",
        recordedById: admin.id,
      },
    }),
  ]);

  return Response.json({
    adminEmail: admin.email,
    deniedEmail: deniedStaff.email,
    groupId: group.id,
    foreignGroupId: foreignGroup.id,
    traineeId: trainee.id,
  });
}
