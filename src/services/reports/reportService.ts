import { prisma } from "@/lib/prisma";
import { toDateOnly } from "@/lib/dateOnly";
import type { ParameterEntryStatus, PermissionAction, ScoreScale } from "@/generated/prisma/enums";
import { getPrimaryStageProgramVersion } from "@/repositories/stageProgramRepository";
import { getTraineeGroupIdAtDate } from "@/repositories/traineeRepository";
import { resolvePermission, type PermissionSubject } from "@/services/permissions/resolvePermission";
import { maxRawScoreForScale } from "@/services/stagePrograms/scoring";
import { isVacationDayForTrainee } from "@/services/vacations/vacationService";

export type ReportMutationErrorCode =
  | "ACTOR_OUT_OF_SCOPE"
  | "ENTRY_INVALID"
  | "FORBIDDEN"
  | "GROUP_INACTIVE"
  | "GROUP_NOT_FOUND"
  | "PARAMETER_DUPLICATE"
  | "PARAMETER_OUT_OF_SCOPE"
  | "REPORT_ALREADY_PUBLISHED"
  | "REPORT_CONFLICT"
  | "REPORT_NOT_FOUND"
  | "SCORE_OUT_OF_RANGE"
  | "STAGE_PROGRAM_VERSION_NOT_FOUND"
  | "TRAINEE_INACTIVE"
  | "TRAINEE_NOT_FOUND";

export class ReportMutationError extends Error {
  constructor(
    readonly code: ReportMutationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ReportMutationError";
  }
}

export interface ReportEntryInput {
  parameterDefinitionId?: string | null;
  scoringProfileParameterId?: string | null;
  status: ParameterEntryStatus;
  rawScore?: number | null;
}

export interface SaveTraineeReportDraftInput {
  actor: PermissionSubject;
  institutionId: string;
  traineeId: string;
  measurementDate: Date;
  note?: string | null;
  entries: ReportEntryInput[];
}

export type PublishTraineeReportInput = SaveTraineeReportDraftInput;

export interface ReportFormParameter {
  key: string;
  parameterDefinitionId: string | null;
  scoringProfileParameterId: string | null;
  name: string;
  scoreScale: ScoreScale;
  maxRawScore: number;
  status: ParameterEntryStatus;
  rawScore: number | null;
}

export interface TraineeReportFormData {
  traineeId: string;
  groupId: string;
  measurementDate: Date;
  stageProgramVersionId: string;
  scoringProfileId: string | null;
  isVacationDay: boolean;
  existingReport: {
    id: string;
    status: "DRAFT" | "PUBLISHED";
    note: string | null;
    isVacationOverride: boolean;
  } | null;
  parameters: ReportFormParameter[];
}

interface ReportParameter {
  key: string;
  parameterDefinitionId: string | null;
  scoringProfileParameterId: string | null;
  sourceParameterDefinitionId: string | null;
  name: string;
  scoreScale: ScoreScale;
}

interface NormalizedReportEntry {
  parameterDefinitionId: string | null;
  scoringProfileParameterId: string | null;
  sourceParameterDefinitionId: string | null;
  status: ParameterEntryStatus;
  rawScore: number | null;
}

interface ReportContext {
  institutionId: string;
  traineeId: string;
  groupId: string;
  currentStageId: string | null;
  measurementDate: Date;
  stageProgramVersionId: string;
  scoringProfileId: string | null;
  groupActive: boolean;
  traineeActive: boolean;
  parameters: ReportParameter[];
}

function fail(code: ReportMutationErrorCode, message: string): never {
  throw new ReportMutationError(code, message);
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized : null;
}

function appliesToStage(stageId: string | null, currentStageId: string | null): boolean {
  return stageId == null || stageId === currentStageId;
}

