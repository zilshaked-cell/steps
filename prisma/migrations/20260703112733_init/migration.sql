-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('ADMIN', 'LEAD_COORDINATOR', 'COUNSELOR', 'YOUTH_WORKER', 'TRAINEE');

-- CreateEnum
CREATE TYPE "MeasurementMode" AS ENUM ('STANDARD', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PermissionAction" AS ENUM ('VIEW', 'EDIT', 'CHANGE_STAGE', 'VIEW_REPORTS', 'EDIT_SETTINGS', 'MANAGE_PERMISSIONS');

-- CreateEnum
CREATE TYPE "PermissionEffect" AS ENUM ('ALLOW', 'DENY');

-- CreateEnum
CREATE TYPE "ParameterEntryStatus" AS ENUM ('SCORED', 'NOT_SCORED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "StageRecommendation" AS ENUM ('INCREASE', 'MAINTAIN', 'DECREASE');

-- CreateTable
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffUser" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "StaffRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "traineeId" TEXT,

    CONSTRAINT "StaffUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupStaffAssignment" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupStaffAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trainee" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "groupId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "measurementMode" "MeasurementMode" NOT NULL DEFAULT 'STANDARD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentStageId" TEXT,

    CONSTRAINT "Trainee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "action" "PermissionAction" NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermissionOverride" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "action" "PermissionAction" NOT NULL,
    "effect" "PermissionEffect" NOT NULL,
    "groupId" TEXT,
    "traineeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPermissionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageProgram" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageProgramVersion" (
    "id" TEXT NOT NULL,
    "stageProgramId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "measurementMethodNote" TEXT,
    "requiredMeasurementDays" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageProgramVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stage" (
    "id" TEXT NOT NULL,
    "stageProgramVersionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageProvision" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageProvision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParameterDefinition" (
    "id" TEXT NOT NULL,
    "stageProgramVersionId" TEXT NOT NULL,
    "stageId" TEXT,
    "name" TEXT NOT NULL,
    "verbalDefinition" TEXT,
    "weightPercent" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "ParameterDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageThreshold" (
    "id" TEXT NOT NULL,
    "stageProgramVersionId" TEXT NOT NULL,
    "stageId" TEXT,
    "decreaseBelow" DECIMAL(5,2) NOT NULL,
    "increaseAbove" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "StageThreshold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraineeParameterOverride" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "parameterDefinitionId" TEXT NOT NULL,
    "stageId" TEXT,
    "weightPercent" DECIMAL(5,2),
    "verbalDefinition" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TraineeParameterOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraineeThresholdOverride" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "stageId" TEXT,
    "decreaseBelow" DECIMAL(5,2) NOT NULL,
    "increaseAbove" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TraineeThresholdOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreEntry" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "parameterDefinitionId" TEXT NOT NULL,
    "measurementDate" DATE NOT NULL,
    "status" "ParameterEntryStatus" NOT NULL,
    "rawScore" INTEGER,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StagePeriodSnapshot" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "periodEnd" DATE NOT NULL,
    "totalScore" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StagePeriodSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageChangeEvent" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "fromStageId" TEXT,
    "toStageId" TEXT NOT NULL,
    "performedById" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalScoreAtChange" DECIMAL(5,2) NOT NULL,
    "systemRecommendation" "StageRecommendation" NOT NULL,
    "note" TEXT,

    CONSTRAINT "StageChangeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettingsChangeLogEntry" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "change" JSONB NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettingsChangeLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLogEntry" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Group_institutionId_idx" ON "Group"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_email_key" ON "StaffUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_traineeId_key" ON "StaffUser"("traineeId");

-- CreateIndex
CREATE INDEX "StaffUser_institutionId_idx" ON "StaffUser"("institutionId");

-- CreateIndex
CREATE INDEX "GroupStaffAssignment_staffId_idx" ON "GroupStaffAssignment"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupStaffAssignment_groupId_staffId_key" ON "GroupStaffAssignment"("groupId", "staffId");

-- CreateIndex
CREATE INDEX "Trainee_institutionId_idx" ON "Trainee"("institutionId");

-- CreateIndex
CREATE INDEX "Trainee_groupId_idx" ON "Trainee"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_institutionId_role_action_key" ON "RolePermission"("institutionId", "role", "action");

-- CreateIndex
CREATE INDEX "UserPermissionOverride_institutionId_staffId_action_idx" ON "UserPermissionOverride"("institutionId", "staffId", "action");

-- CreateIndex
CREATE INDEX "StageProgram_institutionId_idx" ON "StageProgram"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "StageProgramVersion_stageProgramId_versionNumber_key" ON "StageProgramVersion"("stageProgramId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Stage_stageProgramVersionId_order_key" ON "Stage"("stageProgramVersionId", "order");

-- CreateIndex
CREATE INDEX "ParameterDefinition_stageProgramVersionId_idx" ON "ParameterDefinition"("stageProgramVersionId");

-- CreateIndex
CREATE INDEX "StageThreshold_stageProgramVersionId_idx" ON "StageThreshold"("stageProgramVersionId");

-- CreateIndex
CREATE INDEX "ScoreEntry_traineeId_measurementDate_idx" ON "ScoreEntry"("traineeId", "measurementDate");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreEntry_traineeId_parameterDefinitionId_measurementDate_key" ON "ScoreEntry"("traineeId", "parameterDefinitionId", "measurementDate");

-- CreateIndex
CREATE UNIQUE INDEX "StagePeriodSnapshot_traineeId_periodEnd_key" ON "StagePeriodSnapshot"("traineeId", "periodEnd");

-- CreateIndex
CREATE INDEX "StageChangeEvent_traineeId_performedAt_idx" ON "StageChangeEvent"("traineeId", "performedAt");

-- CreateIndex
CREATE INDEX "SettingsChangeLogEntry_institutionId_entityType_entityId_idx" ON "SettingsChangeLogEntry"("institutionId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLogEntry_institutionId_createdAt_idx" ON "AuditLogEntry"("institutionId", "createdAt");

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffUser" ADD CONSTRAINT "StaffUser_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffUser" ADD CONSTRAINT "StaffUser_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupStaffAssignment" ADD CONSTRAINT "GroupStaffAssignment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupStaffAssignment" ADD CONSTRAINT "GroupStaffAssignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trainee" ADD CONSTRAINT "Trainee_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trainee" ADD CONSTRAINT "Trainee_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trainee" ADD CONSTRAINT "Trainee_currentStageId_fkey" FOREIGN KEY ("currentStageId") REFERENCES "Stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageProgram" ADD CONSTRAINT "StageProgram_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageProgramVersion" ADD CONSTRAINT "StageProgramVersion_stageProgramId_fkey" FOREIGN KEY ("stageProgramId") REFERENCES "StageProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_stageProgramVersionId_fkey" FOREIGN KEY ("stageProgramVersionId") REFERENCES "StageProgramVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageProvision" ADD CONSTRAINT "StageProvision_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParameterDefinition" ADD CONSTRAINT "ParameterDefinition_stageProgramVersionId_fkey" FOREIGN KEY ("stageProgramVersionId") REFERENCES "StageProgramVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageThreshold" ADD CONSTRAINT "StageThreshold_stageProgramVersionId_fkey" FOREIGN KEY ("stageProgramVersionId") REFERENCES "StageProgramVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageThreshold" ADD CONSTRAINT "StageThreshold_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraineeParameterOverride" ADD CONSTRAINT "TraineeParameterOverride_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraineeParameterOverride" ADD CONSTRAINT "TraineeParameterOverride_parameterDefinitionId_fkey" FOREIGN KEY ("parameterDefinitionId") REFERENCES "ParameterDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraineeParameterOverride" ADD CONSTRAINT "TraineeParameterOverride_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraineeThresholdOverride" ADD CONSTRAINT "TraineeThresholdOverride_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraineeThresholdOverride" ADD CONSTRAINT "TraineeThresholdOverride_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreEntry" ADD CONSTRAINT "ScoreEntry_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreEntry" ADD CONSTRAINT "ScoreEntry_parameterDefinitionId_fkey" FOREIGN KEY ("parameterDefinitionId") REFERENCES "ParameterDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreEntry" ADD CONSTRAINT "ScoreEntry_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StagePeriodSnapshot" ADD CONSTRAINT "StagePeriodSnapshot_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StagePeriodSnapshot" ADD CONSTRAINT "StagePeriodSnapshot_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageChangeEvent" ADD CONSTRAINT "StageChangeEvent_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageChangeEvent" ADD CONSTRAINT "StageChangeEvent_toStageId_fkey" FOREIGN KEY ("toStageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageChangeEvent" ADD CONSTRAINT "StageChangeEvent_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettingsChangeLogEntry" ADD CONSTRAINT "SettingsChangeLogEntry_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettingsChangeLogEntry" ADD CONSTRAINT "SettingsChangeLogEntry_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLogEntry" ADD CONSTRAINT "AuditLogEntry_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLogEntry" ADD CONSTRAINT "AuditLogEntry_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
