-- CreateEnum
CREATE TYPE "ScoreScale" AS ENUM ('ONE_TO_THREE', 'ONE_TO_TEN', 'ONE_TO_ONE_HUNDRED');

-- CreateEnum
CREATE TYPE "ConfigurationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'REPLACED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PermissionAction" ADD VALUE 'MANAGE_GROUPS';
ALTER TYPE "PermissionAction" ADD VALUE 'MANAGE_TRAINEES';
ALTER TYPE "PermissionAction" ADD VALUE 'TRANSFER_TRAINEES';
ALTER TYPE "PermissionAction" ADD VALUE 'ENTER_REPORTS';
ALTER TYPE "PermissionAction" ADD VALUE 'EDIT_REPORTS';
ALTER TYPE "PermissionAction" ADD VALUE 'MANAGE_STAGE_SETTINGS';
ALTER TYPE "PermissionAction" ADD VALUE 'MANAGE_GROUP_SETTINGS';
ALTER TYPE "PermissionAction" ADD VALUE 'MANAGE_TRAINEE_SETTINGS';
ALTER TYPE "PermissionAction" ADD VALUE 'MANAGE_VACATIONS';

-- DropForeignKey
ALTER TABLE "ScoreEntry" DROP CONSTRAINT "ScoreEntry_parameterDefinitionId_fkey";

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ParameterDefinition" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "basedOnParameterDefinitionId" TEXT,
ADD COLUMN     "deactivatedAt" TIMESTAMP(3),
ADD COLUMN     "displayOrder" INTEGER,
ADD COLUMN     "scoreScale" "ScoreScale" NOT NULL DEFAULT 'ONE_TO_TEN';

-- AlterTable
ALTER TABLE "ScoreEntry" ADD COLUMN     "measurementReportId" TEXT,
ADD COLUMN     "scoringProfileParameterId" TEXT,
ALTER COLUMN "parameterDefinitionId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "StageProgramVersion" ADD COLUMN     "effectiveTo" TIMESTAMP(3),
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "replacedAt" TIMESTAMP(3),
ADD COLUMN     "replacedById" TEXT,
ADD COLUMN     "replacedByUserId" TEXT,
ADD COLUMN     "status" "ConfigurationStatus" NOT NULL DEFAULT 'PUBLISHED';

