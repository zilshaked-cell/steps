import { prisma } from "@/lib/prisma";
import { validateParameterWeightTotals } from "@/services/stagePrograms/parameterWeights";
import { resolvePermission, type PermissionSubject } from "@/services/permissions/resolvePermission";
import type { Prisma } from "@/generated/prisma/client";
import type { ScoreScale } from "@/generated/prisma/enums";

export type StageSettingsMutationErrorCode =
  | "ACTOR_OUT_OF_SCOPE"
  | "FORBIDDEN"
  | "GROUP_NOT_FOUND"
  | "PARAMETER_INVALID"
  | "PARAMETER_OUT_OF_SCOPE"
  | "PROFILE_NOT_DRAFT"
  | "PROFILE_NOT_FOUND"
  | "STAGE_PROGRAM_VERSION_NOT_FOUND"
  | "TRAINEE_NOT_FOUND"
  | "WEIGHTS_UNBALANCED";

export class StageSettingsMutationError extends Error {
  constructor(
    readonly code: StageSettingsMutationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "StageSettingsMutationError";
  }
}

export interface InstitutionScoringProfileParameterInput {
  sourceParameterDefinitionId?: string | null;
  stageId?: string | null;
  name: string;
  verbalDefinition?: string | null;
  scoreScale: ScoreScale;
  weightPercent: number;
  active?: boolean;
  displayOrder?: number | null;
}

export interface LocalScoringProfileParameterInput {
  sourceParameterDefinitionId?: string | null;
  stageId?: string | null;
  name?: string | null;
  verbalDefinition?: string | null;
  scoreScale?: ScoreScale | null;
  weightPercent?: number | null;
  active?: boolean;
  displayOrder?: number | null;
}

export interface SaveInstitutionScoringProfileDraftInput {
  actor: PermissionSubject;
  institutionId: string;
  stageProgramVersionId: string;
  profileId?: string;
  name?: string | null;
  parameters: InstitutionScoringProfileParameterInput[];
}

export interface PublishInstitutionScoringProfileInput {
  actor: PermissionSubject;
  institutionId: string;
  profileId: string;
  effectiveFrom?: Date;
}

export interface SaveGroupScoringProfileDraftInput {
  actor: PermissionSubject;
  institutionId: string;
  groupId: string;
  stageProgramVersionId: string;
  profileId?: string;
  name?: string | null;
  parameters: LocalScoringProfileParameterInput[];
}

export interface PublishGroupScoringProfileInput {
  actor: PermissionSubject;
  institutionId: string;
  groupId: string;
  profileId: string;
  effectiveFrom?: Date;
}

export interface SaveTraineeScoringProfileDraftInput {
  actor: PermissionSubject;
  institutionId: string;
  traineeId: string;
  stageProgramVersionId: string;
  profileId?: string;
  name?: string | null;
  parameters: LocalScoringProfileParameterInput[];
}

export interface PublishTraineeScoringProfileInput {
  actor: PermissionSubject;
  institutionId: string;
  traineeId: string;
  profileId: string;
  effectiveFrom?: Date;
}

interface NormalizedProfileParameter {
  sourceParameterDefinitionId: string | null;
  stageId: string | null;
  name: string;
  verbalDefinition: string | null;
  scoreScale: ScoreScale;
  weightPercent: number;
  active: boolean;
  displayOrder: number | null;
}

interface NormalizedLocalProfileParameter {
  sourceParameterDefinitionId: string | null;
  stageId: string | null;
  name: string | null;
  verbalDefinition: string | null;
  scoreScale: ScoreScale | null;
  weightPercent: number | null;
  active: boolean;
  displayOrder: number | null;
}

interface LocalProfileScope {
  groupId?: string | null;
  traineeId?: string | null;
}

interface SaveLocalProfileDraftOptions extends LocalProfileScope {
  actor: PermissionSubject;
  institutionId: string;
  stageProgramVersionId: string;
  profileId?: string;
  name?: string | null;
  parameters: LocalScoringProfileParameterInput[];
  settingsAction: string;
  auditAction: string;
}

interface PublishLocalProfileOptions extends LocalProfileScope {
  actor: PermissionSubject;
  institutionId: string;
  profileId: string;
  effectiveFrom?: Date;
  settingsAction: string;
  auditAction: string;
}

interface ProfileParameterForEffectiveWeights {
  active: boolean;
  stageId: string | null;
  weightPercent: unknown;
  sourceParameterDefinition?: {
    stageId: string | null;
    weightPercent: unknown;
  } | null;
}

