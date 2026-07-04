import type { ParameterEntryStatus } from "@/generated/prisma/enums";

export interface ParameterScoreInput {
  weightPercent: number;
  status: ParameterEntryStatus;
  // 1–10, required when status is SCORED. Per spec, the 1–10 scale is a user
  // judgment; whether a manual 0 should ever be allowed is an open product
  // question, not decided here — see AGENTS.md-equivalent conversation notes.
  rawScore?: number | null;
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
      if (parameter.rawScore == null || parameter.rawScore < 1 || parameter.rawScore > 10) {
        throw new Error("rawScore must be between 1 and 10 when status is SCORED");
      }
      earnedPoints += (parameter.weightPercent * parameter.rawScore) / 10;
    }
    // NOT_SCORED: contributes 0 points but its weight stays in includedWeightPercent.
  }

  const totalScore = includedWeightPercent > 0 ? (earnedPoints / includedWeightPercent) * 100 : 0;

  return { totalScore, includedWeightPercent, excludedWeightPercent };
}
