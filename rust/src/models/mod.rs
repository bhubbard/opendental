use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PatStatus {
    Patient = 0,
    NonPatient = 1,
    Inactive = 2,
    Archived = 3,
    Deleted = 4,
    Deceased = 5,
    Prospective = 6,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Gender {
    Unknown = 0,
    Male = 1,
    Female = 2,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Patient {
    #[serde(rename = "PatNum")]
    pub pat_num: i64,
    #[serde(rename = "LName")]
    pub l_name: String,
    #[serde(rename = "FName")]
    pub f_name: String,
    #[serde(rename = "MiddleI")]
    pub middle_i: Option<String>,
    #[serde(rename = "Preferred")]
    pub preferred: Option<String>,
    #[serde(rename = "PatStatus")]
    pub pat_status: i32,
    #[serde(rename = "Gender")]
    pub gender: i32,
    #[serde(rename = "Birthdate")]
    pub birthdate: String,
    #[serde(rename = "SSN")]
    pub ssn: Option<String>,
    #[serde(rename = "Address")]
    pub address: Option<String>,
    #[serde(rename = "City")]
    pub city: Option<String>,
    #[serde(rename = "State")]
    pub state: Option<String>,
    #[serde(rename = "Zip")]
    pub zip: Option<String>,
    #[serde(rename = "WirelessPhone")]
    pub wireless_phone: Option<String>,
    #[serde(rename = "Email")]
    pub email: Option<String>,
    #[serde(rename = "PriProv")]
    pub pri_prov: Option<i64>,
    #[serde(rename = "ClinicNum")]
    pub clinic_num: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Appointment {
    #[serde(rename = "AptNum")]
    pub apt_num: i64,
    #[serde(rename = "PatNum")]
    pub pat_num: i64,
    #[serde(rename = "AptStatus")]
    pub apt_status: i32, // 1=Scheduled, 2=Complete, 3=Unsched, 4=ASAP, 5=Broken, 6=Planned
    #[serde(rename = "Pattern")]
    pub pattern: Option<String>,
    #[serde(rename = "Op")]
    pub op: i64,
    #[serde(rename = "Note")]
    pub note: Option<String>,
    #[serde(rename = "ProvNum")]
    pub prov_num: i64,
    #[serde(rename = "AptDateTime")]
    pub apt_date_time: String,
    #[serde(rename = "ProcDescript")]
    pub proc_descript: Option<String>,
    #[serde(rename = "Confirmed")]
    pub confirmed: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcedureLog {
    #[serde(rename = "ProcNum")]
    pub proc_num: i64,
    #[serde(rename = "PatNum")]
    pub pat_num: i64,
    #[serde(rename = "AptNum")]
    pub apt_num: Option<i64>,
    #[serde(rename = "CodeNum")]
    pub code_num: i64,
    #[serde(rename = "ProcDate")]
    pub proc_date: String,
    #[serde(rename = "ProcFee")]
    pub proc_fee: f64,
    #[serde(rename = "Surf")]
    pub surf: Option<String>,
    #[serde(rename = "ToothNum")]
    pub tooth_num: Option<String>,
    #[serde(rename = "Priority")]
    pub priority: Option<i32>,
    #[serde(rename = "ProcStatus")]
    pub proc_status: i32, // 1=TreatmentPlan, 2=Complete, 3=ExistingCurrent, 4=ExistingOther, 5=ReferredOut, 6=Deleted
    #[serde(rename = "ProvNum")]
    pub prov_num: i64,
    #[serde(rename = "ClinicNum")]
    pub clinic_num: Option<i64>,
    #[serde(rename = "BillingNote")]
    pub billing_note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcedureCode {
    #[serde(rename = "CodeNum")]
    pub code_num: i64,
    #[serde(rename = "ProcCode")]
    pub proc_code: String,
    #[serde(rename = "Descript")]
    pub descript: String,
    #[serde(rename = "DefaultFee")]
    pub default_fee: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Provider {
    #[serde(rename = "ProvNum")]
    pub prov_num: i64,
    #[serde(rename = "Abbr")]
    pub abbr: String,
    #[serde(rename = "LName")]
    pub l_name: String,
    #[serde(rename = "FName")]
    pub f_name: String,
    #[serde(rename = "StateLicense")]
    pub state_license: Option<String>,
    #[serde(rename = "DEARegNum")]
    pub dea_reg_num: Option<String>,
    #[serde(rename = "NationalProvID")]
    pub national_prov_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Operatory {
    #[serde(rename = "OperatoryNum")]
    pub operatory_num: i64,
    #[serde(rename = "OpName")]
    pub op_name: String,
    #[serde(rename = "ProvDentist")]
    pub prov_dentist: Option<i64>,
    #[serde(rename = "ProvHygienist")]
    pub prov_hygienist: Option<i64>,
    #[serde(rename = "ClinicNum")]
    pub clinic_num: Option<i64>,
    #[serde(rename = "IsWebSched")]
    pub is_web_sched: i32,
}

// -------------------------------------------------------------
// Imaging & DICOM
// -------------------------------------------------------------
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Mount {
    #[serde(rename = "MountNum")]
    pub mount_num: i64,
    #[serde(rename = "PatNum")]
    pub pat_num: i64,
    #[serde(rename = "Description")]
    pub description: String,
    #[serde(rename = "Width")]
    pub width: i32,
    #[serde(rename = "Height")]
    pub height: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MountItem {
    #[serde(rename = "MountItemNum")]
    pub mount_item_num: i64,
    #[serde(rename = "MountNum")]
    pub mount_num: i64,
    #[serde(rename = "Xpos")]
    pub x_pos: i32,
    #[serde(rename = "Ypos")]
    pub y_pos: i32,
    #[serde(rename = "ToothNumbers")]
    pub tooth_numbers: String,
    #[serde(rename = "ItemOrder")]
    pub item_order: i32,
    #[serde(rename = "DocNum")]
    pub doc_num: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DicomStudy {
    #[serde(rename = "StudyNum")]
    pub study_num: i64,
    #[serde(rename = "DocNum")]
    pub doc_num: i64,
    #[serde(rename = "PatNum")]
    pub pat_num: i64,
    #[serde(rename = "StudyInstanceUID")]
    pub study_instance_uid: String,
    #[serde(rename = "Modality")]
    pub modality: String,
    #[serde(rename = "KVP")]
    pub kvp: f64,
    #[serde(rename = "ExposureTimeMs")]
    pub exposure_time_ms: i32,
    #[serde(rename = "XRayTubeCurrentMA")]
    pub x_ray_tube_current_ma: f64,
    #[serde(rename = "WindowCenter")]
    pub window_center: i32,
    #[serde(rename = "WindowWidth")]
    pub window_width: i32,
    #[serde(rename = "ToothNumbers")]
    pub tooth_numbers: Option<String>,
}

// -------------------------------------------------------------
// Payments & PaySplits
// -------------------------------------------------------------
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Payment {
    #[serde(rename = "PayNum")]
    pub pay_num: i64,
    #[serde(rename = "PayType")]
    pub pay_type: i32, // 1=Check, 2=Cash, 3=CreditCard, 4=Electronic
    #[serde(rename = "PayDate")]
    pub pay_date: String,
    #[serde(rename = "PayAmt")]
    pub pay_amt: f64,
    #[serde(rename = "Receipt")]
    pub receipt: Option<String>,
    #[serde(rename = "PatNum")]
    pub pat_num: i64,
    #[serde(rename = "ClinicNum")]
    pub clinic_num: i64,
    #[serde(rename = "PaymentSource")]
    pub payment_source: i32, // 4=StripeTerminal
    #[serde(rename = "ExternalId")]
    pub external_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaySplit {
    #[serde(rename = "SplitNum")]
    pub split_num: i64,
    #[serde(rename = "SplitAmt")]
    pub split_amt: f64,
    #[serde(rename = "PatNum")]
    pub pat_num: i64,
    #[serde(rename = "PayNum")]
    pub pay_num: i64,
    #[serde(rename = "ProvNum")]
    pub prov_num: i64,
    #[serde(rename = "DatePay")]
    pub date_pay: String,
    #[serde(rename = "ProcNum")]
    pub proc_num: i64, // 0 = unearned
    #[serde(rename = "DateEntry")]
    pub date_entry: String,
    #[serde(rename = "UnearnedType")]
    pub unearned_type: i32,
    #[serde(rename = "ClinicNum")]
    pub clinic_num: i64,
    #[serde(rename = "SecurityHash")]
    pub security_hash: String,
}

// -------------------------------------------------------------
// eRx & EPCS
// -------------------------------------------------------------
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RxPat {
    #[serde(rename = "RxNum")]
    pub rx_num: i64,
    #[serde(rename = "PatNum")]
    pub pat_num: i64,
    #[serde(rename = "RxDate")]
    pub rx_date: String,
    #[serde(rename = "Drug")]
    pub drug: String,
    #[serde(rename = "Sig")]
    pub sig: String,
    #[serde(rename = "Disp")]
    pub disp: String,
    #[serde(rename = "Refills")]
    pub refills: String,
    #[serde(rename = "ProvNum")]
    pub prov_num: i64,
    #[serde(rename = "Notes")]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErxLog {
    #[serde(rename = "ErxLogNum")]
    pub erx_log_num: i64,
    #[serde(rename = "PatNum")]
    pub pat_num: i64,
    #[serde(rename = "MsgText")]
    pub msg_text: String,
    #[serde(rename = "ProvNum")]
    pub prov_num: i64,
    #[serde(rename = "DeaSchedule")]
    pub dea_schedule: String,
    #[serde(rename = "EpcsSignature")]
    pub epcs_signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RxAlert {
    #[serde(rename = "RxAlertNum")]
    pub rx_alert_num: i64,
    #[serde(rename = "DrugName")]
    pub drug_name: String,
    #[serde(rename = "AllergyTrigger")]
    pub allergy_trigger: String,
    #[serde(rename = "Severity")]
    pub severity: String,
    #[serde(rename = "Notification")]
    pub notification: String,
}

// -------------------------------------------------------------
// Insurance & Claims
// -------------------------------------------------------------
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Carrier {
    #[serde(rename = "CarrierNum")]
    pub carrier_num: i64,
    #[serde(rename = "CarrierName")]
    pub carrier_name: String,
    #[serde(rename = "ElectID")]
    pub elect_id: Option<String>,
    #[serde(rename = "PayerID")]
    pub payer_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InsPlan {
    #[serde(rename = "PlanNum")]
    pub plan_num: i64,
    #[serde(rename = "GroupName")]
    pub group_name: Option<String>,
    #[serde(rename = "GroupNum")]
    pub group_num: Option<String>,
    #[serde(rename = "CarrierNum")]
    pub carrier_num: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Benefit {
    #[serde(rename = "BenefitNum")]
    pub benefit_num: i64,
    #[serde(rename = "PlanNum")]
    pub plan_num: i64,
    #[serde(rename = "CovCatNum")]
    pub cov_cat_num: i32, // 0=General, 2=Preventive, 3=Restorative, 6=Major
    #[serde(rename = "BenefitType")]
    pub benefit_type: i32, // 1=Percentage, 3=Deductible, 4=Limitation
    #[serde(rename = "Percent")]
    pub percent: i32,
    #[serde(rename = "MonetaryAmt")]
    pub monetary_amt: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claim {
    #[serde(rename = "ClaimNum")]
    pub claim_num: i64,
    #[serde(rename = "PatNum")]
    pub pat_num: i64,
    #[serde(rename = "DateService")]
    pub date_service: String,
    #[serde(rename = "ClaimStatus")]
    pub claim_status: String, // 'W'=Waiting, 'S'=Sent, 'R'=Received
    #[serde(rename = "ClaimFee")]
    pub claim_fee: f64,
    #[serde(rename = "InsPayEst")]
    pub ins_pay_est: f64,
    #[serde(rename = "InsPayAmt")]
    pub ins_pay_amt: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaimProc {
    #[serde(rename = "ClaimProcNum")]
    pub claim_proc_num: i64,
    #[serde(rename = "ClaimNum")]
    pub claim_num: i64,
    #[serde(rename = "ProcNum")]
    pub proc_num: i64,
    #[serde(rename = "InsPayEst")]
    pub ins_pay_est: f64,
    #[serde(rename = "InsPayAmt")]
    pub ins_pay_amt: f64,
    #[serde(rename = "WriteOff")]
    pub write_off: f64,
    #[serde(rename = "DedApplied")]
    pub ded_applied: f64,
    #[serde(rename = "Status")]
    pub status: i32,
}

// -------------------------------------------------------------
// Periodontal Charting
// -------------------------------------------------------------
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerioMeasure {
    #[serde(rename = "PerioMeasureNum")]
    pub perio_measure_num: i64,
    #[serde(rename = "PerioExamNum")]
    pub perio_exam_num: i64,
    #[serde(rename = "ToothNum")]
    pub tooth_num: i32, // 1 to 32
    #[serde(rename = "SequenceType")]
    pub sequence_type: i32, // 0=Probing, 1=Bleeding, 2=Suppuration
    // 6 sites per tooth: MB, B, DB, ML, L, DL
    pub mb: i32,
    pub b: i32,
    pub db: i32,
    pub ml: i32,
    pub l: i32,
    pub dl: i32,
}

// -------------------------------------------------------------
// Sheets / Forms & HL7
// -------------------------------------------------------------
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Sheet {
    #[serde(rename = "SheetNum")]
    pub sheet_num: i64,
    #[serde(rename = "SheetType")]
    pub sheet_type: i32,
    #[serde(rename = "PatNum")]
    pub pat_num: i64,
    #[serde(rename = "Description")]
    pub description: String,
    #[serde(rename = "SignedStatus")]
    pub signed_status: i32,
    #[serde(rename = "SignatureData")]
    pub signature_data: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HL7Message {
    #[serde(rename = "HL7MsgNum")]
    pub hl7_msg_num: i64,
    #[serde(rename = "MsgType")]
    pub msg_type: String,
    #[serde(rename = "ControlID")]
    pub control_id: String,
    #[serde(rename = "PatNum")]
    pub pat_num: i64,
    #[serde(rename = "MsgBody")]
    pub msg_body: String,
}