function normalizeRawScore(
  status: ParameterEntryStatus,
  rawScore: number | null | undefined,
  scoreScale: ScoreScale,
): number | null {
  if (status !== "SCORED") return null;

  const maxRawScore = maxRawScoreForScale(scoreScale);
  if (rawScore == null || !Number.isInteger(rawScore) || rawScore < 1 || rawScore > maxRawScore) {
    fail(
      "SCORE_OUT_OF_RANGE",
      `Raw score must be an integer between 1 and ${maxRawScore} for this parameter.`,
    );
  }
  return rawScore;
}

async function resolveEffectiveScoringProfile(input: {
  institutionId: string;
  stageProgramVersionId: string;
  traineeId: string;
  groupId: string;
  measurementDate: Date;
}) {
  const baseWhere = {
    institutionId: input.institutionId,
    stageProgramVersionId: input.stageProgramVersionId,
    status: "PUBLISHED" as const,
    replacedById: null,
    OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: input.measurementDate } }],
    AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gte: input.measurementDate } }] }],
  };
  const include = {
    parameters: {
      include: { sourceParameterDefinition: true },
      orderBy: [{ displayOrder: "asc" as const }, { createdAt: "asc" as const }],
    },
  };
  const orderBy = [
    { effectiveFrom: "desc" as const },
    { publishedAt: "desc" as const },
    { createdAt: "desc" as const },
  ];

  return (
    (await prisma.scoringProfile.findFirst({
      where: { ...baseWhere, traineeId: input.traineeId },
      include,
      orderBy,
    })) ??
    (await prisma.scoringProfile.findFirst({
      where: { ...baseWhere, groupId: input.groupId, traineeId: null },
      include,
      orderBy,
    })) ??
    (await prisma.scoringProfile.findFirst({
      where: { ...baseWhere, groupId: null, traineeId: null },
      include,
      orderBy,
    }))
  );
}