interface ProfileStageProgramVersion {
  stages: { id: string }[];
}

function fail(code: StageSettingsMutationErrorCode, message: string): never {
  throw new StageSettingsMutationError(code, message);
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized : null;
}

function normalizeRequiredText(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!normalized) fail("PARAMETER_INVALID", `${fieldName} cannot be empty.`);
  return normalized;
}

function normalizeWeightPercent(weightPercent: number): number {
  if (!Number.isFinite(weightPercent) || weightPercent < 0 || weightPercent > 100) {
    fail("PARAMETER_INVALID", "Parameter weightPercent must be between 0 and 100.");
  }
  return weightPercent;
}

function normalizeOptionalWeightPercent(weightPercent: number | null | undefined): number | null {
  if (weightPercent === null || weightPercent === undefined) return null;
  return normalizeWeightPercent(weightPercent);
}

function normalizeDisplayOrder(
  displayOrder: number | null | undefined,
  fallback: number,
): number | null {
  if (displayOrder === null) return null;
  if (displayOrder === undefined) return fallback;
  if (!Number.isInteger(displayOrder) || displayOrder < 0) {
    fail("PARAMETER_INVALID", "Parameter displayOrder must be a non-negative integer.");
  }
  return displayOrder;
}

async function assertCanManageStageSettings(actor: PermissionSubject, institutionId: string) {
  if (actor.institutionId !== institutionId) {
    fail("ACTOR_OUT_OF_SCOPE", "Actor does not belong to the target institution.");
  }

  const allowed = await resolvePermission(actor, "MANAGE_STAGE_SETTINGS");
  if (!allowed) fail("FORBIDDEN", "Actor is not allowed to manage stage settings.");
}

async function assertGroupInInstitution(groupId: string, institutionId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { institutionId: true },
  });
  if (!group || group.institutionId !== institutionId) {
    fail("GROUP_NOT_FOUND", "Group does not exist in the target institution.");
  }
}

async function getTraineeInInstitution(traineeId: string, institutionId: string) {
  const trainee = await prisma.trainee.findUnique({
    where: { id: traineeId },
    select: { institutionId: true, groupId: true },
  });
  if (!trainee || trainee.institutionId !== institutionId) {
    fail("TRAINEE_NOT_FOUND", "Trainee does not exist in the target institution.");
  }
  return trainee;
}

async function assertCanManageGroupSettings(
  actor: PermissionSubject,
  institutionId: string,
  groupId: string,
) {
  if (actor.institutionId !== institutionId) {
    fail("ACTOR_OUT_OF_SCOPE", "Actor does not belong to the target institution.");
  }

  const allowed = await resolvePermission(actor, "MANAGE_GROUP_SETTINGS", { groupId });
  if (!allowed) fail("FORBIDDEN", "Actor is not allowed to manage group settings.");
}

async function assertCanManageTraineeSettings(
  actor: PermissionSubject,
  institutionId: string,
  traineeId: string,
  groupId: string | null,
) {
  if (actor.institutionId !== institutionId) {
    fail("ACTOR_OUT_OF_SCOPE", "Actor does not belong to the target institution.");
  }

  const allowed = await resolvePermission(actor, "MANAGE_TRAINEE_SETTINGS", {
    traineeId,
    ...(groupId ? { groupId } : {}),
  });
  if (!allowed) fail("FORBIDDEN", "Actor is not allowed to manage trainee settings.");
}

async function getStageProgramVersionContext(stageProgramVersionId: string, institutionId: string) {
  const version = await prisma.stageProgramVersion.findUnique({
    where: { id: stageProgramVersionId },
    select: {
      id: true,
      stageProgram: { select: { institutionId: true } },
      stages: { select: { id: true } },
      parameters: { select: { id: true } },
    },
  });

  if (!version || version.stageProgram.institutionId !== institutionId) {
    fail(
      "STAGE_PROGRAM_VERSION_NOT_FOUND",
      "Stage program version does not exist in the target institution.",
    );
  }

  return {
    stageIds: new Set(version.stages.map((stage) => stage.id)),
    sourceParameterIds: new Set(version.parameters.map((parameter) => parameter.id)),
  };
}

