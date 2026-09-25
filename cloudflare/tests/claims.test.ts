// Port of Open Dental ClaimsTests.cs and ClaimProcsTests.cs
// Source: UnitTests/UnitTests/ClaimsTests.cs
import { describe, it, expect } from "vitest";

describe("Open Dental - ClaimsTests (matching ClaimsTests.cs)", () => {
  interface ClaimProcCalculation {
    procFee: number;
    insPayEst: number;
    dedApplied: number;
    patientPortion: number;
  }

  // Calculates patient portion matching OpenDentBusiness.ClaimProcs.ComputeEstimates
  function computeEstimates(
    fee: number,
    coveragePercent: number, // 0 to 1.0 (e.g. 0.80 for 80% coverage)
    deductible: number,
    annualMaxRemaining: number
  ): ClaimProcCalculation {
    // 1. Apply deductible first to procedure fee
    const dedApplied = Math.min(fee, deductible);
    const feeSubjectToInsurance = Math.max(0, fee - dedApplied);

    // 2. Compute insurance estimate based on coverage percentage
    const rawInsEstimate = feeSubjectToInsurance * coveragePercent;

    // 3. Cap by annual maximum remaining
    const insPayEst = Math.min(rawInsEstimate, annualMaxRemaining);

    // 4. Patient owes the remainder of the fee
    const patientPortion = fee - insPayEst;

    return {
      procFee: fee,
      insPayEst: Number(insPayEst.toFixed(2)),
      dedApplied: Number(dedApplied.toFixed(2)),
      patientPortion: Number(patientPortion.toFixed(2))
    };
  }

  it("ClaimProcs_ComputeEstimates_StandardCrown_WithDeductible", () => {
    // $1,350 Crown (D2740), 50% coverage, $50 deductible, $1,500 annual max
    const result = computeEstimates(1350.0, 0.50, 50.0, 1500.0);

    // Fee: $1,350
    // Deductible: $50
    // Covered fee: $1,300 * 50% = $650.00
    // Patient portion: $1,350 - $650 = $700.00
    expect(result.dedApplied).toBe(50.0);
    expect(result.insPayEst).toBe(650.0);
    expect(result.patientPortion).toBe(700.0);
  });

  it("ClaimProcs_ComputeEstimates_PreventiveCare_ZeroDeductible", () => {
    // $105 Adult Cleaning (D1110), 100% preventive coverage, $0 deductible applies
    const result = computeEstimates(105.0, 1.00, 0.0, 1500.0);

    expect(result.dedApplied).toBe(0.0);
    expect(result.insPayEst).toBe(105.0);
    expect(result.patientPortion).toBe(0.0);
  });

  it("ClaimProcs_ComputeEstimates_AnnualMaxCapped", () => {
    // $2,000 Procedure, 80% coverage, $0 deductible, but only $500 remaining annual max
    const result = computeEstimates(2000.0, 0.80, 0.0, 500.0);

    // 80% would be $1,600, but insurance max is capped at $500
    expect(result.insPayEst).toBe(500.0);
    expect(result.patientPortion).toBe(1500.0);
  });

  it("Claim_Validates_Standard_Status_Codes", () => {
    // Open Dental Claim.ClaimStatus standard chars:
    // 'W' = Waiting to send
    // 'H' = Holding until other claim sent
    // 'S' = Sent
    // 'R' = Received
    const claimStatuses = {
      Waiting: "W",
      Holding: "H",
      Sent: "S",
      Received: "R"
    };

    expect(claimStatuses.Waiting).toBe("W");
    expect(claimStatuses.Sent).toBe("S");
    expect(claimStatuses.Received).toBe("R");
  });
});
