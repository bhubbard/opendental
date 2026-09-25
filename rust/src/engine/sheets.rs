use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct IntakeFormSubmission {
    pub sheet_type: i32,
    pub pat_num: i64,
    pub description: String,
    pub fields: HashMap<String, String>,
    pub signature_data: Option<String>,
}

impl IntakeFormSubmission {
    pub fn is_signed(&self) -> bool {
        self.signature_data.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false)
    }

    pub fn has_penicillin_allergy(&self) -> bool {
        self.fields
            .get("PenicillinAllergy")
            .map(|val| val.eq_ignore_ascii_case("yes") || val.eq_ignore_ascii_case("true"))
            .unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_intake_form_signature_and_allergy() {
        let mut fields = HashMap::new();
        fields.insert("PenicillinAllergy".to_string(), "Yes".to_string());

        let form = IntakeFormSubmission {
            sheet_type: 1,
            pat_num: 1,
            description: "Medical History".to_string(),
            fields,
            signature_data: Some("data:image/png;base64,iVBORw0KGgoAAAANS...".to_string()),
        };

        assert!(form.is_signed());
        assert!(form.has_penicillin_allergy());
    }
}
