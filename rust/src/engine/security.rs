use base64::prelude::*;
use sha2::{Digest, Sha256};

/// PermType enum matching OpenDentBusiness.Permissions
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PermType {
    AppointmentCreate = 1,
    AppointmentEdit = 2,
    AppointmentMove = 3,
    PatientCreate = 4,
    PatientEdit = 5,
    ProcComplete = 6,
    SecurityAdmin = 7,
    PaymentCreate = 8,
    InsPayCreate = 9,
    RxCreate = 10,
    RadiographCapture = 11,
    SheetEdit = 12,
    HL7Audit = 13,
}

/// Computes the tamper-evident HIPAA SHA-256 base64 hash matching OpenDentBusiness.SecurityLogHash.
/// Formula: SHA256(PermType + UserNum + LogDateTime + LogText + PatNum) -> Base64
pub fn compute_security_log_hash(
    perm_type: i32,
    user_num: i64,
    log_date_time: &str,
    log_text: &str,
    pat_num: i64,
) -> String {
    let raw = format!("{}{}{}{}{}", perm_type, user_num, log_date_time, log_text, pat_num);
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    let result = hasher.finalize();
    BASE64_STANDARD.encode(result)
}

/// Verifies whether an existing security log entry matches its stored hash.
pub fn verify_security_log_hash(
    stored_hash: &str,
    perm_type: i32,
    user_num: i64,
    log_date_time: &str,
    log_text: &str,
    pat_num: i64,
) -> bool {
    let computed = compute_security_log_hash(perm_type, user_num, log_date_time, log_text, pat_num);
    computed == stored_hash
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_security_hash_deterministic() {
        let hash1 = compute_security_log_hash(1, 1, "2024-09-24T12:00:00", "Appointment created", 101);
        let hash2 = compute_security_log_hash(1, 1, "2024-09-24T12:00:00", "Appointment created", 101);

        assert_eq!(hash1, hash2);
        assert!(verify_security_log_hash(&hash1, 1, 1, "2024-09-24T12:00:00", "Appointment created", 101));
    }

    #[test]
    fn test_security_hash_detects_tampering() {
        let original_hash = compute_security_log_hash(1, 1, "2024-09-24T12:00:00", "Appointment created", 101);

        // Tamper with text
        let is_valid = verify_security_log_hash(
            &original_hash,
            1,
            1,
            "2024-09-24T12:00:00",
            "Appointment created - TAMPERED",
            101,
        );
        assert!(!is_valid);
    }
}