async function buildReportContext(input: {
  institutionId: string;
  traineeId: string;
  measurementDate: Date;
  pinnedStageProgramVersionId?: string;
  pinnedScoringProfileId?: string | null;
}): Promise<ReportContext> {
  const measurementDate = toDateOnly(input.measurementDate);
  const trainee = await prisma.trainee.findUnique({
    where: { id: input.traineeId },
    select: {
      id: true,
      institutionId: true,
      groupId: true,
      active: true,
      currentStageId: true,
    },
  });
  if (!trainee || trainee.institutionId !== input.institutionId) {
    fail("TRAINEE_NOT_FOUND", "Trainee does not exist in the target institution.");
  }

  const historicalGroupId =
    (await getTraineeGroupIdAtDate(input.traineeId, measurementDate)) ?? trainee.groupId;
  if (!historicalGroupId) {
    fail("GROUP_NOT_FOUND", "Trainee has no group for the report date.");
  }

  const group = await prisma.group.findUnique({
    where: { id: historicalGroupId },
    select: { institutionId: true, active: true },
  });
  if (!group || group.institutionId !== input.institutionId) {
    fail("GROUP_NOT_FOUND", "Report group does not exist in the target institution.");
  }

  const version = input.pinnedStageProgramVersionId
    ? await prisma.stageProgramVersion.findFirst({
        where: {
          id: input.pinnedStageProgramVersionId,
          stageProgram: { institutionId: input.institutionId },
        },
        include: {
          stages: { orderBy: { order: "asc" }, include: { provisions: true } },
          parameters: true,
          thresholds: true,
        },
      })
    : await getPrimaryStageProgramVersion(input.institutionId);
  if (!version) {
    fail("STAGE_PROGRAM_VERSION_NOT_FOUND", "No stage program is configured for reports.");
  }

  const hasPinnedScoringProfile = Object.prototype.hasOwnProperty.call(
    input,
    "pinnedScoringProfileId",
  );
  const scoringProfile = hasPinnedScoringProfile
    ? input.pinnedScoringProfileId
      ? await prisma.scoringProfile.findFirst({
          where: {
            id: input.pinnedScoringProfileId,
            institutionId: input.institutionId,
            stageProgramVersionId: version.id,
          },
          include: {
            parameters: {
              include: { sourceParameterDefinition: true },
              orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
            },
          },
        })
      : null
    : await resolveEffectiveScoringProfile({
        institutionId: input.institutionId,
        stageProgramVersionId: version.id,
        traineeId: input.traineeId,
        groupId: historicalGroupId,
        measurementDate,
      });
  if (hasPinnedScoringProfile && input.pinnedScoringProfileId && !scoringProfile) {
    fail("REPORT_NOT_FOUND", "Pinned report scoring profile could not be loaded.");
  }

  const parameters: ReportParameter[] = scoringProfile
    ? scoringProfile.parameters
        .filter((parameter) => parameter.active && appliesToStage(parameter.stageId, trainee.currentStageId))
        .map((parameter) => ({
          key: parameter.id,
          parameterDefinitionId: null,
          scoringProfileParameterId: parameter.id,
          sourceParameterDefinitionId: parameter.sourceParameterDefinitionId,
          name: parameter.name ?? parameter.sourceParameterDefinition?.name ?? "Unnamed parameter",
          scoreScale:
            parameter.scoreScale ?? parameter.sourceParameterDefinition?.scoreScale ?? "ONE_TO_TEN",
        }))
    : version.parameters
        .filter(
          (parameter) =>
            parameter.active && appliesToStage(parameter.stageId, trainee.currentStageId),
        )
        .map((parameter) => ({
          key: parameter.id,
          parameterDefinitionId: parameter.id,
          scoringProfileParameterId: null,
          sourceParameterDefinitionId: parameter.id,
          name: parameter.name,
          scoreScale: parameter.scoreScale,
        }));

  return {
    institutionId: input.institutionId,
    traineeId: input.traineeId,
    groupId: historicalGroupId,
    currentStageId: trainee.currentStageId,
    measurementDate,
    stageProgramVersionId: version.id,
    scoringProfileId: scoringProfile?.id ?? null,
    groupActive: group.active,
    traineeActive: trainee.active,
    parameters,
  };
}

function normalizeEntries(input: ReportEntryInput[], context: ReportContext): NormalizedReportEntry[] {
  if (input.length === 0) {
    fail("ENTRY_INVALID", "At least one report entry is required.");
  }

  const byKey = new Map(context.parameters.map((parameter) => [parameter.key, parameter]));
  const bySourceDefinitionId = new Map(
    context.parameters.flatMap((parameter) =>
      parameter.sourceParameterDefinitionId
        ? [[parameter.sourceParameterDefinitionId, parameter] as const]
        : [],
    ),
  );
  const seenKeys = new Set<string>();

  return input.map((entry) => {
    const parameter =
      (entry.scoringProfileParameterId ? byKey.get(entry.scoringProfileParameterId) : undefined) ??
      (entry.parameterDefinitionId ? bySourceDefinitionId.get(entry.parameterDefinitionId) : undefined);
    if (!parameter) {
      fail("PARAMETER_OUT_OF_SCOPE", "Report entry parameter is not active for this trainee.");
    }
    if (seenKeys.has(parameter.key)) {
      fail("PARAMETER_DUPLICATE", "Report entries cannot include the same parameter twice.");
    }
    seenKeys.add(parameter.key);

    return {
      parameterDefinitionId: parameter.parameterDefinitionId,
      scoringProfileParameterId: parameter.scoringProfileParameterId,
      sourceParameterDefinitionId: parameter.sourceParameterDefinitionId,
      status: entry.status,
      rawScore: normalizeRawScore(entry.status, entry.rawScore, parameter.scoreScale),
    };
  });
}

