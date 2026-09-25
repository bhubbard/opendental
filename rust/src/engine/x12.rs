/// Port of OpenDentBusiness.X12: ANSI ASC X12 837D (Dental Claim) and 835 (Remittance Advice).

#[derive(Debug, Clone)]
pub struct DentalClaimService {
    pub line_num: i32,
    pub procedure_code: String,
    pub fee: f64,
    pub tooth_num: Option<String>,
    pub surface: Option<String>,
}

#[derive(Debug, Clone)]
pub struct DentalClaimInput {
    pub claim_id: i64,
    pub date_of_service: String,
    pub total_fee: f64,
    pub carrier_payer_id: String,
    pub billing_provider_npi: String,
    pub billing_provider_name: String,
    pub subscriber_id: String,
    pub subscriber_last: String,
    pub subscriber_first: String,
    pub subscriber_dob: String,
    pub subscriber_gender: String, // "M" or "F"
    pub services: Vec<DentalClaimService>,
}

#[derive(Debug, Clone)]
pub struct RemittanceClaimLine {
    pub claim_num: i64,
    pub status_code: String,
    pub total_charge: f64,
    pub paid_amount: f64,
    pub patient_responsibility: f64,
    pub write_off: f64,
}

#[derive(Debug, Clone)]
pub struct ParsedEra835 {
    pub payer_name: String,
    pub payer_id: String,
    pub check_or_eft_trace: String,
    pub total_paid: f64,
    pub paid_date: String,
    pub claims: Vec<RemittanceClaimLine>,
}

/// Generates standard ANSI ASC X12 837D Dental Claim file content.
pub fn generate_edi_837d(input: &DentalClaimInput) -> String {
    let mut segments: Vec<String> = Vec::new();

    // ISA / GS Interchange Headers
    let date_str = chrono::Utc::now().format("%y%m%d").to_string();
    let time_str = chrono::Utc::now().format("%H%M").to_string();
    let payer_padded = format!("{:15}", input.carrier_payer_id);

    segments.push(format!(
        "ISA*00*          *00*          *ZZ*SUBMITTER      *ZZ*{}*{}*{}*^*00501*000000001*0*P*:~",
        payer_padded, date_str, time_str
    ));
    segments.push(format!(
        "GS*HC*SUBMITTER*{}*{}*{}*1*X*005010X224A2~",
        input.carrier_payer_id, date_str, time_str
    ));
    segments.push("ST*837*0001*005010X224A2~".to_string());
    segments.push("BHT*0010*00*CLAIM0001*20240924*1000*CH~".to_string());

    // Loop 2000A - Billing Provider
    segments.push("NM1*85*2*OPENDENTAL CLINIC*****XX*1234567890~".to_string());
    segments.push("N3*100 MAIN STREET~".to_string());
    segments.push("N4*SAN FRANCISCO*CA*94102~".to_string());

    // Loop 2000B - Subscriber & Patient
    segments.push("HL*2*1*22*0~".to_string());
    segments.push("SBR*P*18*******CI~".to_string());
    segments.push(format!(
        "NM1*IL*1*{}*{}****MI*{}~",
        input.subscriber_last.to_uppercase(),
        input.subscriber_first.to_uppercase(),
        input.subscriber_id
    ));
    segments.push(format!(
        "DMG*D8*{}*{}~",
        input.subscriber_dob.replace('-', ""),
        input.subscriber_gender
    ));

    // Loop 2300 - Claim Info
    segments.push(format!(
        "CLM*{}*{:.2}***11:B:1*Y*A*Y*Y~",
        input.claim_id, input.total_fee
    ));
    let srv_date = input.date_of_service.replace('-', "");
    segments.push(format!("DTP*472*D8*{}~", srv_date));

    // Loop 2400 - Service Lines
    for svc in &input.services {
        segments.push(format!("LX*{}~", svc.line_num));
        let tooth = svc.tooth_num.as_deref().unwrap_or("");
        segments.push(format!(
            "SV3*AD:{}*{:.2}**{}*1~",
            svc.procedure_code, svc.fee, tooth
        ));
        segments.push(format!("DTP*472*D8*{}~", srv_date));
    }

    // Trailers
    let seg_count = segments.len() + 3;
    segments.push(format!("SE*{}*0001~", seg_count));
    segments.push("GE*1*1~".to_string());
    segments.push("IEA*1*000000001~".to_string());

    segments.join("\r\n")
}

