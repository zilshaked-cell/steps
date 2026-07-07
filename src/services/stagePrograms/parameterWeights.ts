export interface ParameterWeightInput {
  stageId?: string | null;
  weightPercent: number;
}

export interface ParameterWeightValidationIssue {
  stageId: string | null;
  totalWeightPercent: number;
  message: string;
}

const EXPECTED_TOTAL_WEIGHT_PERCENT = 100;
const WEIGHT_TOTAL_EPSILON = 0.000001;

function normalizeStageId(stageId: string | null | undefined): string | null {
  return stageId ?? null;
}

function formatScope(stageId: string | null): string {
  return stageId == null ? "all-stage parameters" : `stage ${stageId}`;
}

export function validateParameterWeightTotals(
  parameters: ParameterWeightInput[],
  stageIds: readonly string[] = [],
): ParameterWeightValidationIssue[] {
  const allStageTotal = parameters.reduce(
    (total, parameter) =>
      normalizeStageId(parameter.stageId) === null ? total + parameter.weightPercent : total,
    0,
  );
  const explicitStageIds = new Set<string>();
  const stageSpecificTotals = new Map<string, number>();

  for (const parameter of parameters) {
    const stageId = normalizeStageId(parameter.stageId);
    if (stageId === null) continue;
    explicitStageIds.add(stageId);
    stageSpecificTotals.set(
      stageId,
      (stageSpecificTotals.get(stageId) ?? 0) + parameter.weightPercent,
    );
  }

  const issues: ParameterWeightValidationIssue[] = [];

  if (explicitStageIds.size === 0) {
    if (Math.abs(allStageTotal - EXPECTED_TOTAL_WEIGHT_PERCENT) > WEIGHT_TOTAL_EPSILON) {
      issues.push({
        stageId: null,
        totalWeightPercent: allStageTotal,
        message: `Parameter weights for ${formatScope(null)} must sum to 100, got ${allStageTotal}`,
      });
    }
    return issues;
  }

  const stageIdsToValidate =
    stageIds.length > 0
      ? [...new Set([...stageIds, ...explicitStageIds])]
      : [...explicitStageIds];
  for (const stageId of stageIdsToValidate) {
    const totalWeightPercent = allStageTotal + (stageSpecificTotals.get(stageId) ?? 0);
    if (Math.abs(totalWeightPercent - EXPECTED_TOTAL_WEIGHT_PERCENT) > WEIGHT_TOTAL_EPSILON) {
      issues.push({
        stageId,
        totalWeightPercent,
        message: `Parameter weights for ${formatScope(stageId)} must sum to 100, got ${totalWeightPercent}`,
      });
    }
  }

  return issues;
}

export function assertParameterWeightTotals(
  parameters: ParameterWeightInput[],
  stageIds: readonly string[] = [],
): void {
  const issues = validateParameterWeightTotals(parameters, stageIds);
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => issue.message).join("; "));
  }
}
