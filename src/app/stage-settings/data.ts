import { prisma } from "@/lib/prisma";
import { getPrimaryStageProgramVersion } from "@/repositories/stageProgramRepository";
import type { ConfigurationStatus, ScoreScale } from "@/generated/prisma/enums";

export interface StageSettingsStage {
  id: string;
  name: string;
  order: number;
}

export interface StageSettingsSourceParameter {
  id: string;
  stageId: string | null;
  name: string;
  verbalDefinition: string | null;
  scoreScale: ScoreScale;
  weightPercent: number;
  active: boolean;
  displayOrder: number | null;
}

export interface StageSettingsProfileParameter {
  id: string;
  sourceParameterDefinitionId: string | null;
  stageId: string | null;
  name: string | null;
  verbalDefinition: string | null;
  scoreScale: ScoreScale | null;
  weightPercent: number | null;
  active: boolean;
  displayOrder: number | null;
  sourceParameterDefinition: StageSettingsSourceParameter | null;
}

export interface StageSettingsProfile {
  id: string;
  name: string | null;
  status: ConfigurationStatus;
  effectiveFrom: Date | null;
  publishedAt: Date | null;
  updatedAt: Date;
  parameters: StageSettingsProfileParameter[];
}

export interface StageSettingsVersion {
  id: string;
  versionNumber: number;
  requiredMeasurementDays: number;
  stages: StageSettingsStage[];
  parameters: StageSettingsSourceParameter[];
}

export interface InstitutionStageSettingsData {
  version: StageSettingsVersion | null;
  draftProfile: StageSettingsProfile | null;
  publishedProfile: StageSettingsProfile | null;
}

function decimalToNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    return value.toNumber();
  }
  return Number(value);
}

function sortByDisplayOrder<T extends { displayOrder: number | null; name?: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const orderA = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return (a.name ?? "").localeCompare(b.name ?? "", "he");
  });
}

function mapSourceParameter(parameter: {
  id: string;
  stageId: string | null;
  name: string;
  verbalDefinition: string | null;
  scoreScale: ScoreScale;
  weightPercent: unknown;
  active: boolean;
  displayOrder: number | null;
}): StageSettingsSourceParameter {
  return {
    id: parameter.id,
    stageId: parameter.stageId,
    name: parameter.name,
    verbalDefinition: parameter.verbalDefinition,
    scoreScale: parameter.scoreScale,
    weightPercent: decimalToNumber(parameter.weightPercent),
    active: parameter.active,
    displayOrder: parameter.displayOrder,
  };
}

function mapProfile(profile: {
  id: string;
  name: string | null;
  status: ConfigurationStatus;
  effectiveFrom: Date | null;
  publishedAt: Date | null;
  updatedAt: Date;
  parameters: Array<{
    id: string;
    sourceParameterDefinitionId: string | null;
    stageId: string | null;
    name: string | null;
    verbalDefinition: string | null;
    scoreScale: ScoreScale | null;
    weightPercent: unknown;
    active: boolean;
    displayOrder: number | null;
    sourceParameterDefinition: {
      id: string;
      stageId: string | null;
      name: string;
      verbalDefinition: string | null;
      scoreScale: ScoreScale;
      weightPercent: unknown;
      active: boolean;
      displayOrder: number | null;
    } | null;
  }>;
}): StageSettingsProfile {
  return {
    id: profile.id,
    name: profile.name,
    status: profile.status,
    effectiveFrom: profile.effectiveFrom,
    publishedAt: profile.publishedAt,
    updatedAt: profile.updatedAt,
    parameters: sortByDisplayOrder(
      profile.parameters.map((parameter) => ({
        id: parameter.id,
        sourceParameterDefinitionId: parameter.sourceParameterDefinitionId,
        stageId: parameter.stageId,
        name: parameter.name,
        verbalDefinition: parameter.verbalDefinition,
        scoreScale: parameter.scoreScale,
        weightPercent: parameter.weightPercent == null ? null : decimalToNumber(parameter.weightPercent),
        active: parameter.active,
        displayOrder: parameter.displayOrder,
        sourceParameterDefinition: parameter.sourceParameterDefinition
          ? mapSourceParameter(parameter.sourceParameterDefinition)
          : null,
      })),
    ),
  };
}

export async function loadInstitutionStageSettings(
  institutionId: string,
): Promise<InstitutionStageSettingsData> {
  return loadStageSettingsForScope(institutionId, { groupId: null, traineeId: null });
}

async function loadStageSettingsForScope(
  institutionId: string,
  scope: { groupId: string | null; traineeId: string | null },
): Promise<InstitutionStageSettingsData> {
  const version = await getPrimaryStageProgramVersion(institutionId);
  if (!version) {
    return { version: null, draftProfile: null, publishedProfile: null };
  }

  const [draftProfile, publishedProfile] = await Promise.all([
    prisma.scoringProfile.findFirst({
      where: {
        institutionId,
        stageProgramVersionId: version.id,
        groupId: scope.groupId,
        traineeId: scope.traineeId,
        status: "DRAFT",
      },
      include: {
        parameters: {
          include: { sourceParameterDefinition: true },
          orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    }),
    prisma.scoringProfile.findFirst({
      where: {
        institutionId,
        stageProgramVersionId: version.id,
        groupId: scope.groupId,
        traineeId: scope.traineeId,
        status: "PUBLISHED",
        replacedById: null,
      },
      include: {
        parameters: {
          include: { sourceParameterDefinition: true },
          orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        },
      },
      orderBy: [
        { effectiveFrom: "desc" },
        { publishedAt: "desc" },
        { createdAt: "desc" },
      ],
    }),
  ]);

  return {
    version: {
      id: version.id,
      versionNumber: version.versionNumber,
      requiredMeasurementDays: version.requiredMeasurementDays,
      stages: [...version.stages].sort((a, b) => a.order - b.order),
      parameters: sortByDisplayOrder(version.parameters.map(mapSourceParameter)),
    },
    draftProfile: draftProfile ? mapProfile(draftProfile) : null,
    publishedProfile: publishedProfile ? mapProfile(publishedProfile) : null,
  };
}

export async function loadGroupStageSettings(
  institutionId: string,
  groupId: string,
): Promise<InstitutionStageSettingsData> {
  return loadStageSettingsForScope(institutionId, { groupId, traineeId: null });
}

export async function loadTraineeStageSettings(
  institutionId: string,
  traineeId: string,
): Promise<InstitutionStageSettingsData> {
  return loadStageSettingsForScope(institutionId, { groupId: null, traineeId });
}
