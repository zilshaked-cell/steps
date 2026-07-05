import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ACTIONS = [
  "VIEW",
  "EDIT",
  "CHANGE_STAGE",
  "VIEW_REPORTS",
  "EDIT_SETTINGS",
  "MANAGE_PERMISSIONS",
] as const;

async function main() {
  const institution = await prisma.institution.create({
    data: { name: "פנימיית דוגמה" },
  });

  // Default posture per spec: only ADMIN holds permissions until an admin grants more.
  await prisma.rolePermission.createMany({
    data: ACTIONS.map((action) => ({
      institutionId: institution.id,
      role: "ADMIN" as const,
      action,
      allowed: true,
    })),
  });
  await prisma.rolePermission.createMany({
    data: (["LEAD_COORDINATOR", "COUNSELOR", "YOUTH_WORKER"] as const).flatMap((role) =>
      ACTIONS.map((action) => ({
        institutionId: institution.id,
        role,
        action,
        allowed: false,
      })),
    ),
  });

  const [groupA, groupB] = await Promise.all([
    prisma.group.create({ data: { institutionId: institution.id, name: "קבוצה א׳" } }),
    prisma.group.create({ data: { institutionId: institution.id, name: "קבוצה ב׳" } }),
  ]);

  const passwordHash = await bcrypt.hash("dev-password", 10);
  const [admin, lead, counselor] = await Promise.all([
    prisma.staffUser.create({
      data: {
        institutionId: institution.id,
        name: "מנהלת פנימייה",
        email: "admin@example.local",
        passwordHash,
        role: "ADMIN",
      },
    }),
    prisma.staffUser.create({
      data: {
        institutionId: institution.id,
        name: "רכז קבוצה",
        email: "lead@example.local",
        passwordHash,
        role: "LEAD_COORDINATOR",
      },
    }),
    prisma.staffUser.create({
      data: {
        institutionId: institution.id,
        name: "מדריך צוות",
        email: "counselor@example.local",
        passwordHash,
        role: "COUNSELOR",
      },
    }),
  ]);

  await prisma.groupStaffAssignment.createMany({
    data: [
      { groupId: groupA.id, staffId: lead.id },
      { groupId: groupA.id, staffId: counselor.id },
    ],
  });

  const stageProgram = await prisma.stageProgram.create({
    data: { institutionId: institution.id, name: "תכנית שלבים ראשית" },
  });

  const version = await prisma.stageProgramVersion.create({
    data: {
      stageProgramId: stageProgram.id,
      versionNumber: 1,
      measurementMethodNote: "מדידה יומית על ידי הצוות התורן",
      requiredMeasurementDays: 14,
      createdById: admin.id,
    },
  });

  const [stageEntry, stagePartial, stageFull] = await Promise.all([
    prisma.stage.create({ data: { stageProgramVersionId: version.id, order: 1, name: "כניסה" } }),
    prisma.stage.create({
      data: { stageProgramVersionId: version.id, order: 2, name: "עצמאות חלקית" },
    }),
    prisma.stage.create({
      data: { stageProgramVersionId: version.id, order: 3, name: "עצמאות מלאה" },
    }),
  ]);

  await prisma.stageProvision.createMany({
    data: [
      { stageId: stagePartial.id, label: "יציאה עצמאית בשעות היום" },
      { stageId: stageFull.id, label: "יציאה עצמאית בסופ״ש" },
      { stageId: stageFull.id, label: "אחריות על לו״ז אישי" },
    ],
  });

  const [attendance, communication, responsibility] = await Promise.all([
    prisma.parameterDefinition.create({
      data: {
        stageProgramVersionId: version.id,
        name: "עמידה בשגרה",
        verbalDefinition: "הקפדה על שעות היום, נוכחות בפעילויות ומטלות שוטפות",
        weightPercent: 40,
      },
    }),
    prisma.parameterDefinition.create({
      data: {
        stageProgramVersionId: version.id,
        name: "תקשורת בין-אישית",
        verbalDefinition: "אופן התקשורת עם הצוות ועם שאר החניכים",
        weightPercent: 30,
      },
    }),
    prisma.parameterDefinition.create({
      data: {
        stageProgramVersionId: version.id,
        name: "אחריות אישית",
        verbalDefinition: "טיפול בענייניו האישיים ללא תזכורות חוזרות",
        weightPercent: 30,
      },
    }),
  ]);

  await prisma.stageThreshold.create({
    data: {
      stageProgramVersionId: version.id,
      decreaseBelow: 50,
      increaseAbove: 80,
    },
  });

  const [traineeStandard, traineeCustom, traineeOtherGroup] = await Promise.all([
    prisma.trainee.create({
      data: {
        institutionId: institution.id,
        groupId: groupA.id,
        firstName: "דנה",
        lastName: "כהן",
        measurementMode: "STANDARD",
        currentStageId: stageEntry.id,
      },
    }),
    prisma.trainee.create({
      data: {
        institutionId: institution.id,
        groupId: groupA.id,
        firstName: "עומר",
        lastName: "לוי",
        measurementMode: "CUSTOM",
        currentStageId: stagePartial.id,
      },
    }),
    prisma.trainee.create({
      data: {
        institutionId: institution.id,
        groupId: groupB.id,
        firstName: "נועה",
        lastName: "מזרחי",
        measurementMode: "STANDARD",
        currentStageId: stageEntry.id,
      },
    }),
  ]);

  // A few days of example scoring for one trainee, covering SCORED, NOT_SCORED and
  // NOT_APPLICABLE so calculateStageScore() has real data to exercise.
  const today = new Date();
  const daysAgo = (n: number) => new Date(today.getTime() - n * 24 * 60 * 60 * 1000);

  await prisma.scoreEntry.createMany({
    data: [
      {
        traineeId: traineeStandard.id,
        parameterDefinitionId: attendance.id,
        measurementDate: daysAgo(1),
        status: "SCORED",
        rawScore: 8,
        recordedById: counselor.id,
      },
      {
        traineeId: traineeStandard.id,
        parameterDefinitionId: communication.id,
        measurementDate: daysAgo(1),
        status: "NOT_SCORED",
        recordedById: counselor.id,
      },
      {
        traineeId: traineeStandard.id,
        parameterDefinitionId: responsibility.id,
        measurementDate: daysAgo(1),
        status: "NOT_APPLICABLE",
        recordedById: counselor.id,
      },
    ],
  });

  console.log("Seed complete:", {
    institution: institution.name,
    groups: [groupA.name, groupB.name],
    staff: [admin.email, lead.email, counselor.email],
    trainees: [traineeStandard.lastName, traineeCustom.lastName, traineeOtherGroup.lastName],
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