function normalizeParameters(
  parameters: InstitutionScoringProfileParameterInput[],
  context: { stageIds: Set<string>; sourceParameterIds: Set<string> },
): NormalizedProfileParameter[] {
  if (parameters.length === 0) {
    fail("PARAMETER_INVALID", "At least one parameter is required.");
  }

  return parameters.map((parameter, index) => {
    const sourceParameterDefinitionId = parameter.sourceParameterDefinitionId ?? null;
    const stageId = parameter.stageId ?? null;

    if (
      sourceParameterDefinitionId &&
      !context.sourceParameterIds.has(sourceParameterDefinitionId)
    ) {
      fail("PARAMETER_OUT_OF_SCOPE", "Source parameter must belong to the profile version.");
    }
    if (stageId && !context.stageIds.has(stageId)) {
      fail("PARAMETER_OUT_OF_SCOPE", "Stage must belong to the profile version.");
    }

    return {
      sourceParameterDefinitionId,
      stageId,
      name: normalizeRequiredText(parameter.name, "Parameter name"),
      verbalDefinition: normalizeOptionalText(parameter.verbalDefinition),
      scoreScale: parameter.scoreScale,
      weightPercent: normalizeWeightPercent(parameter.weightPercent),
      active: parameter.active ?? true,
      displayOrder: normalizeDisplayOrder(parameter.displayOrder, index + 1),
    };
  });
}

function normalizeLocalParameters(
  parameters: LocalScoringProfileParameterInput[],
  context: { stageIds: Set<string>; sourceParameterIds: Set<string> },
): NormalizedLocalProfileParameter[] {
  if (parameters.length === 0) {
    fail("PARAMETER_INVALID", "At least one parameter is required.");
  }

  return parameters.map((parameter, index) => {
    const sourceParameterDefinitionId = parameter.sourceParameterDefinitionId ?? null;
    const stageId = parameter.stageId ?? null;

    if (
      sourceParameterDefinitionId &&
      !context.sourceParameterIds.has(sourceParameterDefinitionId)
    ) {
      fail("PARAMETER_OUT_OF_SCOPE", "Source parameter must belong to the profile version.");
    }
    if (stageId && !context.stageIds.has(stageId)) {
      fail("PARAMETER_OUT_OF_SCOPE", "Stage must belong to the profile version.");
    }

    const name = normalizeOptionalText(parameter.name);
    const scoreScale = parameter.scoreScale ?? null;
    const weightPercent = normalizeOptionalWeightPercent(parameter.weightPercent);

    if (!sourceParameterDefinitionId && !name) {
      fail("PARAMETER_INVALID", "Custom local parameters must have a name.");
    }
    if (!sourceParameterDefinitionId && !scoreScale) {
      fail("PARAMETER_INVALID", "Custom local parameters must have a score scale.");
    }
    if (!sourceParameterDefinitionId && weightPercent === null) {
      fail("PARAMETER_INVALID", "Custom local parameters must have a weight.");
    }

    return {
      sourceParameterDefinitionId,
      stageId,
      name,
      verbalDefinition: normalizeOptionalText(parameter.verbalDefinition),
      scoreScale,
      weightPercent,
      active: parameter.active ?? true,
      displayOrder: normalizeDisplayOrder(parameter.displayOrder, index + 1),
    };
  });
}

async function assertDraftProfileForUpdate(
  profileId: string,
  institutionId: string,
  stageProgramVersionId: string,
) {
  const profile = await prisma.scoringProfile.findUnique({
    where: { id: profileId },
    select: {
      institutionId: true,
      groupId: true,
      traineeId: true,
      stageProgramVersionId: true,
      status: true,
    },
  });

  if (
    !profile ||
    profile.institutionId !== institutionId ||
    profile.groupId ||
    profile.traineeId ||
    profile.stageProgramVersionId !== stageProgramVersionId
  ) {
    fail("PROFILE_NOT_FOUND", "Institution scoring profile draft was not found.");
  }
  if (profile.status !== "DRAFT") {
    fail("PROFILE_NOT_DRAFT", "Only draft scoring profiles can be edited.");
  }
}

