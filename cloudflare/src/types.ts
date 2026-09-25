// Open Dental Types matching OpenDentBusiness entities & Cloudflare Bindings

export interface Env {
  DB: D1Database;
  DOCUMENTS_BUCKET: R2Bucket;
  OPENDENTAL_KV: KVNamespace;
  OPENDENTAL_QUEUE: Queue<OpenDentalJob>;
  APPOINTMENT_SCHEDULE_DO: DurableObjectNamespace;
  TOOTH_CHART_DO: DurableObjectNamespace;
  ASSETS?: Fetcher;
  ENVIRONMENT?: string;
  PRACTICE_NAME?: string;
}

export interface OpenDentalJob {
  type: 'RECALL_REMINDER' | 'CLAIM_SUBMISSION' | 'ELIGIBILITY_CHECK' | 'ERA_835_PROCESS';
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface Patient {
  PatNum: number;
  LName: string;
  FName: string;
  MiddleI?: string;
  Preferred?: string;
  PatStatus: number;
  Gender: number;
  Position: number;
  Birthdate: string;
  SSN?: string;
  Address?: string;
  Address2?: string;
  City?: string;
  State?: string;
  Zip?: string;
  HmPhone?: string;
  WkPhone?: string;
  WirelessPhone?: string;
  Email?: string;
  Guarantor?: number;
  CreditType?: string;
  PriProv?: number;
  SecProv?: number;
  FeeSched?: number;
  ClinicNum?: number;
  DateFirstVisit?: string;
  DateTStamp?: string;
}

export interface Appointment {
  AptNum: number;
  PatNum: number;
  AptStatus: number;
  Pattern?: string;
  Confirmed?: number;
  TimeLocked?: number;
  Op: number;
  Note?: string;
  ProvNum: number;
  ProvHyg?: number;
  AptDateTime: string;
  NextAptNum?: number;
  UnschedStatus?: number;
  IsNewPatient?: number;
  ProcDescript?: string;
  Assistant?: number;
  ClinicNum?: number;
  IsHygiene?: number;
  DateTimeArrived?: string;
  DateTimeSeated?: string;
  DateTimeDismissed?: string;
  DateTStamp?: string;
  // Join properties
  PatientName?: string;
  OpName?: string;
  ProvAbbr?: string;
}

export interface ProcedureLog {
  ProcNum: number;
  PatNum: number;
  AptNum?: number;
  CodeNum: number;
  ProcDate: string;
  ProcFee: number;
  Surf?: string;
  ToothNum?: string;
  ToothRange?: string;
  Priority?: number;
  ProcStatus: number;
  ProvNum: number;
  Dx?: number;
  PlannedAptNum?: number;
  ClinicNum?: number;
  BillingNote?: string;
  DateTStamp?: string;
  // Join properties
  ProcCode?: string;
  Descript?: string;
}

export interface ProcedureCode {
  CodeNum: number;
  ProcCode: string;
  Descript: string;
  AbbrDesc?: string;
  ProcCat?: number;
  TreatArea?: number;
  ProcTime?: string;
  DefaultNote?: string;
  DefaultFee?: number;
}

export interface Provider {
  ProvNum: number;
  Abbr: string;
  ItemOrder?: number;
  LName: string;
  FName: string;
  MI?: string;
  Suffix?: string;
  Specialty?: number;
  StateLicense?: string;
  DEARegNum?: string;
  ProvColor?: number;
  IsHidden?: number;
  NationalProvID?: string;
}

export interface Operatory {
  OperatoryNum: number;
  OpName: string;
  Abbr?: string;
  ItemOrder?: number;
  IsHidden?: number;
  ProvDentist?: number;
  ProvHygienist?: number;
  ClinicNum?: number;
  IsWebSched?: number;
}

export interface Clinic {
  ClinicNum: number;
  Description: string;
  Address?: string;
  Address2?: string;
  City?: string;
  State?: string;
  Zip?: string;
  Phone?: string;
  Email?: string;
}

export interface DocumentRecord {
  DocNum: number;
  PatNum: number;
  FileName: string;
  DateCreated: string;
  DocCategory: number;
  Description?: string;
  R2Key: string;
  ContentType?: string;
  FileSize?: number;
}

export interface ToothInitial {
  ToothInitialNum: number;
  PatNum: number;
  ToothNum: string;
  InitialType: number; // 0=Missing, 1=Hidden, 2=Primary, 3=Perm
  ColorAndComment?: string;
}

// -------------------------------------------------------------
// Imaging & DICOM Types
// -------------------------------------------------------------
export interface ImagingDevice {
  ImagingDeviceNum: number;
  DeviceName: string;
  DeviceType: string;
  ComputerName: string;
}

export interface Mount {
  MountNum: number;
  PatNum: number;
  DocCategory: number;
  DateCreated: string;
  Description: string;
  Note?: string;
  ImgType: number;
  Width: number;
  Height: number;
  ColorBackGround?: number;
}

export interface MountItem {
  MountItemNum: number;
  MountNum: number;
  Xpos: number;
  Ypos: number;
  Ordinal: number;
  ToothNumbers: string;
  ItemOrder: number;
  DocNum: number;
}

export interface DicomStudy {
  StudyNum: number;
  DocNum: number;
  PatNum: number;
  StudyInstanceUID: string;
  SeriesInstanceUID: string;
  SOPInstanceUID: string;
  Modality: string;
  BodyPartExamined: string;
  KVP: number;
  ExposureTimeMs: number;
  XRayTubeCurrentMA: number;
  PhotometricInterpretation: string;
  Rows: number;
  Columns: number;
  BitsAllocated: number;
  BitsStored: number;
  WindowCenter: number;
  WindowWidth: number;
  ToothNumbers?: string;
}

// -------------------------------------------------------------
// Payment & PaySplit Ledger Types
// -------------------------------------------------------------
export interface Payment {
  PayNum: number;
  PayType: number; // 1=Check, 2=Cash, 3=CreditCard, 4=Electronic
  PayDate: string;
  PayAmt: number;
  CheckNum?: string;
  BankBranch?: string;
  PayNote?: string;
  IsSplit: number;
  PatNum: number;
  ClinicNum: number;
  DateEntry: string;
  DepositNum: number;
  Receipt?: string;
  PaymentSource: number; // 0=None, 1=PayConnect, 2=PaySimple, 3=EdgeExpress, 4=StripeTerminal
  ProcessStatus: number;
  ExternalId?: string;
}

export interface PaySplit {
  SplitNum: number;
  SplitAmt: number;
  PatNum: number;
  ProcDate?: string;
  PayNum: number;
  ProvNum: number;
  PayPlanNum?: number;
  DatePay: string;
  ProcNum: number;
  DateEntry: string;
  UnearnedType: number;
  ClinicNum: number;
  SecUserNumEntry: number;
  SecurityHash: string;
}

export interface CreditCard {
  CreditCardNum: number;
  PatNum: number;
  Address?: string;
  Zip?: string;
  CCNumberMasked: string;
  CCExpiration?: string;
  ItemOrder: number;
  ChargeAmt: number;
  Token: string;
  CCSource: number;
  ClinicNum: number;
}

export interface ClaimPayment {
  ClaimPaymentNum: number;
  CheckDate: string;
  CheckAmt: number;
  CheckNum: string;
  BankBranch?: string;
  Note?: string;
  ClinicNum: number;
  DepositNum: number;
  CarrierName: string;
  DateIssued?: string;
  IsPartial: number;
}

// -------------------------------------------------------------
// eRx & EPCS Prescribing Types
// -------------------------------------------------------------
export interface RxPat {
  RxNum: number;
  PatNum: number;
  RxDate: string;
  Drug: string;
  Sig: string;
  Disp: string;
  Refills: string;
  ProvNum: number;
  Notes?: string;
}

export interface ErxLog {
  ErxLogNum: number;
  PatNum: number;
  MsgText: string;
  ProvNum: number;
  UserNum: number;
  DeaSchedule: string;
  EpcsSignature: string;
  DateTStamp?: string;
}

export interface RxAlert {
  RxAlertNum: number;
  DrugName: string;
  AllergyTrigger: string;
  DiseaseTrigger?: string;
  Severity: string;
  Notification: string;
}

// -------------------------------------------------------------
// Sheets / eClipboard Intake Types
// -------------------------------------------------------------
export interface Sheet {
  SheetNum: number;
  SheetType: number; // 1=PatientForm, 2=MedicalHistory, 3=Consent, 4=Referral
  PatNum: number;
  DateTimeSheet: string;
  Description: string;
  IsWebForm: number;
  SignedStatus: number;
  SignatureData?: string;
}

export interface SheetField {
  SheetFieldNum: number;
  SheetNum: number;
  FieldType: number;
  FieldName: string;
  FieldValue: string;
  XPos: number;
  YPos: number;
  Width: number;
  Height: number;
  IsRequired: number;
}

// -------------------------------------------------------------
// WebSched & HL7 Types
// -------------------------------------------------------------
export interface WebSchedSlot {
  SlotNum: number;
  OpNum: number;
  ProvNum: number;
  DateTimeStart: string;
  DateTimeEnd: string;
  IsBooked: number;
  PatNum?: number;
}

export interface HL7Message {
  HL7MsgNum: number;
  MsgType: string;
  ControlID: string;
  PatNum: number;
  AptNum: number;
  HL7Status: string;
  MsgBody: string;
}
