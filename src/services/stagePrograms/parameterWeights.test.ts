import { describe, expect, it } from "vitest";
import { assertParameterWeightTotals, validateParameterWeightTotals } from "./parameterWeights";

describe("parameter weight validation", () => {
  it("accepts all-stage parameters whose weights sum to 100", () => {
    expect(
      validateParameterWeightTotals([
        { weightPercent: 40 },
        { weightPercent: 30 },
        { weightPercent: 30 },
      ]),
    ).toEqual([]);
  });

  it("validates each stage-specific parameter set independently", () => {
    expect(
      validateParameterWeightTotals([
        { stageId: "stage-a", weightPercent: 60 },
        { stageId: "stage-a", weightPercent: 40 },
        { stageId: "stage-b", weightPercent: 20 },
        { stageId: "stage-b", weightPercent: 80 },
      ]),
    ).toEqual([]);
  });

  it("reports the exact parameter scope that does not sum to 100", () => {
    const issues = validateParameterWeightTotals([
      { stageId: "stage-a", weightPercent: 50 },
      { stageId: "stage-a", weightPercent: 25 },
      { stageId: "stage-b", weightPercent: 100 },
    ]);

    expect(issues).toEqual([
      {
        stageId: "stage-a",
        totalWeightPercent: 75,
        message: "Parameter weights for stage stage-a must sum to 100, got 75",
      },
    ]);
  });

  it("keeps all-stage and stage-specific parameter scopes separate", () => {
    expect(
      validateParameterWeightTotals([
        { weightPercent: 100 },
        { stageId: "stage-a", weightPercent: 100 },
      ]),
    ).toEqual([]);
  });

  it("throws a combined error for invalid totals", () => {
    expect(() =>
      assertParameterWeightTotals([
        { weightPercent: 80 },
        { stageId: "stage-a", weightPercent: 110 },
      ]),
    ).toThrow(
      "Parameter weights for all-stage parameters must sum to 100, got 80; Parameter weights for stage stage-a must sum to 100, got 110",
    );
  });
});
