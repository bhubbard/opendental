use sha2::{Digest, Sha256};

#[derive(Debug, Clone, PartialEq)]
pub struct SplitAllocation {
    pub proc_num: i64,
    pub split_amt: f64,
    pub unearned: bool,
    pub security_hash: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct LedgerSummary {
    pub total_billed: f64,
    pub total_insurance_paid: f64,
    pub total_write_off: f64,
    pub total_patient_paid: f64,
    pub unearned_prepayment_balance: f64,
    pub patient_balance_due: f64,
}

/// Computes the tamper-evident SHA-256 hash for a PaySplit (ported from OpenDentBusiness.PaySplit.cs).
/// Salted SHA-256 hash of PatNum, SplitAmt, DateEntry.
pub fn compute_paysplit_security_hash(
    pat_num: i64,
    split_amt: f64,
    date_entry: &str,
    salt: &str,
) -> String {
    let data = format!("{}:{:.2}:{}:{}", pat_num, split_amt, date_entry, salt);
    let mut hasher = Sha256::new();
    hasher.update(data.as_bytes());
    let result = hasher.finalize();
    hex::encode(result)
}

/// Automatically distributes an incoming patient payment across unpaid completed procedures.
/// Any excess payment is marked as unearned prepayment (proc_num = 0, unearned = true).
pub fn distribute_payment_to_procedures(
    pat_num: i64,
    payment_amt: f64,
    procedures: &[(i64, f64, f64)], // (ProcNum, ProcFee, PaidAmtSoFar)
    date_entry: &str,
    salt: &str,
) -> Vec<SplitAllocation> {
    let mut remaining = payment_amt;
    let mut allocations = Vec::new();

    for &(proc_num, fee, paid_so_far) in procedures {
        let balance_on_proc = (fee - paid_so_far).max(0.0);
        if balance_on_proc > 0.0 && remaining > 0.001 {
            let split_amt = remaining.min(balance_on_proc);
            let split_hash = compute_paysplit_security_hash(pat_num, split_amt, date_entry, salt);

            allocations.push(SplitAllocation {
                proc_num,
                split_amt: round_currency(split_amt),
                unearned: false,
                security_hash: split_hash,
            });

            remaining -= split_amt;
        }
    }

    // Allocate excess payment as unearned prepayment
    if remaining > 0.001 {
        let unearned_hash = compute_paysplit_security_hash(pat_num, remaining, date_entry, salt);
        allocations.push(SplitAllocation {
            proc_num: 0,
            split_amt: round_currency(remaining),
            unearned: true,
            security_hash: unearned_hash,
        });
    }

    allocations
}

/// Calculates patient ledger totals and net balance due.
pub fn calculate_ledger_summary(
    billed_procedures: &[f64],
    insurance_paid: &[f64],
    insurance_write_offs: &[f64],
    patient_splits: &[(f64, bool)], // (SplitAmt, is_unearned)
) -> LedgerSummary {
    let total_billed: f64 = billed_procedures.iter().sum();
    let total_ins_paid: f64 = insurance_paid.iter().sum();
    let total_write_off: f64 = insurance_write_offs.iter().sum();

    let mut total_patient_paid = 0.0;
    let mut unearned_balance = 0.0;

    for &(amt, is_unearned) in patient_splits {
        total_patient_paid += amt;
        if is_unearned {
            unearned_balance += amt;
        }
    }

    let patient_earned_paid = total_patient_paid - unearned_balance;
    let balance_due = (total_billed - total_ins_paid - total_write_off - patient_earned_paid).max(0.0);

    LedgerSummary {
        total_billed: round_currency(total_billed),
        total_insurance_paid: round_currency(total_ins_paid),
        total_write_off: round_currency(total_write_off),
        total_patient_paid: round_currency(total_patient_paid),
        unearned_prepayment_balance: round_currency(unearned_balance),
        patient_balance_due: round_currency(balance_due),
    }
}

fn round_currency(val: f64) -> f64 {
    (val * 100.0).round() / 100.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_paysplit_security_hash_deterministic() {
        let hash1 = compute_paysplit_security_hash(1, 250.0, "2024-09-24T12:00:00Z", "SecretSalt");
        let hash2 = compute_paysplit_security_hash(1, 250.0, "2024-09-24T12:00:00Z", "SecretSalt");
        assert_eq!(hash1, hash2);
        assert_eq!(hash1.len(), 64);
    }

    #[test]
    fn test_paysplit_distribution_exact_and_unearned() {
        let procs = vec![
            (101, 150.0, 0.0), // $150 balance
            (102, 300.0, 0.0), // $300 balance
        ];

        // Patient pays $500 total ($150 to 101, $300 to 102, $50 unearned)
        let splits = distribute_payment_to_procedures(
            1,
            500.0,
            &procs,
            "2024-09-24T12:00:00Z",
            "Salt",
        );

        assert_eq!(splits.len(), 3);
        assert_eq!(splits[0].proc_num, 101);
        assert_eq!(splits[0].split_amt, 150.0);
        assert!(!splits[0].unearned);

        assert_eq!(splits[1].proc_num, 102);
        assert_eq!(splits[1].split_amt, 300.0);
        assert!(!splits[1].unearned);

        assert_eq!(splits[2].proc_num, 0);
        assert_eq!(splits[2].split_amt, 50.0);
        assert!(splits[2].unearned);
    }

    #[test]
    fn test_ledger_summary_calculation() {
        let billed = vec![1350.0]; // Crown
        let ins_paid = vec![650.0];
        let write_offs = vec![0.0];
        let patient_splits = vec![(450.0, false)]; // $450 paid

        let summary = calculate_ledger_summary(&billed, &ins_paid, &write_offs, &patient_splits);

        assert_eq!(summary.total_billed, 1350.0);
        assert_eq!(summary.total_insurance_paid, 650.0);
        assert_eq!(summary.total_patient_paid, 450.0);
        assert_eq!(summary.patient_balance_due, 250.0); // 1350 - 650 - 450 = 250
    }
}
