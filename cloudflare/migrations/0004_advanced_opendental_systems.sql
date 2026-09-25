-- Migration: 0004_advanced_opendental_systems.sql
-- Dental Sensor Imaging/DICOM, Payments/PaySplits/Ledger, eRx/EPCS, Sheets/eClipboard, ERA 835, WebSched & HL7

-- 1. Hardware Imaging, DICOM Studies, Mounts
CREATE TABLE IF NOT EXISTS imagingdevice (
    ImagingDeviceNum INTEGER PRIMARY KEY AUTOINCREMENT,
    DeviceName TEXT NOT NULL,
    DeviceType TEXT NOT NULL, -- 'Sensor', 'PhosphorPlate', 'PanCeph', 'IntraoralCamera'
    ComputerName TEXT DEFAULT 'Cloud-Station-1',
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mount (
    MountNum INTEGER PRIMARY KEY AUTOINCREMENT,
    PatNum INTEGER NOT NULL,
    DocCategory INTEGER DEFAULT 1,
    DateCreated DATETIME DEFAULT CURRENT_TIMESTAMP,
    Description TEXT DEFAULT 'Full Mouth Series (FMX)',
    Note TEXT DEFAULT '',
    ImgType INTEGER DEFAULT 0,
    Width INTEGER DEFAULT 1600,
    Height INTEGER DEFAULT 1200,
    ColorBackGround INTEGER DEFAULT -16777216, -- Black
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mountitem (
    MountItemNum INTEGER PRIMARY KEY AUTOINCREMENT,
    MountNum INTEGER NOT NULL,
    Xpos INTEGER DEFAULT 0,
    Ypos INTEGER DEFAULT 0,
    Ordinal INTEGER DEFAULT 1,
    ToothNumbers TEXT DEFAULT '', -- e.g. "1,2,3" or "BW"
    ItemOrder INTEGER DEFAULT 0,
    DocNum INTEGER DEFAULT 0,
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dicomstudy (
    StudyNum INTEGER PRIMARY KEY AUTOINCREMENT,
    DocNum INTEGER NOT NULL,
    PatNum INTEGER NOT NULL,
    StudyInstanceUID TEXT NOT NULL,
    SeriesInstanceUID TEXT NOT NULL,
    SOPInstanceUID TEXT NOT NULL,
    Modality TEXT DEFAULT 'DX', -- DX=Digital Radiography, IO=Intraoral, PX=Panoramic
    BodyPartExamined TEXT DEFAULT 'JAW',
    KVP REAL DEFAULT 65.0,
    ExposureTimeMs INTEGER DEFAULT 120,
    XRayTubeCurrentMA REAL DEFAULT 7.0,
    PhotometricInterpretation TEXT DEFAULT 'MONOCHROME2',
    Rows INTEGER DEFAULT 1024,
    Columns INTEGER DEFAULT 1024,
    BitsAllocated INTEGER DEFAULT 16,
    BitsStored INTEGER DEFAULT 12,
    WindowCenter INTEGER DEFAULT 2048,
    WindowWidth INTEGER DEFAULT 4096,
    ToothNumbers TEXT DEFAULT '',
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Patient Ledger, Payments, PaySplits, and Terminals
CREATE TABLE IF NOT EXISTS payment (
    PayNum INTEGER PRIMARY KEY AUTOINCREMENT,
    PayType INTEGER DEFAULT 1, -- FK to definition: 1=Check, 2=Cash, 3=CreditCard, 4=Electronic
    PayDate DATE NOT NULL,
    PayAmt REAL NOT NULL,
    CheckNum TEXT DEFAULT '',
    BankBranch TEXT DEFAULT '',
    PayNote TEXT DEFAULT '',
    IsSplit INTEGER DEFAULT 1,
    PatNum INTEGER NOT NULL,
    ClinicNum INTEGER DEFAULT 0,
    DateEntry DATETIME DEFAULT CURRENT_TIMESTAMP,
    DepositNum INTEGER DEFAULT 0,
    Receipt TEXT DEFAULT '',
    PaymentSource INTEGER DEFAULT 0, -- 0=None, 1=PayConnect, 2=PaySimple, 3=EdgeExpress, 4=StripeTerminal
    ProcessStatus INTEGER DEFAULT 0,
    ExternalId TEXT DEFAULT '',
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS paysplit (
    SplitNum INTEGER PRIMARY KEY AUTOINCREMENT,
    SplitAmt REAL NOT NULL,
    PatNum INTEGER NOT NULL,
    ProcDate DATE DEFAULT CURRENT_DATE,
    PayNum INTEGER NOT NULL,
    ProvNum INTEGER NOT NULL,
    PayPlanNum INTEGER DEFAULT 0,
    DatePay DATE NOT NULL,
    ProcNum INTEGER DEFAULT 0, -- 0=Unearned/Prepayment, >0=Specific procedure paid
    DateEntry DATETIME DEFAULT CURRENT_TIMESTAMP,
    UnearnedType INTEGER DEFAULT 0, -- 0=None, 1=Prepayment
    ClinicNum INTEGER DEFAULT 0,
    SecUserNumEntry INTEGER DEFAULT 1,
    SecurityHash TEXT DEFAULT '', -- Salted SHA-256 hash of PatNum, SplitAmt, DateEntry
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS creditcard (
    CreditCardNum INTEGER PRIMARY KEY AUTOINCREMENT,
    PatNum INTEGER NOT NULL,
    Address TEXT DEFAULT '',
    Zip TEXT DEFAULT '',
    CCNumberMasked TEXT NOT NULL, -- e.g. "************4242"
    CCExpiration DATE,
    ItemOrder INTEGER DEFAULT 0,
    ChargeAmt REAL DEFAULT 0.0,
    Token TEXT NOT NULL,
    CCSource INTEGER DEFAULT 4, -- 4=Stripe / Edge Terminal
    ClinicNum INTEGER DEFAULT 0,
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS claimpayment (
    ClaimPaymentNum INTEGER PRIMARY KEY AUTOINCREMENT,
    CheckDate DATE NOT NULL,
    CheckAmt REAL NOT NULL,
    CheckNum TEXT DEFAULT '',
    BankBranch TEXT DEFAULT '',
    Note TEXT DEFAULT '',
    ClinicNum INTEGER DEFAULT 0,
    DepositNum INTEGER DEFAULT 0,
    CarrierName TEXT DEFAULT '',
    DateIssued DATE,
    IsPartial INTEGER DEFAULT 0,
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS etrans835 (
    Etrans835Num INTEGER PRIMARY KEY AUTOINCREMENT,
    ClaimNum INTEGER DEFAULT 0,
    ClaimPaymentNum INTEGER DEFAULT 0,
    PayerName TEXT NOT NULL,
    PayerID TEXT DEFAULT '',
    CheckOrEFTTrace TEXT DEFAULT '',
    CheckAmt REAL DEFAULT 0.0,
    PaidDate DATE NOT NULL,
    Status TEXT DEFAULT 'Processed',
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Electronic Prescriptions (eRx & EPCS DEA Audit Trail)
CREATE TABLE IF NOT EXISTS erxlog (
    ErxLogNum INTEGER PRIMARY KEY AUTOINCREMENT,
    PatNum INTEGER NOT NULL,
    MsgText TEXT NOT NULL,
    ProvNum INTEGER NOT NULL,
    UserNum INTEGER DEFAULT 1,
    DeaSchedule TEXT DEFAULT 'None', -- 'Schedule II', 'Schedule III', 'Schedule IV', 'Schedule V', 'None'
    EpcsSignature TEXT DEFAULT '', -- Digital SHA-256 signature / 2FA dual-auth audit token
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rxalert (
    RxAlertNum INTEGER PRIMARY KEY AUTOINCREMENT,
    DrugName TEXT NOT NULL,
    AllergyTrigger TEXT DEFAULT '',
    DiseaseTrigger TEXT DEFAULT '',
    Severity TEXT DEFAULT 'High', -- 'High', 'Moderate', 'Contraindication'
    Notification TEXT NOT NULL,
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed Known Dental Drug Allergy Triggers
INSERT INTO rxalert (DrugName, AllergyTrigger, Severity, Notification) VALUES
('Amoxicillin 500mg', 'Penicillin', 'Contraindication', 'Patient has recorded Penicillin allergy! Severe anaphylaxis risk.'),
('Augmentin 875mg', 'Penicillin', 'Contraindication', 'Cross-reactivity with Penicillin allergy.'),
('Vicodin (Hydrocodone/APAP 5/300)', 'Codeine', 'High', 'Patient has listed Opioid/Codeine sensitivity.');

-- 4. Dynamic Forms, Sheets & eClipboard
CREATE TABLE IF NOT EXISTS sheet (
    SheetNum INTEGER PRIMARY KEY AUTOINCREMENT,
    SheetType INTEGER NOT NULL, -- 1=PatientForm, 2=MedicalHistory, 3=Consent, 4=Referral
    PatNum INTEGER NOT NULL,
    DateTimeSheet DATETIME DEFAULT CURRENT_TIMESTAMP,
    Description TEXT NOT NULL,
    IsWebForm INTEGER DEFAULT 1,
    SignedStatus INTEGER DEFAULT 0, -- 0=Pending, 1=Signed
    SignatureData TEXT DEFAULT '',
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sheetfield (
    SheetFieldNum INTEGER PRIMARY KEY AUTOINCREMENT,
    SheetNum INTEGER NOT NULL,
    FieldType INTEGER NOT NULL, -- 1=InputField, 2=CheckBox, 3=Signature, 4=StaticText
    FieldName TEXT NOT NULL,
    FieldValue TEXT DEFAULT '',
    XPos INTEGER DEFAULT 0,
    YPos INTEGER DEFAULT 0,
    Width INTEGER DEFAULT 200,
    Height INTEGER DEFAULT 30,
    IsRequired INTEGER DEFAULT 0,
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. WebSched Online Booking & Turnstile Verification
CREATE TABLE IF NOT EXISTS webschedslot (
    SlotNum INTEGER PRIMARY KEY AUTOINCREMENT,
    OpNum INTEGER NOT NULL,
    ProvNum INTEGER NOT NULL,
    DateTimeStart DATETIME NOT NULL,
    DateTimeEnd DATETIME NOT NULL,
    IsBooked INTEGER DEFAULT 0,
    PatNum INTEGER DEFAULT 0,
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. HL7 Integration Messaging Log
CREATE TABLE IF NOT EXISTS hl7msg (
    HL7MsgNum INTEGER PRIMARY KEY AUTOINCREMENT,
    MsgType TEXT NOT NULL, -- 'ADT^A08', 'SIU^S12', 'DFT^P03'
    ControlID TEXT NOT NULL,
    PatNum INTEGER DEFAULT 0,
    AptNum INTEGER DEFAULT 0,
    HL7Status TEXT DEFAULT 'Received',
    MsgBody TEXT NOT NULL,
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
