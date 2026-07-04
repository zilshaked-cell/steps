export interface DataSufficiencyInput {
  measurementDaysIncluded: number;
  measurementDaysRequired: number;
  parametersIncluded: number;
  parametersExpected: number;
}

export interface DataSufficiencyResult extends DataSufficiencyInput {
  isSufficient: boolean;
}

// Sufficiency is judged by measurement days alone, per spec — parameter counts
// are surfaced in the result for transparency in the report's warning banner,
// not used as part of the sufficiency test itself.
export function checkDataSufficiency(input: DataSufficiencyInput): DataSufficiencyResult {
  return {
    ...input,
    isSufficient: input.measurementDaysIncluded >= input.measurementDaysRequired,
  };
}
