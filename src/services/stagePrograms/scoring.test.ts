import { describe, expect, it } from "vitest";
import { calculateStageScore } from "./scoring";

describe("calculateStageScore", () => {
  it("computes weight × rawScore/10 for fully scored parameters", () => {
    const result = calculateStageScore([
      { weightPercent: 30, status: "SCORED", rawScore: 10 },
      { weightPercent: 70, status: "SCORED", rawScore: 5 },
    ]);
    // 30*10/10 + 70*5/10 = 30 + 35 = 65, over full 100 weight
    expect(result.totalScore).toBeCloseTo(65);
    expect(result.includedWeightPercent).toBe(100);
    expect(result.excludedWeightPercent).toBe(0);
  });

  it("counts NOT_SCORED as 0 but keeps its weight in the base", () => {
    const result = calculateStageScore([
      { weightPercent: 40, status: "SCORED", rawScore: 8 },
      { weightPercent: 60, status: "NOT_SCORED" },
    ]);
    // earned = 40*8/10 = 32, included weight = 100 (both count) -> 32/100*100 = 32
    expect(result.totalScore).toBeCloseTo(32);
    expect(result.includedWeightPercent).toBe(100);
  });

  it("removes NOT_APPLICABLE parameters from the 100% base instead of penalizing", () => {
    const result = calculateStageScore([
      { weightPercent: 40, status: "SCORED", rawScore: 8 },
      { weightPercent: 30, status: "NOT_SCORED" },
      { weightPercent: 30, status: "NOT_APPLICABLE" },
    ]);
    // earned = 32, included weight = 70 (30 excluded) -> 32/70*100
    expect(result.totalScore).toBeCloseTo((32 / 70) * 100, 5);
    expect(result.includedWeightPercent).toBe(70);
    expect(result.excludedWeightPercent).toBe(30);
  });

  it("throws if a SCORED parameter is missing rawScore or out of the 1-10 range", () => {
    expect(() => calculateStageScore([{ weightPercent: 100, status: "SCORED", rawScore: null }])).toThrow();
    expect(() => calculateStageScore([{ weightPercent: 100, status: "SCORED", rawScore: 0 }])).toThrow();
    expect(() => calculateStageScore([{ weightPercent: 100, status: "SCORED", rawScore: 11 }])).toThrow();
  });

  it("returns 0 when every parameter is NOT_APPLICABLE (nothing left in the base)", () => {
    const result = calculateStageScore([{ weightPercent: 100, status: "NOT_APPLICABLE" }]);
    expect(result.totalScore).toBe(0);
    expect(result.includedWeightPercent).toBe(0);
  });
});
