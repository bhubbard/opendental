use std::sync::{Arc, Mutex};
use crate::models::*;
use crate::engine::security::{compute_security_log_hash, PermType};
use crate::engine::payments::{distribute_payment_to_procedures, calculate_ledger_summary, LedgerSummary};
use crate::engine::erx::{is_controlled_substance, is_valid_dea_format, is_valid_npi, sign_epcs_prescription};
use crate::engine::x12::{parse_x12_835, ParsedEra835};
use crate::engine::hl7::{parse_hl7_message, build_hl7_ack};

#[derive(Debug, Default)]
struct DbState {
    patients: Vec<Patient>,
    appointments: Vec<Appointment>,
    procedures: Vec<ProcedureLog>,
    payments: Vec<Payment>,
    paysplits: Vec<PaySplit>,
    prescriptions: Vec<RxPat>,
    erx_logs: Vec<ErxLog>,
    dicom_studies: Vec<DicomStudy>,
    claims: Vec<Claim>,
    claim_procs: Vec<ClaimProc>,
    security_logs: Vec<(i64, i32, i64, String, String, String)>, // (Seq, PermType, PatNum, Time, Text, Hash)
    next_pat_num: i64,
    next_apt_num: i64,
    next_proc_num: i64,
    next_pay_num: i64,
    next_split_num: i64,
    next_rx_num: i64,
    next_study_num: i64,
    next_claim_num: i64,
}

#[derive(Clone, Default)]
pub struct PracticeRepository {
    state: Arc<Mutex<DbState>>,
}

impl PracticeRepository {
    pub fn new() -> Self {
        let mut repo = Self::default();
        repo.seed_demo_data();
        repo
    }

    fn seed_demo_data(&mut self) {
        let mut st = self.state.lock().unwrap();
        st.next_pat_num = 1;
        st.next_apt_num = 1;
        st.next_proc_num = 1;
        st.next_pay_num = 1;
        st.next_split_num = 1;
        st.next_rx_num = 1;
        st.next_study_num = 1;
        st.next_claim_num = 1;

        // Seed Patient 1: Jane Doe
        st.patients.push(Patient {
            pat_num: 1,
            l_name: "Doe".to_string(),
            f_name: "Jane".to_string(),
            middle_i: Some("A".to_string()),
            preferred: None,
            pat_status: 0,
            gender: 2,
            birthdate: "1988-03-15".to_string(),
            ssn: Some("123-45-6789".to_string()),
            address: Some("123 Market St".to_string()),
            city: Some("San Francisco".to_string()),
            state: Some("CA".to_string()),
            zip: Some("94102".to_string()),
            wireless_phone: Some("415-555-0100".to_string()),
            email: Some("jane.doe@example.com".to_string()),
            pri_prov: Some(1),
            clinic_num: Some(1),
        });
        st.next_pat_num = 2;
    }

    // ---------------------------------------------------------
    // Patients
    // ---------------------------------------------------------
    pub fn insert_patient(&self, mut patient: Patient) -> Patient {
        let mut st = self.state.lock().unwrap();
        patient.pat_num = st.next_pat_num;
        st.next_pat_num += 1;
        st.patients.push(patient.clone());

        // Log HIPAA event
        let now = chrono::Utc::now().to_rfc3339();
        let log_text = format!("Patient created: {}, {}", patient.l_name, patient.f_name);
        let hash = compute_security_log_hash(PermType::PatientCreate as i32, 1, &now, &log_text, patient.pat_num);
        let log_seq = st.security_logs.len() as i64 + 1;
        st.security_logs.push((log_seq, PermType::PatientCreate as i32, patient.pat_num, now, log_text, hash));

        patient
    }

    pub fn get_patient(&self, pat_num: i64) -> Option<Patient> {
        let st = self.state.lock().unwrap();
        st.patients.iter().find(|p| p.pat_num == pat_num).cloned()
    }