async function assertCanWriteReport(
  actor: PermissionSubject,
  context: ReportContext,
  action: PermissionAction,
) {
  if (actor.institutionId !== context.institutionId) {
    fail("ACTOR_OUT_OF_SCOPE", "Actor does not belong to the target institution.");
  }

  const allowed = await resolvePermission(actor, action, {
    traineeId: context.traineeId,
    groupId: context.groupId,
  });
  if (!allowed) fail("FORBIDDEN", "Actor is not allowed to write this report.");
}

function assertCanOpenReport(context: ReportContext) {
  if (!context.traineeActive) {
    fail("TRAINEE_INACTIVE", "Cannot open a new report for an inactive trainee.");
  }
  if (!context.groupActive) {
    fail("GROUP_INACTIVE", "Cannot open a new report for an inactive group.");
  }
}

async function findExistingReport(context: ReportContext) {
  return prisma.measurementReport.findUnique({
    where: {
      traineeId_measurementDate: {
        traineeId: context.traineeId,
        measurementDate: context.measurementDate,
      },
    },
  });
}

async function findExistingReportForInput(input: {
  institutionId: string;
  traineeId: string;
  measurementDate: Date;
}) {
  const report = await prisma.measurementReport.findUnique({
    where: {
      traineeId_measurementDate: {
        traineeId: input.traineeId,
        measurementDate: toDateOnly(input.measurementDate),
      },
    },
  });
  return report?.institutionId === input.institutionId ? report : null;
}

async function assertDraftDoesNotReplaceVisibleScores(
  context: ReportContext,
  entries: NormalizedReportEntry[],
) {
  const parameterDefinitionIds = entries.flatMap((entry) =>
    entry.parameterDefinitionId ?? entry.sourceParameterDefinitionId
      ? [entry.parameterDefinitionId ?? entry.sourceParameterDefinitionId!]
      : [],
  );
  const scoringProfileParameterIds = entries.flatMap((entry) =>
    entry.scoringProfileParameterId ? [entry.scoringProfileParameterId] : [],
  );
  if (parameterDefinitionIds.length === 0 && scoringProfileParameterIds.length === 0) return;

  const visibleScore = await prisma.scoreEntry.findFirst({
    where: {
      traineeId: context.traineeId,
      measurementDate: context.measurementDate,
      measurementReportId: null,
      OR: [
        ...(parameterDefinitionIds.length > 0
          ? [{ parameterDefinitionId: { in: parameterDefinitionIds } }]
          : []),
        ...(scoringProfileParameterIds.length > 0
          ? [{ scoringProfileParameterId: { in: scoringProfileParameterIds } }]
          : []),
      ],
    },
    select: { id: true },
  });
  if (visibleScore) {
    fail(
      "REPORT_CONFLICT",
      "A visible score entry already exists for this trainee, date, and parameter. Publish a replacement instead of saving a draft.",
    );
  }
}