async function assertDraftProfileForScopedUpdate(
  profileId: string,
  institutionId: string,
  stageProgramVersionId: string,
  scope: LocalProfileScope,
) {
  const profile = await prisma.scoringProfile.findUnique({
    where: { id: profileId },
    select: {
      institutionId: true,
      groupId: true,
      traineeId: true,
      stageProgramVersionId: true,
      status: true,
    },
  });

  if (
    !profile ||
    profile.institutionId !== institutionId ||
    profile.groupId !== (scope.groupId ?? null) ||
    profile.traineeId !== (scope.traineeId ?? null) ||
    profile.stageProgramVersionId !== stageProgramVersionId
  ) {
    fail("PROFILE_NOT_FOUND", "Local scoring profile draft was not found.");
  }
  if (profile.status !== "DRAFT") {
    fail("PROFILE_NOT_DRAFT", "Only draft scoring profiles can be edited.");
  }
}

function effectiveWeightInputs(parameters: ProfileParameterForEffectiveWeights[]) {
  const activeParameters = parameters.filter((parameter) => parameter.active);
  if (activeParameters.length === 0) {
    fail("WEIGHTS_UNBALANCED", "At least one active parameter is required before publishing.");
  }

  return activeParameters.map((parameter) => {
    const weightPercent =
      parameter.weightPercent ?? parameter.sourceParameterDefinition?.weightPercent;
    if (weightPercent === null || weightPercent === undefined) {
      fail("PARAMETER_INVALID", "Active parameters must have an effective weight before publishing.");
    }

    return {
      stageId: parameter.stageId ?? parameter.sourceParameterDefinition?.stageId ?? null,
      weightPercent: Number(weightPercent),
    };
  });
}

function stageIdsForWeightValidation(
  stageProgramVersion: ProfileStageProgramVersion | null,
): string[] {
  if (!stageProgramVersion) {
    fail(
      "STAGE_PROGRAM_VERSION_NOT_FOUND",
      "Scoring profile is not pinned to a stage program version.",
    );
  }
  return stageProgramVersion.stages.map((stage) => stage.id);
}

function assertEffectiveProfileWeights(
  parameters: ProfileParameterForEffectiveWeights[],
  stageProgramVersion: ProfileStageProgramVersion | null,
) {
  const weightIssues = validateParameterWeightTotals(
    effectiveWeightInputs(parameters),
    stageIdsForWeightValidation(stageProgramVersion),
  );
  if (weightIssues.length > 0) {
    fail("WEIGHTS_UNBALANCED", weightIssues.map((issue) => issue.message).join("; "));
  }
}

function settingsChange(action: string, metadata: Prisma.InputJsonObject): Prisma.InputJsonValue {
  return { action, ...metadata };
}

export async function saveInstitutionScoringProfileDraft(
  input: SaveInstitutionScoringProfileDraftInput,
) {
  await assertCanManageStageSettings(input.actor, input.institutionId);
  const context = await getStageProgramVersionContext(
    input.stageProgramVersionId,
    input.institutionId,
  );
  const parameters = normalizeParameters(input.parameters, context);

  if (input.profileId) {
    await assertDraftProfileForUpdate(
      input.profileId,
      input.institutionId,
      input.stageProgramVersionId,
    );
  }

  return prisma.$transaction(async (tx) => {
    const profile = input.profileId
      ? await tx.scoringProfile.update({
          where: { id: input.profileId },
          data: input.name === undefined ? {} : { name: normalizeOptionalText(input.name) },
        })
      : await tx.scoringProfile.create({
          data: {
            institutionId: input.institutionId,
            stageProgramVersionId: input.stageProgramVersionId,
            name: normalizeOptionalText(input.name),
            status: "DRAFT",
            createdById: input.actor.id,
          },
        });

    await tx.scoringProfileParameter.deleteMany({ where: { scoringProfileId: profile.id } });
    await tx.scoringProfileParameter.createMany({
      data: parameters.map((parameter) => ({
        ...parameter,
        scoringProfileId: profile.id,
      })),
    });

    await tx.settingsChangeLogEntry.create({
      data: {
        institutionId: input.institutionId,
        changedById: input.actor.id,
        entityType: "ScoringProfile",
        entityId: profile.id,
        change: settingsChange("DRAFT_SAVE", {
          parameterCount: parameters.length,
          activeParameterCount: parameters.filter((parameter) => parameter.active).length,
        }),
      },
    });
    await tx.auditLogEntry.create({
      data: {
        institutionId: input.institutionId,
        actorId: input.actor.id,
        action: "STAGE_SETTINGS.SCORING_PROFILE_DRAFT_SAVE",
        metadata: { scoringProfileId: profile.id },
      },
    });

    return tx.scoringProfile.findUniqueOrThrow({
      where: { id: profile.id },
      include: { parameters: { orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }] } },
    });
  });
}

