use opendental::engine::erx::create_dosespot_sso_codes;
use opendental::PracticeRepository;

#[test]
fn test_erx_prescribing_and_dosespot_sso() {
    let repo = PracticeRepository::new();

    // 1. Standard non-controlled antibiotic prescription succeeds without 2FA
    let res_amox = repo.prescribe_medication(
        1,
        1,
        "Amoxicillin 500mg",
        "Take 1 cap PO TID for 7 days",
        "21",
        "None",
        None,
        None,
        Some("1234567890"),
    );
    assert!(res_amox.is_ok());
    let (rx, erx_log) = res_amox.unwrap();
    assert_eq!(rx.drug, "Amoxicillin 500mg");
    assert!(erx_log.is_none());

    // 2. Schedule II Controlled Substance without EPCS 2FA token fails
    let res_fail = repo.prescribe_medication(
        1,
        1,
        "Hydrocodone/APAP 5/325",
        "Take 1 tab q4-6h prn severe pain",
        "12",
        "Schedule II",
        None, // No 2FA token!
        Some("AB1234567"),
        Some("1234567890"),
    );
    assert!(res_fail.is_err());
    assert_eq!(
        res_fail.unwrap_err(),
        "EPCS Two-Factor Authentication token required (DEA § 1311.115)"
    );

    // 3. Schedule II with valid DEA and 2FA token succeeds and logs EPCS cryptographic signature
    let res_success = repo.prescribe_medication(
        1,
        1,
        "Hydrocodone/APAP 5/325",
        "Take 1 tab q4-6h prn severe pain",
        "12",
        "Schedule II",
        Some("982341"), // 6-digit OTP token
        Some("AB1234567"),
        Some("1234567890"),
    );
    assert!(res_success.is_ok());
    let (rx_ctrl, erx_log) = res_success.unwrap();
    assert_eq!(rx_ctrl.drug, "Hydrocodone/APAP 5/325");
    assert!(erx_log.is_some());
    let log = erx_log.unwrap();
    assert_eq!(log.dea_schedule, "Schedule II");
    assert!(!log.epcs_signature.is_empty());

    // 4. DoseSpot SSO generation
    let sso = create_dosespot_sso_codes("TestClinicKey", "User1", None);
    assert_eq!(sso.phrase.len(), 32);
    assert!(!sso.single_sign_on_code.is_empty());
    assert!(!sso.single_sign_on_user_id_verify.is_empty());
}
