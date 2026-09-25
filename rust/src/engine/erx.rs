use base64::prelude::*;
use rand::Rng;
use regex::Regex;
use sha2::{Digest, Sha512, Sha256};

#[derive(Debug, Clone)]
pub struct DoseSpotSsoCodes {
    pub phrase: String,
    pub single_sign_on_code: String,
    pub single_sign_on_user_id_verify: String,
}

/// Generates 32 random alphanumeric characters matching DoseSpot.Get32CharPhrase() in DoseSpot.cs.
pub fn generate_32char_phrase() -> String {
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let mut rng = rand::thread_rng();
    (0..32)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

/// Creates DoseSpot SingleSignOnCode and SingleSignOnUserIdVerify matching Open Dental's
/// DoseSpot.CreateSsoCode and DoseSpot.CreateSsoUserIdVerify.
pub fn create_dosespot_sso_codes(
    clinic_key: &str,
    user_id: &str,
    predefined_phrase: Option<&str>,
) -> DoseSpotSsoCodes {
    let phrase = predefined_phrase
        .map(|p| p.to_string())
        .unwrap_or_else(generate_32char_phrase);

    // 1. Create SingleSignOnCode:
    // phraseAndKey = phrase + clinicKey;
    // SHA-512 hash -> Base64 -> strip trailing "==" -> phrase + base64
    let phrase_and_key = format!("{}{}", phrase, clinic_key);
    let mut hasher1 = Sha512::new();
    hasher1.update(phrase_and_key.as_bytes());
    let hash1 = hasher1.finalize();
    let base64_1 = BASE64_STANDARD.encode(hash1);
    let trimmed_base64_1 = base64_1.trim_end_matches('=').to_string();
    let single_sign_on_code = format!("{}{}", phrase, trimmed_base64_1);

    // 2. Create SingleSignOnUserIdVerify:
    // idPhraseAndKey = userID + phrase.Substring(0, 22) + clinicKey;
    // SHA-512 hash -> Base64 -> strip trailing "=="
    let phrase_22 = &phrase[..22.min(phrase.len())];
    let id_phrase_and_key = format!("{}{}{}", user_id, phrase_22, clinic_key);
    let mut hasher2 = Sha512::new();
    hasher2.update(id_phrase_and_key.as_bytes());
    let hash2 = hasher2.finalize();
    let base64_2 = BASE64_STANDARD.encode(hash2);
    let single_sign_on_user_id_verify = base64_2.trim_end_matches('=').to_string();

    DoseSpotSsoCodes {
        phrase,
        single_sign_on_code,
        single_sign_on_user_id_verify,
    }
}

/// Validates DEA number format: 2 letters followed by 7 digits.
pub fn is_valid_dea_format(dea: &str) -> bool {
    let re = Regex::new(r"^[A-Za-z]{2}[0-9]{7}$").unwrap();
    re.is_match(dea.trim())
}

/// Validates NPI format: exactly 10 numeric digits.
pub fn is_valid_npi(npi: &str) -> bool {
    let digits: String = npi.chars().filter(|c| c.is_ascii_digit()).collect();
    digits.len() == 10
}

/// Verifies whether a DEA schedule is considered a controlled substance.
pub fn is_controlled_substance(schedule: &str) -> bool {
    matches!(
        schedule.trim(),
        "Schedule II" | "Schedule III" | "Schedule IV" | "Schedule V"
    )
}

/// Generates a tamper-evident digital cryptographic audit signature for EPCS prescriptions.
pub fn sign_epcs_prescription(
    prov_num: i64,
    pat_num: i64,
    drug: &str,
    disp: &str,
    epcs_auth_token: &str,
    timestamp: &str,
) -> String {
    let payload = format!("{}:{}:{}:{}:{}:{}", prov_num, pat_num, drug, disp, epcs_auth_token, timestamp);
    let mut hasher = Sha256::new();
    hasher.update(payload.as_bytes());
    BASE64_STANDARD.encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_32char_phrase() {
        let phrase = generate_32char_phrase();
        assert_eq!(phrase.len(), 32);
        assert!(phrase.chars().all(|c| c.is_ascii_alphanumeric()));
    }

    #[test]
    fn test_dosespot_sso_codes() {
        let clinic_key = "SecretClinicKey123";
        let user_id = "501";
        let fixed_phrase = "12345678901234567890123456789012";

        let codes = create_dosespot_sso_codes(clinic_key, user_id, Some(fixed_phrase));

        assert!(codes.single_sign_on_code.starts_with(fixed_phrase));
        assert!(!codes.single_sign_on_code.ends_with("=="));
        assert!(!codes.single_sign_on_user_id_verify.ends_with("=="));
    }

    #[test]
    fn test_dea_and_npi_validation() {
        assert!(is_valid_dea_format("AB1234567"));
        assert!(!is_valid_dea_format("A1234567")); // Only 1 letter
        assert!(!is_valid_dea_format("AB123456"));  // Only 6 digits

        assert!(is_valid_npi("1234567890"));
        assert!(!is_valid_npi("12345"));
    }

    #[test]
    fn test_epcs_controlled_substance_check() {
        assert!(is_controlled_substance("Schedule II"));
        assert!(is_controlled_substance("Schedule III"));
        assert!(!is_controlled_substance("None"));
    }
}
