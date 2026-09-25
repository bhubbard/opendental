use opendental::engine::security::{compute_security_log_hash, verify_security_log_hash, PermType};

#[test]
fn test_hipaa_tamper_evident_security_log() {
    let now = "2024-09-24T12:00:00Z";
    let pat_num = 1;
    let log_text = "Patient chart reviewed and updated";

    // 1. Generate hash
    let hash = compute_security_log_hash(PermType::PatientEdit as i32, 1, now, log_text, pat_num);
    assert!(!hash.is_empty());

    // 2. Verify unchanged entry
    assert!(verify_security_log_hash(
        &hash,
        PermType::PatientEdit as i32,
        1,
        now,
        log_text,
        pat_num
    ));

    // 3. Verify that modifying the log text fails validation
    assert!(!verify_security_log_hash(
        &hash,
        PermType::PatientEdit as i32,
        1,
        now,
        "Patient chart reviewed and updated (ALTERED)",
        pat_num
    ));

    // 4. Verify that modifying the patient id fails validation
    assert!(!verify_security_log_hash(
        &hash,
        PermType::PatientEdit as i32,
        1,
        now,
        log_text,
        2 // Altered PatNum
    ));
}