-- CreateTable
CREATE TABLE "ScoringProfile" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "groupId" TEXT,
    "traineeId" TEXT,
    "stageProgramVersionId" TEXT,
    "name" TEXT,
    "status" "ConfigurationStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdById" TEXT,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoringProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringProfileParameter" (
    "id" TEXT NOT NULL,
    "scoringProfileId" TEXT NOT NULL,
    "sourceParameterDefinitionId" TEXT,
    "stageId" TEXT,
    "name" TEXT,
    "verbalDefinition" TEXT,
    "scoreScale" "ScoreScale",
    "weightPercent" DECIMAL(5,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoringProfileParameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeasurementReport" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "groupId" TEXT,
    "measurementDate" DATE NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "isVacationOverride" BOOLEAN NOT NULL DEFAULT false,
    "stageProgramVersionId" TEXT,
    "scoringProfileId" TEXT,
    "recordedById" TEXT NOT NULL,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeasurementReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VacationPeriod" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "groupId" TEXT,
    "traineeId" TEXT,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VacationPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraineeGroupMembershipHistory" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "fromGroupId" TEXT,
    "toGroupId" TEXT,
    "effectiveFrom" DATE NOT NULL,
    "movedById" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TraineeGroupMembershipHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScoringProfile_replacedById_key" ON "ScoringProfile"("replacedById");

-- CreateIndex
CREATE INDEX "ScoringProfile_institutionId_status_effectiveFrom_idx" ON "ScoringProfile"("institutionId", "status", "effectiveFrom");

-- CreateIndex
CREATE INDEX "ScoringProfile_groupId_idx" ON "ScoringProfile"("groupId");

-- CreateIndex
CREATE INDEX "ScoringProfile_traineeId_idx" ON "ScoringProfile"("traineeId");

-- CreateIndex
CREATE INDEX "ScoringProfile_stageProgramVersionId_idx" ON "ScoringProfile"("stageProgramVersionId");

-- CreateIndex
CREATE INDEX "ScoringProfileParameter_scoringProfileId_active_idx" ON "ScoringProfileParameter"("scoringProfileId", "active");

-- CreateIndex
CREATE INDEX "ScoringProfileParameter_sourceParameterDefinitionId_idx" ON "ScoringProfileParameter"("sourceParameterDefinitionId");

-- CreateIndex
CREATE INDEX "ScoringProfileParameter_stageId_idx" ON "ScoringProfileParameter"("stageId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoringProfileParameter_scoringProfileId_sourceParameterDef_key" ON "ScoringProfileParameter"("scoringProfileId", "sourceParameterDefinitionId");

-- CreateIndex
CREATE INDEX "MeasurementReport_institutionId_measurementDate_idx" ON "MeasurementReport"("institutionId", "measurementDate");

-- CreateIndex
CREATE INDEX "MeasurementReport_groupId_measurementDate_idx" ON "MeasurementReport"("groupId", "measurementDate");

-- CreateIndex
CREATE INDEX "MeasurementReport_status_idx" ON "MeasurementReport"("status");

-- CreateIndex
CREATE INDEX "MeasurementReport_stageProgramVersionId_idx" ON "MeasurementReport"("stageProgramVersionId");

-- CreateIndex
CREATE INDEX "MeasurementReport_scoringProfileId_idx" ON "MeasurementReport"("scoringProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "MeasurementReport_traineeId_measurementDate_key" ON "MeasurementReport"("traineeId", "measurementDate");

-- CreateIndex
CREATE INDEX "VacationPeriod_institutionId_startsOn_endsOn_idx" ON "VacationPeriod"("institutionId", "startsOn", "endsOn");

-- CreateIndex
CREATE INDEX "VacationPeriod_groupId_startsOn_endsOn_idx" ON "VacationPeriod"("groupId", "startsOn", "endsOn");

-- CreateIndex
CREATE INDEX "VacationPeriod_traineeId_startsOn_endsOn_idx" ON "VacationPeriod"("traineeId", "startsOn", "endsOn");

-- CreateIndex
CREATE INDEX "TraineeGroupMembershipHistory_institutionId_effectiveFrom_idx" ON "TraineeGroupMembershipHistory"("institutionId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "TraineeGroupMembershipHistory_traineeId_effectiveFrom_idx" ON "TraineeGroupMembershipHistory"("traineeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "TraineeGroupMembershipHistory_fromGroupId_idx" ON "TraineeGroupMembershipHistory"("fromGroupId");

-- CreateIndex
CREATE INDEX "TraineeGroupMembershipHistory_toGroupId_idx" ON "TraineeGroupMembershipHistory"("toGroupId");

-- CreateIndex
CREATE INDEX "Group_institutionId_active_idx" ON "Group"("institutionId", "active");

-- CreateIndex
CREATE INDEX "ParameterDefinition_stageProgramVersionId_active_idx" ON "ParameterDefinition"("stageProgramVersionId", "active");

-- CreateIndex
CREATE INDEX "ParameterDefinition_basedOnParameterDefinitionId_idx" ON "ParameterDefinition"("basedOnParameterDefinitionId");

-- CreateIndex
CREATE INDEX "ScoreEntry_measurementReportId_idx" ON "ScoreEntry"("measurementReportId");

-- CreateIndex
CREATE INDEX "ScoreEntry_scoringProfileParameterId_idx" ON "ScoreEntry"("scoringProfileParameterId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreEntry_traineeId_scoringProfileParameterId_measurementD_key" ON "ScoreEntry"("traineeId", "scoringProfileParameterId", "measurementDate");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreEntry_measurementReportId_parameterDefinitionId_key" ON "ScoreEntry"("measurementReportId", "parameterDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreEntry_measurementReportId_scoringProfileParameterId_key" ON "ScoreEntry"("measurementReportId", "scoringProfileParameterId");

-- CreateIndex
CREATE UNIQUE INDEX "StageProgramVersion_replacedById_key" ON "StageProgramVersion"("replacedById");

-- CreateIndex
CREATE INDEX "StageProgramVersion_stageProgramId_status_effectiveFrom_idx" ON "StageProgramVersion"("stageProgramId", "status", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "StageProgramVersion" ADD CONSTRAINT "StageProgramVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageProgramVersion" ADD CONSTRAINT "StageProgramVersion_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "StageProgramVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageProgramVersion" ADD CONSTRAINT "StageProgramVersion_replacedByUserId_fkey" FOREIGN KEY ("replacedByUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParameterDefinition" ADD CONSTRAINT "ParameterDefinition_basedOnParameterDefinitionId_fkey" FOREIGN KEY ("basedOnParameterDefinitionId") REFERENCES "ParameterDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringProfile" ADD CONSTRAINT "ScoringProfile_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringProfile" ADD CONSTRAINT "ScoringProfile_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringProfile" ADD CONSTRAINT "ScoringProfile_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringProfile" ADD CONSTRAINT "ScoringProfile_stageProgramVersionId_fkey" FOREIGN KEY ("stageProgramVersionId") REFERENCES "StageProgramVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringProfile" ADD CONSTRAINT "ScoringProfile_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringProfile" ADD CONSTRAINT "ScoringProfile_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringProfile" ADD CONSTRAINT "ScoringProfile_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "ScoringProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringProfileParameter" ADD CONSTRAINT "ScoringProfileParameter_scoringProfileId_fkey" FOREIGN KEY ("scoringProfileId") REFERENCES "ScoringProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringProfileParameter" ADD CONSTRAINT "ScoringProfileParameter_sourceParameterDefinitionId_fkey" FOREIGN KEY ("sourceParameterDefinitionId") REFERENCES "ParameterDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringProfileParameter" ADD CONSTRAINT "ScoringProfileParameter_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementReport" ADD CONSTRAINT "MeasurementReport_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementReport" ADD CONSTRAINT "MeasurementReport_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementReport" ADD CONSTRAINT "MeasurementReport_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementReport" ADD CONSTRAINT "MeasurementReport_stageProgramVersionId_fkey" FOREIGN KEY ("stageProgramVersionId") REFERENCES "StageProgramVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementReport" ADD CONSTRAINT "MeasurementReport_scoringProfileId_fkey" FOREIGN KEY ("scoringProfileId") REFERENCES "ScoringProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementReport" ADD CONSTRAINT "MeasurementReport_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementReport" ADD CONSTRAINT "MeasurementReport_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreEntry" ADD CONSTRAINT "ScoreEntry_parameterDefinitionId_fkey" FOREIGN KEY ("parameterDefinitionId") REFERENCES "ParameterDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreEntry" ADD CONSTRAINT "ScoreEntry_scoringProfileParameterId_fkey" FOREIGN KEY ("scoringProfileParameterId") REFERENCES "ScoringProfileParameter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreEntry" ADD CONSTRAINT "ScoreEntry_measurementReportId_fkey" FOREIGN KEY ("measurementReportId") REFERENCES "MeasurementReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacationPeriod" ADD CONSTRAINT "VacationPeriod_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacationPeriod" ADD CONSTRAINT "VacationPeriod_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacationPeriod" ADD CONSTRAINT "VacationPeriod_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacationPeriod" ADD CONSTRAINT "VacationPeriod_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraineeGroupMembershipHistory" ADD CONSTRAINT "TraineeGroupMembershipHistory_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraineeGroupMembershipHistory" ADD CONSTRAINT "TraineeGroupMembershipHistory_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraineeGroupMembershipHistory" ADD CONSTRAINT "TraineeGroupMembershipHistory_fromGroupId_fkey" FOREIGN KEY ("fromGroupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraineeGroupMembershipHistory" ADD CONSTRAINT "TraineeGroupMembershipHistory_toGroupId_fkey" FOREIGN KEY ("toGroupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraineeGroupMembershipHistory" ADD CONSTRAINT "TraineeGroupMembershipHistory_movedById_fkey" FOREIGN KEY ("movedById") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
