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

  it("combines all-stage and stage-specific parameters for the effective stage total", () => {
    expect(
      validateParameterWeightTotals([
        { weightPercent: 100 },
        { stageId: "stage-a", weightPercent: 100 },
      ]),
    ).toEqual([
      {
        stageId: "stage-a",
        totalWeightPercent: 200,
        message: "Parameter weights for stage stage-a must sum to 100, got 200",
      },
    ]);
  });

  it("validates stages without explicit overrides when stage ids are provided", () => {
    expect(
      validateParameterWeightTotals(
        [
          { weightPercent: 80 },
          { stageId: "stage-a", weightPercent: 20 },
        ],
        ["stage-a", "stage-b"],
      ),
    ).toEqual([
      {
        stageId: "stage-b",
        totalWeightPercent: 80,
        message: "Parameter weights for stage stage-b must sum to 100, got 80",
      },
    ]);
  });

  it("throws a combined error for invalid totals", () => {
    expect(() =>
      assertParameterWeightTotals([
        { weightPercent: 80 },
        { stageId: "stage-a", weightPercent: 110 },
      ]),
    ).toThrow("Parameter weights for stage stage-a must sum to 100, got 190");
  });
});