export async function publishInstitutionScoringProfile(
  input: PublishInstitutionScoringProfileInput,
) {
  await assertCanManageStageSettings(input.actor, input.institutionId);

  const profile = await prisma.scoringProfile.findUnique({
    where: { id: input.profileId },
    include: {
      parameters: true,
      stageProgramVersion: { select: { stages: { select: { id: true } } } },
    },
  });
  if (
    !profile ||
    profile.institutionId !== input.institutionId ||
    profile.groupId ||
    profile.traineeId
  ) {
    fail("PROFILE_NOT_FOUND", "Institution scoring profile draft was not found.");
  }
  if (profile.status !== "DRAFT") {
    fail("PROFILE_NOT_DRAFT", "Only draft scoring profiles can be published.");
  }

  const activeParameters = profile.parameters.filter((parameter) => parameter.active);
  if (activeParameters.length === 0) {
    fail("WEIGHTS_UNBALANCED", "At least one active parameter is required before publishing.");
  }

  assertEffectiveProfileWeights(profile.parameters, profile.stageProgramVersion);

  const effectiveFrom = input.effectiveFrom ?? new Date();
  return prisma.$transaction(async (tx) => {
    const published = await tx.scoringProfile.update({
      where: { id: input.profileId },
      data: {
        status: "PUBLISHED",
        effectiveFrom,
        publishedById: input.actor.id,
        publishedAt: new Date(),
      },
      include: { parameters: { orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }] } },
    });

    await tx.settingsChangeLogEntry.create({
      data: {
        institutionId: input.institutionId,
        changedById: input.actor.id,
        entityType: "ScoringProfile",
        entityId: published.id,
        change: settingsChange("PUBLISH", {
          activeParameterCount: activeParameters.length,
          effectiveFrom: effectiveFrom.toISOString(),
        }),
      },
    });
    await tx.auditLogEntry.create({
      data: {
        institutionId: input.institutionId,
        actorId: input.actor.id,
        action: "STAGE_SETTINGS.SCORING_PROFILE_PUBLISH",
        metadata: { scoringProfileId: published.id },
      },
    });

    return published;
  });
}

async function saveLocalScoringProfileDraft(options: SaveLocalProfileDraftOptions) {
  const context = await getStageProgramVersionContext(
    options.stageProgramVersionId,
    options.institutionId,
  );
  const parameters = normalizeLocalParameters(options.parameters, context);

  if (options.profileId) {
    await assertDraftProfileForScopedUpdate(
      options.profileId,
      options.institutionId,
      options.stageProgramVersionId,
      options,
    );
  }

  return prisma.$transaction(async (tx) => {
    const profile = options.profileId
      ? await tx.scoringProfile.update({
          where: { id: options.profileId },
          data: options.name === undefined ? {} : { name: normalizeOptionalText(options.name) },
        })
      : await tx.scoringProfile.create({
          data: {
            institutionId: options.institutionId,
            groupId: options.groupId ?? null,
            traineeId: options.traineeId ?? null,
            stageProgramVersionId: options.stageProgramVersionId,
            name: normalizeOptionalText(options.name),
            status: "DRAFT",
            createdById: options.actor.id,
          },
        });

    await tx.scoringProfileParameter.deleteMany({ where: { scoringProfileId: profile.id } });
    await tx.scoringProfileParameter.createMany({
      data: parameters.map((parameter) => ({
        ...parameter,
        scoringProfileId: profile.id,
      })),
    });

    await tx.settingsChangeLogEntry.create({
      data: {
        institutionId: options.institutionId,
        changedById: options.actor.id,
        entityType: "ScoringProfile",
        entityId: profile.id,
        change: settingsChange(options.settingsAction, {
          groupId: options.groupId ?? null,
          traineeId: options.traineeId ?? null,
          parameterCount: parameters.length,
          inheritedFieldCount: parameters.reduce(
            (count, parameter) =>
              count +
              Number(parameter.name === null) +
              Number(parameter.scoreScale === null) +
              Number(parameter.weightPercent === null),
            0,
          ),
        }),
      },
    });
    await tx.auditLogEntry.create({
      data: {
        institutionId: options.institutionId,
        actorId: options.actor.id,
        action: options.auditAction,
        metadata: {
          scoringProfileId: profile.id,
          groupId: options.groupId ?? null,
          traineeId: options.traineeId ?? null,
        },
      },
    });

    return tx.scoringProfile.findUniqueOrThrow({
      where: { id: profile.id },
      include: { parameters: { orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }] } },
    });
  });
}

