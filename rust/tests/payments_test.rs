use opendental::models::ProcedureLog;
use opendental::PracticeRepository;

#[test]
fn test_payment_charge_auto_split_and_ledger() {
    let repo = PracticeRepository::new();

    // 1. Add completed procedure $1,350 for Patient 1
    repo.insert_procedure(ProcedureLog {
        proc_num: 0,
        pat_num: 1,
        apt_num: None,
        code_num: 14,
        proc_date: "2024-09-24".to_string(),
        proc_fee: 1350.0,
        surf: None,
        tooth_num: Some("19".to_string()),
        priority: None,
        proc_status: 2, // Complete
        prov_num: 1,
        clinic_num: Some(1),
        billing_note: None,
    });

    // Initial ledger: Billed $1350, Paid $0, Balance Due $1350
    let l1 = repo.get_patient_ledger(1);
    assert_eq!(l1.total_billed, 1350.0);
    assert_eq!(l1.patient_balance_due, 1350.0);

    // 2. Patient makes EMV payment of $500
    let (pay, splits) = repo.charge_payment_with_auto_split(1, 500.0, "TestSalt");
    assert_eq!(pay.pay_amt, 500.0);
    assert_eq!(splits.len(), 1);
    assert_eq!(splits[0].proc_num, 1);
    assert_eq!(splits[0].split_amt, 500.0);
    assert_eq!(splits[0].unearned_type, 0);

    // Ledger after $500 payment: Balance Due $850
    let l2 = repo.get_patient_ledger(1);
    assert_eq!(l2.total_patient_paid, 500.0);
    assert_eq!(l2.patient_balance_due, 850.0);

    // 3. Patient makes overpayment of $1,000 ($850 completes procedure, $150 goes to unearned prepayment)
    let (_, splits2) = repo.charge_payment_with_auto_split(1, 1000.0, "TestSalt");
    assert_eq!(splits2.len(), 2);
    assert_eq!(splits2[0].proc_num, 1);
    assert_eq!(splits2[0].split_amt, 850.0); // finishes procedure balance
    assert_eq!(splits2[1].proc_num, 0);
    assert_eq!(splits2[1].split_amt, 150.0); // unearned prepayment
    assert_eq!(splits2[1].unearned_type, 1);

    // Ledger after full payment + prepayment: Balance Due $0, Unearned $150
    let l3 = repo.get_patient_ledger(1);
    assert_eq!(l3.total_patient_paid, 1500.0);
    assert_eq!(l3.unearned_prepayment_balance, 150.0);
    assert_eq!(l3.patient_balance_due, 0.0);
}
