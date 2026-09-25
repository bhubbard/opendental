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
  type: 'RECALL_REMINDER' | 'CLAIM_SUBMISSION' | 'ELIGIBILITY_CHECK';
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
