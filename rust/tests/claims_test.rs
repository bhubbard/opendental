use opendental::engine::claims::compute_estimates;
use opendental::engine::x12::{generate_edi_837d, DentalClaimInput, DentalClaimService};

#[test]
fn test_claims_compute_estimates_upstream_cases() {
    // Upstream case 1: Standard restorative crown with $50 deductible
    let est1 = compute_estimates(1350.0, 0.50, 50.0, 1500.0);
    assert_eq!(est1.ded_applied, 50.0);
    assert_eq!(est1.ins_pay_est, 650.0);
    assert_eq!(est1.patient_portion, 700.0);

    // Upstream case 2: Preventive 100% with $0 deductible
    let est2 = compute_estimates(105.0, 1.0, 0.0, 1500.0);
    assert_eq!(est2.ded_applied, 0.0);
    assert_eq!(est2.ins_pay_est, 105.0);
    assert_eq!(est2.patient_portion, 0.0);

    // Upstream case 3: Procedure fee exceeding annual max remaining
    let est3 = compute_estimates(800.0, 0.80, 0.0, 300.0);
    assert_eq!(est3.ins_pay_est, 300.0); // Capped at $300
    assert_eq!(est3.patient_portion, 500.0);
}

#[test]
fn test_edi_837d_generation() {
    let claim_input = DentalClaimInput {
        claim_id: 8821,
        date_of_service: "2024-09-24".to_string(),
        total_fee: 1455.0,
        carrier_payer_id: "92011".to_string(),
        billing_provider_npi: "1234567890".to_string(),
        billing_provider_name: "OpenDental Clinic".to_string(),
        subscriber_id: "SUB-1".to_string(),
        subscriber_last: "Doe".to_string(),
        subscriber_first: "Jane".to_string(),
        subscriber_dob: "1988-03-15".to_string(),
        subscriber_gender: "F".to_string(),
        services: vec![
            DentalClaimService {
                line_num: 1,
                procedure_code: "D1110".to_string(),
                fee: 105.0,
                tooth_num: None,
                surface: None,
            },
            DentalClaimService {
                line_num: 2,
                procedure_code: "D2740".to_string(),
                fee: 1350.0,
                tooth_num: Some("19".to_string()),
                surface: None,
            },
        ],
    };

    let edi = generate_edi_837d(&claim_input);

    assert!(edi.contains("ST*837*0001*005010X224A2~"));
    assert!(edi.contains("CLM*8821*1455.00"));
    assert!(edi.contains("SV3*AD:D1110*105.00"));
    assert!(edi.contains("SV3*AD:D2740*1350.00**19*1~"));
}
