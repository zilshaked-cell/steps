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
): ParameterWeightValidationIssue[] {
  const totalsByStageId = new Map<string | null, number>();

  for (const parameter of parameters) {
    const stageId = normalizeStageId(parameter.stageId);
    totalsByStageId.set(stageId, (totalsByStageId.get(stageId) ?? 0) + parameter.weightPercent);
  }

  const issues: ParameterWeightValidationIssue[] = [];

  for (const [stageId, totalWeightPercent] of totalsByStageId) {
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

export function assertParameterWeightTotals(parameters: ParameterWeightInput[]): void {
  const issues = validateParameterWeightTotals(parameters);
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => issue.message).join("; "));
  }
}
