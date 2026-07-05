import { describe, expect, it } from "vitest";
import { checkDataSufficiency } from "./dataSufficiency";

describe("checkDataSufficiency", () => {
  it("is sufficient once measurement days meet the requirement, regardless of parameter coverage", () => {
    const result = checkDataSufficiency({
      measurementDaysIncluded: 14,
      measurementDaysRequired: 14,
      parametersIncluded: 1,
      parametersExpected: 3,
    });
    expect(result.isSufficient).toBe(true);
  });

  it("is insufficient when measurement days fall short", () => {
    const result = checkDataSufficiency({
      measurementDaysIncluded: 13,
      measurementDaysRequired: 14,
      parametersIncluded: 3,
      parametersExpected: 3,
    });
    expect(result.isSufficient).toBe(false);
  });

  it("passes through the raw counts unchanged for the warning banner", () => {
    const result = checkDataSufficiency({
      measurementDaysIncluded: 1,
      measurementDaysRequired: 14,
      parametersIncluded: 3,
      parametersExpected: 3,
    });
    expect(result).toMatchObject({
      measurementDaysIncluded: 1,
      measurementDaysRequired: 14,
      parametersIncluded: 3,
      parametersExpected: 3,
    });
  });
});