/// Parses ANSI ASC X12 835 Electronic Remittance Advice (ERA) content.
pub fn parse_x12_835(x12_content: &str) -> ParsedEra835 {
    let clean = x12_content.replace(['\r', '\n'], "");
    let segments: Vec<&str> = clean.split('~').map(|s| s.trim()).filter(|s| !s.is_empty()).collect();

    let mut payer_name = "Dental Clearinghouse Payer".to_string();
    let mut payer_id = "PAYER01".to_string();
    let mut check_or_eft_trace = String::new();
    let mut total_paid = 0.0;
    let mut paid_date = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let mut claims = Vec::new();

    for seg in segments {
        let fields: Vec<&str> = seg.split('*').collect();
        if fields.is_empty() {
            continue;
        }

        match fields[0] {
            "BPR" => {
                // BPR*I*1250.00*C*ACH*CTX*...*20240924~
                if fields.len() > 2 {
                    total_paid = fields[2].parse().unwrap_or(0.0);
                }
                if fields.len() > 16 && fields[16].len() == 8 {
                    let d = fields[16];
                    paid_date = format!("{}-{}-{}", &d[0..4], &d[4..6], &d[6..8]);
                }
            }
            "TRN" => {
                // TRN*1*EFT987654321*...~
                if fields.len() > 2 {
                    check_or_eft_trace = fields[2].to_string();
                }
            }
            "N1" => {
                // N1*PR*Delta Dental of California*XX*92011~
                if fields.len() > 2 && fields[1] == "PR" {
                    payer_name = fields[2].to_string();
                    if fields.len() > 4 {
                        payer_id = fields[4].to_string();
                    }
                }
            }
            "CLP" => {
                // CLP*ClaimNum*StatusCode*TotalCharge*PaidAmt*PatientResp*...~
                if fields.len() >= 6 {
                    let claim_num = fields[1].parse().unwrap_or(0);
                    let status_code = fields[2].to_string();
                    let total_charge = fields[3].parse().unwrap_or(0.0);
                    let paid_amount = fields[4].parse().unwrap_or(0.0);
                    let patient_responsibility = fields[5].parse().unwrap_or(0.0);
                    let diff: f64 = total_charge - paid_amount - patient_responsibility;
                    let write_off = diff.max(0.0);

                    if claim_num > 0 {
                        claims.push(RemittanceClaimLine {
                            claim_num,
                            status_code,
                            total_charge,
                            paid_amount,
                            patient_responsibility,
                            write_off,
                        });
                    }
                }
            }
            _ => {}
        }
    }

    ParsedEra835 {
        payer_name,
        payer_id,
        check_or_eft_trace,
        total_paid,
        paid_date,
        claims,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_edi_837d_structure() {
        let input = DentalClaimInput {
            claim_id: 101,
            date_of_service: "2024-09-24".to_string(),
            total_fee: 1350.0,
            carrier_payer_id: "00431".to_string(),
            billing_provider_npi: "1234567890".to_string(),
            billing_provider_name: "Smith, John DDS".to_string(),
            subscriber_id: "PAT101".to_string(),
            subscriber_last: "Doe".to_string(),
            subscriber_first: "Jane".to_string(),
            subscriber_dob: "1985-06-15".to_string(),
            subscriber_gender: "F".to_string(),
            services: vec![DentalClaimService {
                line_num: 1,
                procedure_code: "D2740".to_string(),
                fee: 1350.0,
                tooth_num: Some("19".to_string()),
                surface: None,
            }],
        };

        let edi = generate_edi_837d(&input);

        assert!(edi.contains("ISA*00*"));
        assert!(edi.contains("ST*837*0001*005010X224A2~"));
        assert!(edi.contains("CLM*101*1350.00"));
        assert!(edi.contains("SV3*AD:D2740*1350.00**19*1~"));
        assert!(edi.contains("SE*"));
    }

    #[test]
    fn test_parse_x12_835_eob_adjudication() {
        let raw835 = "\
ISA*00*          *00*          *ZZ*SUBMITTER      *ZZ*RECEIVER       *240924*1200*^*00501*000000001*0*P*:~\r\n\
BPR*I*1250.00*C*ACH*CTX*01*999999999*DA*12345678*1999999999**01*999999999*DA*87654321*20240924~\r\n\
TRN*1*EFT987654321*1999999999~\r\n\
N1*PR*Delta Dental of California*XX*92011~\r\n\
CLP*101*1*500.00*400.00*50.00*12*CLM101~\r\n\
CLP*102*1*850.00*850.00*0.00*12*CLM102~\r\n\
SE*8*0001~\r\n";

        let parsed = parse_x12_835(raw835);

        assert_eq!(parsed.total_paid, 1250.00);
        assert_eq!(parsed.payer_name, "Delta Dental of California");
        assert_eq!(parsed.check_or_eft_trace, "EFT987654321");
        assert_eq!(parsed.claims.len(), 2);

        // Claim 101: 500 total, 400 paid, 50 pt resp -> 50 write-off
        assert_eq!(parsed.claims[0].claim_num, 101);
        assert_eq!(parsed.claims[0].paid_amount, 400.00);
        assert_eq!(parsed.claims[0].patient_responsibility, 50.00);
        assert_eq!(parsed.claims[0].write_off, 50.00);

        // Claim 102: 850 total, 850 paid -> 0 write-off
        assert_eq!(parsed.claims[1].claim_num, 102);
        assert_eq!(parsed.claims[1].paid_amount, 850.00);
        assert_eq!(parsed.claims[1].write_off, 0.00);
    }
}
