import type { ParameterEntryStatus, ScoreScale } from "@/generated/prisma/enums";

export interface ParameterScoreInput {
  weightPercent: number;
  status: ParameterEntryStatus;
  // Required when status is SCORED. Defaults to the legacy 1-10 scale when an
  // older caller has not been wired to per-parameter ScoreScale yet.
  rawScore?: number | null;
  maxRawScore?: number;
}

export interface StageScoreResult {
  // Out of 100. Parameters marked NOT_APPLICABLE are removed from the 100% base
  // entirely (per spec: "מוסר מהחישוב של ה-100%"), so the remaining parameters'
  // earned points are rescaled against their own weight sum — exclusion never
  // lowers a trainee's achievable score.
  totalScore: number;
  includedWeightPercent: number;
  excludedWeightPercent: number;
}

export function maxRawScoreForScale(scale: ScoreScale | null | undefined): number {
  switch (scale) {
    case "ONE_TO_THREE":
      return 3;
    case "ONE_TO_ONE_HUNDRED":
      return 100;
    case "ONE_TO_TEN":
    default:
      return 10;
  }
}

export function calculateStageScore(parameters: ParameterScoreInput[]): StageScoreResult {
  let earnedPoints = 0;
  let includedWeightPercent = 0;
  let excludedWeightPercent = 0;

  for (const parameter of parameters) {
    if (parameter.status === "NOT_APPLICABLE") {
      excludedWeightPercent += parameter.weightPercent;
      continue;
    }

    includedWeightPercent += parameter.weightPercent;

    if (parameter.status === "SCORED") {
      const maxRawScore = parameter.maxRawScore ?? 10;
      if (parameter.rawScore == null || parameter.rawScore < 1 || parameter.rawScore > maxRawScore) {
        throw new Error(`rawScore must be between 1 and ${maxRawScore} when status is SCORED`);
      }
      earnedPoints += (parameter.weightPercent * parameter.rawScore) / maxRawScore;
    }
    // NOT_SCORED: contributes 0 points but its weight stays in includedWeightPercent.
  }

  const totalScore = includedWeightPercent > 0 ? (earnedPoints / includedWeightPercent) * 100 : 0;

  return { totalScore, includedWeightPercent, excludedWeightPercent };
}