async function publishLocalScoringProfile(options: PublishLocalProfileOptions) {
  const profile = await prisma.scoringProfile.findUnique({
    where: { id: options.profileId },
    include: {
      parameters: {
        include: {
          sourceParameterDefinition: { select: { stageId: true, weightPercent: true } },
        },
      },
      stageProgramVersion: { select: { stages: { select: { id: true } } } },
    },
  });

  if (
    !profile ||
    profile.institutionId !== options.institutionId ||
    profile.groupId !== (options.groupId ?? null) ||
    profile.traineeId !== (options.traineeId ?? null)
  ) {
    fail("PROFILE_NOT_FOUND", "Local scoring profile draft was not found.");
  }
  if (profile.status !== "DRAFT") {
    fail("PROFILE_NOT_DRAFT", "Only draft scoring profiles can be published.");
  }

  assertEffectiveProfileWeights(profile.parameters, profile.stageProgramVersion);

  const effectiveFrom = options.effectiveFrom ?? new Date();
  return prisma.$transaction(async (tx) => {
    const published = await tx.scoringProfile.update({
      where: { id: options.profileId },
      data: {
        status: "PUBLISHED",
        effectiveFrom,
        publishedById: options.actor.id,
        publishedAt: new Date(),
      },
      include: { parameters: { orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }] } },
    });

    await tx.settingsChangeLogEntry.create({
      data: {
        institutionId: options.institutionId,
        changedById: options.actor.id,
        entityType: "ScoringProfile",
        entityId: published.id,
        change: settingsChange(options.settingsAction, {
          groupId: options.groupId ?? null,
          traineeId: options.traineeId ?? null,
          effectiveFrom: effectiveFrom.toISOString(),
        }),
      },
    });
    await tx.auditLogEntry.create({
      data: {
        institutionId: options.institutionId,
        actorId: options.actor.id,
        action: options.auditAction,
        metadata: {
          scoringProfileId: published.id,
          groupId: options.groupId ?? null,
          traineeId: options.traineeId ?? null,
        },
      },
    });

    return published;
  });
}

export async function saveGroupScoringProfileDraft(input: SaveGroupScoringProfileDraftInput) {
  await assertGroupInInstitution(input.groupId, input.institutionId);
  await assertCanManageGroupSettings(input.actor, input.institutionId, input.groupId);

  return saveLocalScoringProfileDraft({
    ...input,
    traineeId: null,
    settingsAction: "GROUP_DRAFT_SAVE",
    auditAction: "STAGE_SETTINGS.GROUP_SCORING_PROFILE_DRAFT_SAVE",
  });
}

export async function publishGroupScoringProfile(input: PublishGroupScoringProfileInput) {
  await assertGroupInInstitution(input.groupId, input.institutionId);
  await assertCanManageGroupSettings(input.actor, input.institutionId, input.groupId);

  return publishLocalScoringProfile({
    ...input,
    traineeId: null,
    settingsAction: "GROUP_PUBLISH",
    auditAction: "STAGE_SETTINGS.GROUP_SCORING_PROFILE_PUBLISH",
  });
}

export async function saveTraineeScoringProfileDraft(input: SaveTraineeScoringProfileDraftInput) {
  const trainee = await getTraineeInInstitution(input.traineeId, input.institutionId);
  await assertCanManageTraineeSettings(
    input.actor,
    input.institutionId,
    input.traineeId,
    trainee.groupId,
  );

  return saveLocalScoringProfileDraft({
    ...input,
    groupId: null,
    settingsAction: "TRAINEE_DRAFT_SAVE",
    auditAction: "STAGE_SETTINGS.TRAINEE_SCORING_PROFILE_DRAFT_SAVE",
  });
}

export async function publishTraineeScoringProfile(input: PublishTraineeScoringProfileInput) {
  const trainee = await getTraineeInInstitution(input.traineeId, input.institutionId);
  await assertCanManageTraineeSettings(
    input.actor,
    input.institutionId,
    input.traineeId,
    trainee.groupId,
  );

  return publishLocalScoringProfile({
    ...input,
    groupId: null,
    settingsAction: "TRAINEE_PUBLISH",
    auditAction: "STAGE_SETTINGS.TRAINEE_SCORING_PROFILE_PUBLISH",
  });
}