async function writeReport(input: {
  actor: PermissionSubject;
  context: ReportContext;
  entries: NormalizedReportEntry[];
  note?: string | null;
  status: "DRAFT" | "PUBLISHED";
  auditAction: string;
  existingReport?: {
    id: string;
    status: "DRAFT" | "PUBLISHED";
    stageProgramVersionId: string | null;
    scoringProfileId: string | null;
  } | null;
}) {
  const note = normalizeOptionalText(input.note);
  const now = new Date();
  const isVacationOverride = await isVacationDayForTrainee({
    institutionId: input.context.institutionId,
    traineeId: input.context.traineeId,
    date: input.context.measurementDate,
  });

  return prisma.$transaction(async (tx) => {
    const preservePublishedPins = input.existingReport?.status === "PUBLISHED";
    const stageProgramVersionId = preservePublishedPins && input.existingReport
      ? input.existingReport.stageProgramVersionId
      : input.context.stageProgramVersionId;
    const scoringProfileId = preservePublishedPins && input.existingReport
      ? input.existingReport.scoringProfileId
      : input.context.scoringProfileId;

    const report = input.existingReport
      ? await tx.measurementReport.update({
          where: { id: input.existingReport.id },
          data: {
            groupId: input.context.groupId,
            note,
            status: input.status,
            isVacationOverride,
            stageProgramVersionId,
            scoringProfileId,
            recordedById: input.actor.id,
            ...(input.status === "PUBLISHED"
              ? { publishedById: input.actor.id, publishedAt: now }
              : {}),
          },
        })
      : await tx.measurementReport.create({
          data: {
            institutionId: input.context.institutionId,
            traineeId: input.context.traineeId,
            groupId: input.context.groupId,
            measurementDate: input.context.measurementDate,
            status: input.status,
            note,
            isVacationOverride,
            stageProgramVersionId: input.context.stageProgramVersionId,
            scoringProfileId: input.context.scoringProfileId,
            recordedById: input.actor.id,
            ...(input.status === "PUBLISHED"
              ? { publishedById: input.actor.id, publishedAt: now }
              : {}),
          },
        });

    const parameterDefinitionIds = input.entries.flatMap((entry) =>
      entry.parameterDefinitionId ?? entry.sourceParameterDefinitionId
        ? [entry.parameterDefinitionId ?? entry.sourceParameterDefinitionId!]
        : [],
    );
    const scoringProfileParameterIds = input.entries.flatMap((entry) =>
      entry.scoringProfileParameterId ? [entry.scoringProfileParameterId] : [],
    );

    const replacementConditions =
      input.status === "PUBLISHED"
        ? [
            ...(parameterDefinitionIds.length > 0
              ? [{ parameterDefinitionId: { in: parameterDefinitionIds } }]
              : []),
            ...(scoringProfileParameterIds.length > 0
              ? [{ scoringProfileParameterId: { in: scoringProfileParameterIds } }]
              : []),
          ]
        : [];

    await tx.scoreEntry.deleteMany({
      where: {
        traineeId: input.context.traineeId,
        measurementDate: input.context.measurementDate,
        OR: [
          { measurementReportId: report.id },
          ...replacementConditions,
        ],
      },
    });

    await tx.scoreEntry.createMany({
      data: input.entries.map((entry) => ({
        traineeId: input.context.traineeId,
        parameterDefinitionId: entry.parameterDefinitionId,
        scoringProfileParameterId: entry.scoringProfileParameterId,
        measurementReportId: report.id,
        measurementDate: input.context.measurementDate,
        status: entry.status,
        rawScore: entry.rawScore,
        recordedById: input.actor.id,
      })),
    });

    await tx.auditLogEntry.create({
      data: {
        institutionId: input.context.institutionId,
        actorId: input.actor.id,
        action: input.auditAction,
        metadata: { reportId: report.id, traineeId: input.context.traineeId },
      },
    });

    return tx.measurementReport.findUniqueOrThrow({
      where: { id: report.id },
      include: {
        scoreEntries: {
          orderBy: { createdAt: "asc" },
          include: { parameterDefinition: true, scoringProfileParameter: true },
        },
      },
    });
  });
}

export async function saveTraineeReportDraft(input: SaveTraineeReportDraftInput) {
  const context = await buildReportContext(input);
  const existing = await findExistingReport(context);
  if (existing?.status === "PUBLISHED") {
    fail("REPORT_ALREADY_PUBLISHED", "Published reports must be edited through publish.");
  }
  if (!existing) assertCanOpenReport(context);
  await assertCanWriteReport(input.actor, context, "ENTER_REPORTS");
  const entries = normalizeEntries(input.entries, context);
  if (!existing) await assertDraftDoesNotReplaceVisibleScores(context, entries);

  return writeReport({
    actor: input.actor,
    context,
    entries,
    note: input.note,
    status: "DRAFT",
    auditAction: "REPORT.DRAFT_SAVE",
    existingReport: existing,
  });
}