    pub fn search_patients(&self, query: &str) -> Vec<Patient> {
        let st = self.state.lock().unwrap();
        let q = query.trim().to_lowercase();
        st.patients
            .iter()
            .filter(|p| {
                p.l_name.to_lowercase().contains(&q)
                    || p.f_name.to_lowercase().contains(&q)
                    || p.wireless_phone.as_deref().unwrap_or("").contains(&q)
            })
            .cloned()
            .collect()
    }

    // ---------------------------------------------------------
    // Appointments
    // ---------------------------------------------------------
    pub fn insert_appointment(&self, mut apt: Appointment) -> Result<Appointment, &'static str> {
        let mut st = self.state.lock().unwrap();

        // Check for double-booking conflict on same op and time
        let has_conflict = st.appointments.iter().any(|existing| {
            existing.op == apt.op
                && existing.apt_date_time == apt.apt_date_time
                && existing.apt_status != 6 // 6 = Planned/Broken
        });

        if has_conflict {
            return Err("Time slot in operatory is already booked");
        }

        apt.apt_num = st.next_apt_num;
        st.next_apt_num += 1;
        st.appointments.push(apt.clone());

        // Log HIPAA event
        let now = chrono::Utc::now().to_rfc3339();
        let log_text = format!("Appointment scheduled: {} in Op {}", apt.apt_date_time, apt.op);
        let hash = compute_security_log_hash(PermType::AppointmentCreate as i32, 1, &now, &log_text, apt.pat_num);
        let log_seq = st.security_logs.len() as i64 + 1;
        st.security_logs.push((log_seq, PermType::AppointmentCreate as i32, apt.pat_num, now, log_text, hash));

