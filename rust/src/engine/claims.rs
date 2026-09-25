/// Port of OpenDentBusiness.ClaimProcs.ComputeEstimates and ClaimsTests.cs.
/// Calculates insurance payment estimate, deductible applied, and patient portion.

#[derive(Debug, Clone, PartialEq)]
pub struct ClaimProcEstimate {
    pub proc_fee: f64,
    pub ins_pay_est: f64,
    pub ded_applied: f64,
    pub patient_portion: f64,
}

pub fn compute_estimates(
    fee: f64,
    coverage_percent: f64, // e.g. 0.80 for 80%
    deductible: f64,
    annual_max_remaining: f64,
) -> ClaimProcEstimate {
    // 1. Deductible is applied first against the procedure fee
    let ded_applied = fee.min(deductible);
    let fee_subject_to_ins = (fee - ded_applied).max(0.0);

    // 2. Compute insurance estimate based on coverage percentage
    let raw_ins_est = fee_subject_to_ins * coverage_percent;

    // 3. Cap by remaining annual insurance maximum
    let ins_pay_est = raw_ins_est.min(annual_max_remaining);

    // 4. Patient owes the remainder of the fee
    let patient_portion = fee - ins_pay_est;

    ClaimProcEstimate {
        proc_fee: round_currency(fee),
        ins_pay_est: round_currency(ins_pay_est),
        ded_applied: round_currency(ded_applied),
        patient_portion: round_currency(patient_portion),
    }
}

fn round_currency(val: f64) -> f64 {
    (val * 100.0).round() / 100.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_standard_crown_with_deductible() {
        // $1,350 Crown (D2740), 50% coverage, $50 deductible, $1,500 annual max
        let est = compute_estimates(1350.0, 0.50, 50.0, 1500.0);

        // Covered fee: ($1350 - $50) * 0.5 = $650.00
        // Patient portion: $1350 - $650 = $700.00
        assert_eq!(est.ded_applied, 50.0);
        assert_eq!(est.ins_pay_est, 650.0);
        assert_eq!(est.patient_portion, 700.0);
    }

    #[test]
    fn test_preventive_cleaning_zero_deductible() {
        // $105 Cleaning (D1110), 100% coverage, $0 deductible
        let est = compute_estimates(105.0, 1.00, 0.0, 1500.0);

        assert_eq!(est.ded_applied, 0.0);
        assert_eq!(est.ins_pay_est, 105.0);
        assert_eq!(est.patient_portion, 0.0);
    }

    #[test]
    fn test_annual_maximum_cap() {
        // $2,000 Procedure, 80% coverage ($1,600 est), but only $500 remaining on annual max
        let est = compute_estimates(2000.0, 0.80, 0.0, 500.0);

        assert_eq!(est.ins_pay_est, 500.0);
        assert_eq!(est.patient_portion, 1500.0);
    }
}
