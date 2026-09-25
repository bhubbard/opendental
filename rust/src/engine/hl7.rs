/// Port of OpenDentBusiness.HL7: HL7 v2 ADT / SIU messaging parser and ACK generator.

#[derive(Debug, Clone)]
pub struct ParsedHL7Patient {
    pub pat_num: i64,
    pub last_name: String,
    pub first_name: String,
    pub middle_name: String,
    pub dob: String,
    pub gender: i32, // 1=Male, 2=Female, 0=Unknown
}

#[derive(Debug, Clone)]
pub struct ParsedHL7Message {
    pub msg_type: String,
    pub control_id: String,
    pub patient: ParsedHL7Patient,
    pub apt_num: i64,
}

pub fn parse_hl7_message(raw_hl7: &str) -> Option<ParsedHL7Message> {
    let lines: Vec<&str> = raw_hl7.lines().map(|l| l.trim()).filter(|l| !l.is_empty()).collect();
    if lines.is_empty() {
        return None;
    }

    let mut msg_type = "UNKNOWN".to_string();
    let mut control_id = "MSG_0".to_string();
    let mut pat_num = 0i64;
    let mut last_name = String::new();
    let mut first_name = String::new();
    let mut middle_name = String::new();
    let mut dob = String::new();
    let mut gender = 0i32;
    let mut apt_num = 0i64;

    for line in lines {
        let fields: Vec<&str> = line.split('|').collect();
        if fields.is_empty() {
            continue;
        }

        match fields[0] {
            "MSH" => {
                if fields.len() > 8 {
                    msg_type = fields[8].to_string();
                }
                if fields.len() > 9 {
                    control_id = fields[9].to_string();
                }
            }
            "PID" => {
                // PID|1||PAT123^^^OD||DOE^JOHN^M||19850101|M...
                if fields.len() > 3 {
                    let pat_id_field = fields[3];
                    if let Some(first_sub) = pat_id_field.split('^').next() {
                        let digits: String = first_sub.chars().filter(|c| c.is_ascii_digit()).collect();
                        pat_num = digits.parse().unwrap_or(0);
                    }
                }
                if fields.len() > 5 {
                    let name_subs: Vec<&str> = fields[5].split('^').collect();
                    if !name_subs.is_empty() {
                        last_name = name_subs[0].to_string();
                    }
                    if name_subs.len() > 1 {
                        first_name = name_subs[1].to_string();
                    }
                    if name_subs.len() > 2 {
                        middle_name = name_subs[2].to_string();
                    }
                }
                if fields.len() > 7 {
                    let raw_dob = fields[7];
                    if raw_dob.len() == 8 {
                        dob = format!("{}-{}-{}", &raw_dob[0..4], &raw_dob[4..6], &raw_dob[6..8]);
                    }
                }
                if fields.len() > 8 {
                    gender = match fields[8] {
                        "M" => 1,
                        "F" => 2,
                        _ => 0,
                    };
                }
            }
            "SCH" => {
                // SCH|APT456...
                if fields.len() > 1 {
                    let digits: String = fields[1].chars().filter(|c| c.is_ascii_digit()).collect();
                    apt_num = digits.parse().unwrap_or(0);
                }
            }
            _ => {}
        }
    }

    Some(ParsedHL7Message {
        msg_type,
        control_id,
        patient: ParsedHL7Patient {
            pat_num,
            last_name,
            first_name,
            middle_name,
            dob,
            gender,
        },
        apt_num,
    })
}

pub fn build_hl7_ack(control_id: &str, ack_code: &str, text: &str) -> String {
    let timestamp = chrono::Utc::now().format("%Y%m%d%H%M%S").to_string();
    format!(
        "MSH|^~\\&|OPENDENTAL|CLINIC|SENDER|FACILITY|{}||ACK|{}|P|2.3\r\nMSA|{}|{}|{}\r\n",
        timestamp, control_id, ack_code, control_id, text
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_hl7_adt_message() {
        let raw = "\
MSH|^~\\&|HOSPITAL_EMR|MAIN_CAMPUS|OPENDENTAL|CLINIC_1|20240924103000||ADT^A08|MSG_77812|P|2.3\r\n\
EVN|A08|20240924103000\r\n\
PID|1||90210^^^OD||WILLIAMS^ALICE^M||19900820|F|||742 EVERGREEN TERRACE^^SPRINGFIELD^OR^97477||555-4321\r\n\
PV1|1|O|CLINIC^^1\r\n";

        let parsed = parse_hl7_message(raw).expect("Failed to parse HL7");

        assert_eq!(parsed.msg_type, "ADT^A08");
        assert_eq!(parsed.control_id, "MSG_77812");
        assert_eq!(parsed.patient.pat_num, 90210);
        assert_eq!(parsed.patient.last_name, "WILLIAMS");
        assert_eq!(parsed.patient.first_name, "ALICE");
        assert_eq!(parsed.patient.dob, "1990-08-20");
        assert_eq!(parsed.patient.gender, 2); // Female

        let ack = build_hl7_ack(&parsed.control_id, "AA", "Patient demographic updated");
        assert!(ack.contains("MSA|AA|MSG_77812|Patient demographic updated"));
    }
}
