use serde_json::{json, Value};
use crate::models::Patient;

/// Converts an Open Dental Patient into an ONC compliant FHIR R4 Patient resource.
pub fn patient_to_fhir_r4(patient: &Patient) -> Value {
    let gender_str = match patient.gender {
        1 => "male",
        2 => "female",
        _ => "unknown",
    };

    json!({
        "resourceType": "Patient",
        "id": format!("pat-{}", patient.pat_num),
        "identifier": [
            {
                "use": "usual",
                "system": "http://opendental.com/fhir/patnum",
                "value": patient.pat_num.to_string()
            }
        ],
        "active": patient.pat_status == 0,
        "name": [
            {
                "use": "official",
                "family": patient.l_name,
                "given": [patient.f_name.clone()]
            }
        ],
        "gender": gender_str,
        "birthDate": patient.birthdate,
        "telecom": [
            {
                "system": "phone",
                "value": patient.wireless_phone.clone().unwrap_or_default(),
                "use": "mobile"
            },
            {
                "system": "email",
                "value": patient.email.clone().unwrap_or_default()
            }
        ]
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_patient_to_fhir_r4() {
        let pat = Patient {
            pat_num: 42,
            l_name: "Smith".to_string(),
            f_name: "Jane".to_string(),
            middle_i: None,
            preferred: None,
            pat_status: 0,
            gender: 2, // Female
            birthdate: "1990-01-01".to_string(),
            ssn: None,
            address: None,
            city: None,
            state: None,
            zip: None,
            wireless_phone: Some("555-0199".to_string()),
            email: Some("jane.smith@example.com".to_string()),
            pri_prov: Some(1),
            clinic_num: Some(1),
        };

        let fhir = patient_to_fhir_r4(&pat);

        assert_eq!(fhir["resourceType"], "Patient");
        assert_eq!(fhir["id"], "pat-42");
        assert_eq!(fhir["gender"], "female");
        assert_eq!(fhir["name"][0]["family"], "Smith");
        assert_eq!(fhir["name"][0]["given"][0], "Jane");
    }
}
