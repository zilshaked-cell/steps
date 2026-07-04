import type { StageRecommendation } from "@/generated/prisma/enums";

export interface StageThresholdConfig {
  decreaseBelow: number;
  increaseAbove: number;
}

/**
 * Deliberately not implemented yet.
 *
 * The exact boundary semantics were explicitly left open during specification
 * (not to be assumed by whoever writes this code):
 *   - what happens when totalScore is exactly equal to a threshold
 *   - whether "above increaseAbove" is inclusive or exclusive of that value
 *   - whether there's a "needs review" band between decreaseBelow and increaseAbove
 *
 * Wire the real comparison up once those are answered. Until then this throws
 * rather than silently picking an interpretation.
 */
export function determineStageRecommendation(
  _totalScore: number,
  _thresholds: StageThresholdConfig,
): StageRecommendation {
  throw new Error(
    "determineStageRecommendation is not implemented: threshold boundary semantics (inclusive/exclusive, exact-match, possible middle band) are an open product question.",
  );
}