        Ok(apt)
    }

    pub fn get_appointments_by_date(&self, date_prefix: &str) -> Vec<Appointment> {
        let st = self.state.lock().unwrap();
        st.appointments
            .iter()
            .filter(|a| a.apt_date_time.starts_with(date_prefix))
            .cloned()
            .collect()
    }

    // ---------------------------------------------------------
    // Procedures
    // ---------------------------------------------------------
    pub fn insert_procedure(&self, mut proc: ProcedureLog) -> ProcedureLog {
        let mut st = self.state.lock().unwrap();
        proc.proc_num = st.next_proc_num;
        st.next_proc_num += 1;
        st.procedures.push(proc.clone());
        proc
    }

    pub fn get_procedures_by_patient(&self, pat_num: i64) -> Vec<ProcedureLog> {
        let st = self.state.lock().unwrap();
        st.procedures.iter().filter(|p| p.pat_num == pat_num).cloned().collect()
    }

    // ---------------------------------------------------------
    // Payments & PaySplits
    // ---------------------------------------------------------
    pub fn charge_payment_with_auto_split(
        &self,
        pat_num: i64,
        amount: f64,
        salt: &str,
    ) -> (Payment, Vec<PaySplit>) {
        let mut st = self.state.lock().unwrap();
        let pay_num = st.next_pay_num;
        st.next_pay_num += 1;

        let now_date = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let now_time = chrono::Utc::now().to_rfc3339();

        let payment = Payment {
            pay_num,
            pay_type: 3, // Credit Card
            pay_date: now_date.clone(),
            pay_amt: amount,
            receipt: Some("APPROVED EMV STRIPE TERMINAL".to_string()),
            pat_num,
            clinic_num: 1,
            payment_source: 4, // Stripe Terminal
            external_id: Some(format!("pm_{}", pay_num)),
        };
        st.payments.push(payment.clone());

        // Find completed procedures (proc_status == 2) for this patient
        let proc_tuples: Vec<(i64, f64, f64)> = st
            .procedures
            .iter()
            .filter(|p| p.pat_num == pat_num && p.proc_status == 2)
            .map(|p| {
                let paid_already: f64 = st
                    .paysplits
                    .iter()
                    .filter(|s| s.proc_num == p.proc_num)
                    .map(|s| s.split_amt)
                    .sum();
                (p.proc_num, p.proc_fee, paid_already)
            })
            .collect();

        let raw_splits = distribute_payment_to_procedures(pat_num, amount, &proc_tuples, &now_time, salt);
        let mut created_splits = Vec::new();

        for alloc in raw_splits {
            let split = PaySplit {
                split_num: st.next_split_num,
                split_amt: alloc.split_amt,
                pat_num,
                pay_num,
                prov_num: 1,
                date_pay: now_date.clone(),
                proc_num: alloc.proc_num,
                date_entry: now_time.clone(),
                unearned_type: if alloc.unearned { 1 } else { 0 },
                clinic_num: 1,
                security_hash: alloc.security_hash,
            };
            st.next_split_num += 1;
            st.paysplits.push(split.clone());
            created_splits.push(split);
        }

        // HIPAA Log
        let log_text = format!("EMV Payment of ${:.2} processed. Splits: {}", amount, created_splits.len());
        let hash = compute_security_log_hash(PermType::PaymentCreate as i32, 1, &now_time, &log_text, pat_num);
        let log_seq = st.security_logs.len() as i64 + 1;
        st.security_logs.push((log_seq, PermType::PaymentCreate as i32, pat_num, now_time, log_text, hash));

        (payment, created_splits)
    }

    pub fn record_dicom_study(&self, mut study: DicomStudy) -> DicomStudy {
        let mut st = self.state.lock().unwrap();
        study.study_num = st.next_study_num;
        st.next_study_num += 1;
        st.dicom_studies.push(study.clone());
        study
    }

    pub fn get_patient_ledger(&self, pat_num: i64) -> LedgerSummary {
        let st = self.state.lock().unwrap();

        let billed: Vec<f64> = st
            .procedures
            .iter()
            .filter(|p| p.pat_num == pat_num && p.proc_status == 2)
            .map(|p| p.proc_fee)
            .collect();

        let ins_paid: Vec<f64> = st
            .claim_procs
            .iter()
            .filter(|cp| cp.claim_num > 0)
            .map(|cp| cp.ins_pay_amt)
            .collect();

        let write_offs: Vec<f64> = st
            .claim_procs
            .iter()
            .filter(|cp| cp.claim_num > 0)
            .map(|cp| cp.write_off)
            .collect();

        let splits: Vec<(f64, bool)> = st
            .paysplits
            .iter()
            .filter(|s| s.pat_num == pat_num)
            .map(|s| (s.split_amt, s.unearned_type == 1))
            .collect();

        calculate_ledger_summary(&billed, &ins_paid, &write_offs, &splits)
    }

    // ---------------------------------------------------------
    // eRx & EPCS Prescribing
    // ---------------------------------------------------------
    pub fn prescribe_medication(
        &self,
        pat_num: i64,
        prov_num: i64,
        drug: &str,
        sig: &str,
        disp: &str,
        dea_schedule: &str,
        epcs_auth_token: Option<&str>,
        provider_dea: Option<&str>,
        provider_npi: Option<&str>,
    ) -> Result<(RxPat, Option<ErxLog>), &'static str> {
        let is_controlled = is_controlled_substance(dea_schedule);

        // NPI validation
        if let Some(npi) = provider_npi {
            if !is_valid_npi(npi) {
                return Err("Provider NPI must be exactly 10 digits");
            }
        }

        let mut epcs_sig = String::new();
        if is_controlled {
            let dea = provider_dea.unwrap_or("");
            if !is_valid_dea_format(dea) {
                return Err("Valid 2-letter 7-digit DEA number required for controlled substances");
            }
            let token = epcs_auth_token.unwrap_or("");
            if token.len() < 6 {
                return Err("EPCS Two-Factor Authentication token required (DEA § 1311.115)");
            }

            let now = chrono::Utc::now().to_rfc3339();
            epcs_sig = sign_epcs_prescription(prov_num, pat_num, drug, disp, token, &now);
        }

        let mut st = self.state.lock().unwrap();
        let rx_num = st.next_rx_num;
        st.next_rx_num += 1;

        let rx = RxPat {
            rx_num,
            pat_num,
            rx_date: chrono::Utc::now().format("%Y-%m-%d").to_string(),
            drug: drug.to_string(),
            sig: sig.to_string(),
            disp: disp.to_string(),
            refills: "0".to_string(),
            prov_num,
            notes: Some(if is_controlled {
                format!("EPCS Signed [{}]", dea_schedule)
            } else {
                "Standard eRx".to_string()
            }),
        };
        st.prescriptions.push(rx.clone());

        let erx_log = if is_controlled {
            let log_entry = ErxLog {
                erx_log_num: st.erx_logs.len() as i64 + 1,
                pat_num,
                msg_text: format!("EPCS Transmitted: {}, Disp: {}, Sig: {}", drug, disp, epcs_sig),
                prov_num,
                dea_schedule: dea_schedule.to_string(),
                epcs_signature: epcs_sig,
            };
            st.erx_logs.push(log_entry.clone());
            Some(log_entry)
        } else {
            None
        };

        Ok((rx, erx_log))
    }

    // ---------------------------------------------------------
    // ERA 835 Remittance Auto-Posting
    // ---------------------------------------------------------
    pub fn process_era_835(&self, era_content: &str) -> ParsedEra835 {
        let parsed = parse_x12_835(era_content);
        let mut st = self.state.lock().unwrap();

        for line in &parsed.claims {
            if let Some(claim) = st.claims.iter_mut().find(|c| c.claim_num == line.claim_num) {
                claim.claim_status = "R".to_string(); // Received
                claim.ins_pay_amt = line.paid_amount;
            }

            // Create or update claimproc record
            let cp_num = st.claim_procs.len() as i64 + 1;
            st.claim_procs.push(ClaimProc {
                claim_proc_num: cp_num,
                claim_num: line.claim_num,
                proc_num: 1,
                ins_pay_est: line.total_charge,
                ins_pay_amt: line.paid_amount,
                write_off: line.write_off,
                ded_applied: 0.0,
                status: 1, // Received
            });
        }

        parsed
    }

    // ---------------------------------------------------------
    // HL7 v2 Interface
    // ---------------------------------------------------------
    pub fn receive_hl7_message(&self, raw_hl7: &str) -> Result<String, &'static str> {
        let parsed = parse_hl7_message(raw_hl7).ok_or("Invalid HL7 message")?;

        let mut st = self.state.lock().unwrap();
        // If patient pat_num exists, update; if not, insert
        if parsed.patient.pat_num > 0 {
            if let Some(pat) = st.patients.iter_mut().find(|p| p.pat_num == parsed.patient.pat_num) {
                if !parsed.patient.last_name.is_empty() {
                    pat.l_name = parsed.patient.last_name.clone();
                }
                if !parsed.patient.first_name.is_empty() {
                    pat.f_name = parsed.patient.first_name.clone();
                }
            }
        } else if !parsed.patient.last_name.is_empty() {
            let new_pat_num = st.next_pat_num;
            st.next_pat_num += 1;
            st.patients.push(Patient {
                pat_num: new_pat_num,
                l_name: parsed.patient.last_name.clone(),
                f_name: parsed.patient.first_name.clone(),
                middle_i: Some(parsed.patient.middle_name.clone()),
                preferred: None,
                pat_status: 0,
                gender: parsed.patient.gender,
                birthdate: parsed.patient.dob.clone(),
                ssn: None,
                address: None,
                city: None,
                state: None,
                zip: None,
                wireless_phone: None,
                email: None,
                pri_prov: Some(1),
                clinic_num: Some(1),
            });
        }

        let ack = build_hl7_ack(&parsed.control_id, "AA", "Message processed successfully");
        Ok(ack)
    }
}
