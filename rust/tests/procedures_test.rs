use opendental::models::ProcedureLog;
use opendental::PracticeRepository;

#[test]
fn test_procedure_treatment_plan_and_completion() {
    let repo = PracticeRepository::new();

    // 1. Insert Treatment Planned procedure (Crown D2740)
    let proc_tp = ProcedureLog {
        proc_num: 0,
        pat_num: 1,
        apt_num: None,
        code_num: 14,
        proc_date: "2024-09-24".to_string(),
        proc_fee: 1350.0,
        surf: None,
        tooth_num: Some("19".to_string()),
        priority: Some(1),
        proc_status: 1, // Treatment Plan
        prov_num: 1,
        clinic_num: Some(1),
        billing_note: Some("Porcelain/ceramic crown".to_string()),
    };

    let p1 = repo.insert_procedure(proc_tp);
    assert_eq!(p1.proc_num, 1);
    assert_eq!(p1.proc_status, 1);

    // 2. Insert Completed procedure (Cleaning D1110)
    let proc_comp = ProcedureLog {
        proc_num: 0,
        pat_num: 1,
        apt_num: Some(1),
        code_num: 2,
        proc_date: "2024-09-24".to_string(),
        proc_fee: 105.0,
        surf: None,
        tooth_num: None,
        priority: None,
        proc_status: 2, // Complete
        prov_num: 1,
        clinic_num: Some(1),
        billing_note: None,
    };

    let p2 = repo.insert_procedure(proc_comp);
    assert_eq!(p2.proc_num, 2);
    assert_eq!(p2.proc_status, 2);

    // 3. Query all procedures for Patient 1
    let list = repo.get_procedures_by_patient(1);
    assert_eq!(list.len(), 2);
}
