-- Migration: 0001_initial_opendental_schema.sql
-- Open Dental Relational Schema for Cloudflare D1 (SQLite)

-- 1. Clinic
CREATE TABLE IF NOT EXISTS clinic (
    ClinicNum INTEGER PRIMARY KEY AUTOINCREMENT,
    Description TEXT NOT NULL,
    Address TEXT DEFAULT '',
    Address2 TEXT DEFAULT '',
    City TEXT DEFAULT '',
    State TEXT DEFAULT '',
    Zip TEXT DEFAULT '',
    Phone TEXT DEFAULT '',
    Email TEXT DEFAULT '',
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Provider
CREATE TABLE IF NOT EXISTS provider (
    ProvNum INTEGER PRIMARY KEY AUTOINCREMENT,
    Abbr TEXT NOT NULL,
    ItemOrder INTEGER DEFAULT 0,
    LName TEXT NOT NULL,
    FName TEXT NOT NULL,
    MI TEXT DEFAULT '',
    Suffix TEXT DEFAULT '',
    Specialty INTEGER DEFAULT 0,
    StateLicense TEXT DEFAULT '',
    DEARegNum TEXT DEFAULT '',
    ProvColor INTEGER DEFAULT -1,
    IsHidden INTEGER DEFAULT 0,
    NationalProvID TEXT DEFAULT '',
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Operatory
CREATE TABLE IF NOT EXISTS operatory (
    OperatoryNum INTEGER PRIMARY KEY AUTOINCREMENT,
    OpName TEXT NOT NULL,
    Abbr TEXT DEFAULT '',
    ItemOrder INTEGER DEFAULT 0,
    IsHidden INTEGER DEFAULT 0,
    ProvDentist INTEGER DEFAULT 0,
    ProvHygienist INTEGER DEFAULT 0,
    ClinicNum INTEGER DEFAULT 0,
    IsWebSched INTEGER DEFAULT 1,
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Fee Schedules & Procedure Codes
CREATE TABLE IF NOT EXISTS feesched (
    FeeSchedNum INTEGER PRIMARY KEY AUTOINCREMENT,
    Description TEXT NOT NULL,
    FeeSchedType INTEGER DEFAULT 1, -- 1=Normal, 2=CoPay, 3=Allowed
    IsHidden INTEGER DEFAULT 0,
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS procedurecode (
    CodeNum INTEGER PRIMARY KEY AUTOINCREMENT,
    ProcCode TEXT UNIQUE NOT NULL, -- e.g. D0120, D1110
    Descript TEXT NOT NULL,
    AbbrDesc TEXT DEFAULT '',
    ProcCat INTEGER DEFAULT 1,
    TreatArea INTEGER DEFAULT 1,
    ProcTime TEXT DEFAULT '/X/',
    DefaultNote TEXT DEFAULT '',
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fee (
    FeeNum INTEGER PRIMARY KEY AUTOINCREMENT,
    Amount REAL NOT NULL DEFAULT 0.0,
    FeeSchedNum INTEGER NOT NULL,
    CodeNum INTEGER NOT NULL,
    ClinicNum INTEGER DEFAULT 0,
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Patient
CREATE TABLE IF NOT EXISTS patient (
    PatNum INTEGER PRIMARY KEY AUTOINCREMENT,
    LName TEXT NOT NULL,
    FName TEXT NOT NULL,
    MiddleI TEXT DEFAULT '',
    Preferred TEXT DEFAULT '',
    PatStatus INTEGER DEFAULT 0, -- 0=Patient, 1=NonPatient, 2=Inactive, 3=Archived, 4=Deleted
    Gender INTEGER DEFAULT 0, -- 0=Male, 1=Female, 2=Unknown
    Position INTEGER DEFAULT 0, -- 0=Single, 1=Married, 2=Child, etc.
    Birthdate DATE NOT NULL,
    SSN TEXT DEFAULT '',
    Address TEXT DEFAULT '',
    Address2 TEXT DEFAULT '',
    City TEXT DEFAULT '',
    State TEXT DEFAULT '',
    Zip TEXT DEFAULT '',
    HmPhone TEXT DEFAULT '',
    WkPhone TEXT DEFAULT '',
    WirelessPhone TEXT DEFAULT '',
    Email TEXT DEFAULT '',
    Guarantor INTEGER DEFAULT 0,
    CreditType TEXT DEFAULT 'A',
    PriProv INTEGER DEFAULT 0,
    SecProv INTEGER DEFAULT 0,
    FeeSched INTEGER DEFAULT 1,
    BillingType INTEGER DEFAULT 1,
    ClinicNum INTEGER DEFAULT 0,
    DateFirstVisit DATE DEFAULT CURRENT_DATE,
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Appointment
CREATE TABLE IF NOT EXISTS appointment (
    AptNum INTEGER PRIMARY KEY AUTOINCREMENT,
    PatNum INTEGER NOT NULL,
    AptStatus INTEGER DEFAULT 1, -- 1=Scheduled, 2=Complete, 3=Unsched, 4=ASAP, 5=Broken, 6=Planned
    Pattern TEXT DEFAULT '/XX/',
    Confirmed INTEGER DEFAULT 0,
    TimeLocked INTEGER DEFAULT 0,
    Op INTEGER NOT NULL,
    Note TEXT DEFAULT '',
    ProvNum INTEGER NOT NULL,
    ProvHyg INTEGER DEFAULT 0,
    AptDateTime DATETIME NOT NULL,
    NextAptNum INTEGER DEFAULT 0,
    UnschedStatus INTEGER DEFAULT 0,
    IsNewPatient INTEGER DEFAULT 0,
    ProcDescript TEXT DEFAULT '',
    Assistant INTEGER DEFAULT 0,
    ClinicNum INTEGER DEFAULT 0,
    IsHygiene INTEGER DEFAULT 0,
    DateTimeArrived DATETIME,
    DateTimeSeated DATETIME,
    DateTimeDismissed DATETIME,
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. ProcedureLog (Completed and Treatment-Planned Procedures)
CREATE TABLE IF NOT EXISTS procedurelog (
    ProcNum INTEGER PRIMARY KEY AUTOINCREMENT,
    PatNum INTEGER NOT NULL,
    AptNum INTEGER DEFAULT 0,
    CodeNum INTEGER NOT NULL,
    ProcDate DATE NOT NULL,
    ProcFee REAL NOT NULL DEFAULT 0.0,
    Surf TEXT DEFAULT '', -- e.g. MOD, O, B, L
    ToothNum TEXT DEFAULT '', -- e.g. 1-32, A-T
    ToothRange TEXT DEFAULT '',
    Priority INTEGER DEFAULT 0,
    ProcStatus INTEGER DEFAULT 1, -- 1=TreatmentPlan, 2=Complete, 3=ExistingCurProv, 4=ExistingOtherProv, 5=Referred, 6=Deleted
    ProvNum INTEGER NOT NULL,
    Dx INTEGER DEFAULT 0,
    PlannedAptNum INTEGER DEFAULT 0,
    ClinicNum INTEGER DEFAULT 0,
    BillingNote TEXT DEFAULT '',
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. ToothInitial (Initial condition, missing teeth, primary teeth)
CREATE TABLE IF NOT EXISTS toothinitial (
    ToothInitialNum INTEGER PRIMARY KEY AUTOINCREMENT,
    PatNum INTEGER NOT NULL,
    ToothNum TEXT NOT NULL,
    InitialType INTEGER DEFAULT 0, -- 0=Missing, 1=Hidden, 2=Primary, 3=Perm, 4=Drawing
    ColorAndComment TEXT DEFAULT '',
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. Document (Digital X-rays, PDFs, Scans stored in Cloudflare R2)
CREATE TABLE IF NOT EXISTS document (
    DocNum INTEGER PRIMARY KEY AUTOINCREMENT,
    PatNum INTEGER NOT NULL,
    FileName TEXT NOT NULL,
    DateCreated DATETIME DEFAULT CURRENT_TIMESTAMP,
    DocCategory INTEGER DEFAULT 1,
    Description TEXT DEFAULT '',
    R2Key TEXT NOT NULL, -- Key in Cloudflare R2 bucket
    ContentType TEXT DEFAULT 'application/octet-stream',
    FileSize INTEGER DEFAULT 0,
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. Recall
CREATE TABLE IF NOT EXISTS recall (
    RecallNum INTEGER PRIMARY KEY AUTOINCREMENT,
    PatNum INTEGER NOT NULL,
    RecallTypeNum INTEGER DEFAULT 1,
    DateDueCalc DATE NOT NULL,
    DateDue DATE NOT NULL,
    DatePrevious DATE,
    RecallInterval INTEGER DEFAULT 6, -- months
    RecallStatus INTEGER DEFAULT 0,
    Note TEXT DEFAULT '',
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11. Communication Log (SMS, Calls, Recalls)
CREATE TABLE IF NOT EXISTS commlog (
    CommlogNum INTEGER PRIMARY KEY AUTOINCREMENT,
    PatNum INTEGER NOT NULL,
    CommDateTime DATETIME DEFAULT CURRENT_TIMESTAMP,
    CommType INTEGER DEFAULT 1, -- 1=Misc, 2=Phone, 3=Email, 4=SMS, 5=Recall
    Note TEXT DEFAULT '',
    Mode_ INTEGER DEFAULT 0,
    SentOrReceived INTEGER DEFAULT 0, -- 0=Neither, 1=Sent, 2=Received
    UserNum INTEGER DEFAULT 1,
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 12. RxPat (Prescriptions)
CREATE TABLE IF NOT EXISTS rxpat (
    RxNum INTEGER PRIMARY KEY AUTOINCREMENT,
    PatNum INTEGER NOT NULL,
    RxDate DATE NOT NULL,
    Drug TEXT NOT NULL,
    Sig TEXT NOT NULL,
    Disp TEXT NOT NULL,
    Refills TEXT DEFAULT '0',
    ProvNum INTEGER NOT NULL,
    Notes TEXT DEFAULT '',
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 13. Claims & ClaimProc
CREATE TABLE IF NOT EXISTS claim (
    ClaimNum INTEGER PRIMARY KEY AUTOINCREMENT,
    PatNum INTEGER NOT NULL,
    DateService DATE NOT NULL,
    ClaimStatus TEXT DEFAULT 'W', -- W=Waiting, S=Sent, R=Received
    ClaimType TEXT DEFAULT 'P', -- P=Primary, S=Secondary
    PlanNum INTEGER DEFAULT 0,
    ClaimFee REAL DEFAULT 0.0,
    DedApplied REAL DEFAULT 0.0,
    InsPayEst REAL DEFAULT 0.0,
    InsPayAmt REAL DEFAULT 0.0,
    ClinicNum INTEGER DEFAULT 0,
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS claimproc (
    ClaimProcNum INTEGER PRIMARY KEY AUTOINCREMENT,
    ProcNum INTEGER NOT NULL,
    ClaimNum INTEGER DEFAULT 0,
    PatNum INTEGER NOT NULL,
    PlanNum INTEGER DEFAULT 0,
    InsPayAmt REAL DEFAULT 0.0,
    DedApplied REAL DEFAULT 0.0,
    Status INTEGER DEFAULT 0,
    DateCP DATE DEFAULT CURRENT_DATE,
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 14. API Keys & Auth
CREATE TABLE IF NOT EXISTS apikey (
    ApiKeyNum INTEGER PRIMARY KEY AUTOINCREMENT,
    KeyHash TEXT NOT NULL UNIQUE,
    ClientName TEXT NOT NULL,
    IsActive INTEGER DEFAULT 1,
    DateCreated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_patient_name ON patient(LName, FName);
CREATE INDEX IF NOT EXISTS idx_appointment_datetime ON appointment(AptDateTime);
CREATE INDEX IF NOT EXISTS idx_appointment_op ON appointment(Op, AptDateTime);
CREATE INDEX IF NOT EXISTS idx_procedurelog_pat ON procedurelog(PatNum);
CREATE INDEX IF NOT EXISTS idx_document_pat ON document(PatNum);
CREATE INDEX IF NOT EXISTS idx_recall_due ON recall(DateDue);