export async function publishTraineeReport(input: PublishTraineeReportInput) {
  const existing = await findExistingReportForInput(input);
  const context = await buildReportContext({
    ...input,
    ...(existing?.status === "PUBLISHED"
      ? {
          pinnedStageProgramVersionId: existing.stageProgramVersionId ?? undefined,
          pinnedScoringProfileId: existing.scoringProfileId,
        }
      : {}),
  });
  if (!existing) assertCanOpenReport(context);

  await assertCanWriteReport(
    input.actor,
    context,
    existing?.status === "PUBLISHED" ? "EDIT_REPORTS" : "ENTER_REPORTS",
  );

  return writeReport({
    actor: input.actor,
    context,
    entries: normalizeEntries(input.entries, context),
    note: input.note,
    status: "PUBLISHED",
    auditAction: existing?.status === "PUBLISHED" ? "REPORT.PUBLISHED_EDIT" : "REPORT.PUBLISH",
    existingReport: existing,
  });
}

export async function getTraineeReportForDate(input: {
  institutionId: string;
  traineeId: string;
  measurementDate: Date;
}) {
  return prisma.measurementReport.findUnique({
    where: {
      traineeId_measurementDate: {
        traineeId: input.traineeId,
        measurementDate: toDateOnly(input.measurementDate),
      },
    },
    include: {
      scoreEntries: {
        include: { parameterDefinition: true, scoringProfileParameter: true },
      },
    },
  }).then((report) => (report?.institutionId === input.institutionId ? report : null));
}

export async function getTraineeReportFormData(input: {
  institutionId: string;
  traineeId: string;
  measurementDate: Date;
}): Promise<TraineeReportFormData> {
  const measurementDate = toDateOnly(input.measurementDate);
  const existingReport = await prisma.measurementReport.findUnique({
    where: {
      traineeId_measurementDate: {
        traineeId: input.traineeId,
        measurementDate,
      },
    },
    include: { scoreEntries: true },
  });
  if (existingReport && existingReport.institutionId !== input.institutionId) {
    fail("REPORT_NOT_FOUND", "Report does not belong to the target institution.");
  }

  const context = await buildReportContext({
    institutionId: input.institutionId,
    traineeId: input.traineeId,
    measurementDate,
    ...(existingReport?.stageProgramVersionId
      ? { pinnedStageProgramVersionId: existingReport.stageProgramVersionId }
      : {}),
    ...(existingReport
      ? { pinnedScoringProfileId: existingReport.scoringProfileId }
      : {}),
  });
  const entriesByKey = new Map(
    (existingReport?.scoreEntries ?? []).flatMap((entry) => {
      const key = entry.scoringProfileParameterId ?? entry.parameterDefinitionId;
      return key ? [[key, entry] as const] : [];
    }),
  );
  const isVacationDay = await isVacationDayForTrainee({
    institutionId: context.institutionId,
    traineeId: context.traineeId,
    date: context.measurementDate,
  });

  return {
    traineeId: context.traineeId,
    groupId: context.groupId,
    measurementDate: context.measurementDate,
    stageProgramVersionId: context.stageProgramVersionId,
    scoringProfileId: context.scoringProfileId,
    isVacationDay,
    existingReport: existingReport
      ? {
          id: existingReport.id,
          status: existingReport.status,
          note: existingReport.note,
          isVacationOverride: existingReport.isVacationOverride,
        }
      : null,
    parameters: context.parameters.map((parameter) => {
      const entry = entriesByKey.get(parameter.key);
      return {
        key: parameter.key,
        parameterDefinitionId: parameter.parameterDefinitionId,
        scoringProfileParameterId: parameter.scoringProfileParameterId,
        name: parameter.name,
        scoreScale: parameter.scoreScale,
        maxRawScore: maxRawScoreForScale(parameter.scoreScale),
        status: entry?.status ?? "NOT_SCORED",
        rawScore: entry?.rawScore ?? null,
      };
    }),
  };
}
