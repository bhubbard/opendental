-- Migration: 0003_hipaa_perio_and_insurance.sql
-- HIPAA Audit Logs, 6-Site Perio Charting, and Insurance Benefit Entities

-- 1. HIPAA Security Log & Tamper-Evident Hash Chain
CREATE TABLE IF NOT EXISTS securitylog (
    SecurityLogNum INTEGER PRIMARY KEY AUTOINCREMENT,
    PermType INTEGER NOT NULL, -- Enum: 1=AppointmentCreate, 2=AppointmentEdit, 3=PatientCreate, 4=PatientEdit, 5=ProcComplete
    UserNum INTEGER DEFAULT 1,
    LogDateTime DATETIME DEFAULT CURRENT_TIMESTAMP,
    LogText TEXT NOT NULL,
    PatNum INTEGER DEFAULT 0,
    FKey INTEGER DEFAULT 0,
    CompName TEXT DEFAULT 'Cloudflare-Worker-Edge',
    LogHash TEXT DEFAULT '',
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS securityloghash (
    SecurityLogHashNum INTEGER PRIMARY KEY AUTOINCREMENT,
    SecurityLogNum INTEGER NOT NULL,
    LogHash TEXT NOT NULL,
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Periodontal Charting (6-Site Probing, Bleeding, Suppuration, Recession)
CREATE TABLE IF NOT EXISTS perioexam (
    PerioExamNum INTEGER PRIMARY KEY AUTOINCREMENT,
    PatNum INTEGER NOT NULL,
    ExamDate DATE NOT NULL,
    ProvNum INTEGER NOT NULL,
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS periomeasure (
    PerioMeasureNum INTEGER PRIMARY KEY AUTOINCREMENT,
    PerioExamNum INTEGER NOT NULL,
    ToothNum INTEGER NOT NULL, -- 1 to 32
    SequenceType INTEGER NOT NULL, -- 0=Probing, 1=Bleeding, 2=Suppuration, 3=GingivalMargin, 4=Mobility, 5=Furcation
    -- 6 sites per tooth: Mesial-Buccal, Buccal, Distal-Buccal, Mesial-Lingual, Lingual, Distal-Lingual
    MB INTEGER DEFAULT 0,
    B INTEGER DEFAULT 0,
    DB INTEGER DEFAULT 0,
    ML INTEGER DEFAULT 0,
    L INTEGER DEFAULT 0,
    DL INTEGER DEFAULT 0,
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Insurance Plans, Carriers, and Benefits
CREATE TABLE IF NOT EXISTS carrier (
    CarrierNum INTEGER PRIMARY KEY AUTOINCREMENT,
    CarrierName TEXT NOT NULL,
    PayerID TEXT DEFAULT '',
    Phone TEXT DEFAULT '',
    Address TEXT DEFAULT '',
    City TEXT DEFAULT '',
    State TEXT DEFAULT '',
    Zip TEXT DEFAULT '',
    ElectID TEXT DEFAULT '',
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS insplan (
    PlanNum INTEGER PRIMARY KEY AUTOINCREMENT,
    GroupName TEXT DEFAULT '',
    GroupNum TEXT DEFAULT '',
    PlanType TEXT DEFAULT '', -- ''=CategoryPercentage, 'p'=PPO, 'f'=FlatCoPay, 'c'=Capitation
    CarrierNum INTEGER NOT NULL,
    FeeSchedNum INTEGER DEFAULT 1,
    CobRule INTEGER DEFAULT 0, -- 0=Basic, 1=Standard, 2=CarveOut
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patplan (
    PatPlanNum INTEGER PRIMARY KEY AUTOINCREMENT,
    PatNum INTEGER NOT NULL,
    PlanNum INTEGER NOT NULL,
    Ordinal INTEGER DEFAULT 1, -- 1=Primary, 2=Secondary, 3=Tertiary
    Relationship INTEGER DEFAULT 0, -- 0=Self, 1=Spouse, 2=Child
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS benefit (
    BenefitNum INTEGER PRIMARY KEY AUTOINCREMENT,
    PlanNum INTEGER NOT NULL,
    PatPlanNum INTEGER DEFAULT 0,
    CovCatNum INTEGER DEFAULT 0, -- 0=General, 1=Diagnostic, 2=Preventive, 3=Restorative, 4=Endodontic, 5=Periodontic, 6=Major
    BenefitType INTEGER DEFAULT 1, -- 1=Percentage, 2=CoPay, 3=Deductible, 4=Limitation
    Percent INTEGER DEFAULT 0,
    MonetaryAmt REAL DEFAULT 0.0,
    TimePeriod INTEGER DEFAULT 1, -- 1=CalendarYear, 2=Lifetime
    Quantity INTEGER DEFAULT 0,
    DateTStamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed Default Carrier and Benefits
INSERT INTO carrier (CarrierNum, CarrierName, PayerID, Phone, City, State, ElectID)
VALUES 
(1, 'Delta Dental of California', '92011', '800-765-6003', 'San Francisco', 'CA', '00431'),
(2, 'MetLife Dental', '65978', '800-942-0854', 'New York', 'NY', '00120');

INSERT INTO insplan (PlanNum, GroupName, GroupNum, PlanType, CarrierNum, FeeSchedNum)
VALUES 
(1, 'Google Dental PPO Plan', 'GOOG-8821', 'p', 1, 1),
(2, 'Apple Inc Comprehensive', 'AAPL-4412', 'p', 2, 1);

INSERT INTO patplan (PatPlanNum, PatNum, PlanNum, Ordinal, Relationship)
VALUES (1, 1, 1, 1, 0); -- Jane Doe has Primary Google Dental PPO

INSERT INTO benefit (PlanNum, CovCatNum, BenefitType, Percent, MonetaryAmt) VALUES
(1, 0, 3, 0, 50.0),    -- $50 General Annual Deductible
(1, 0, 4, 0, 1500.0),  -- $1,500 Annual Maximum
(1, 2, 1, 100, 0.0),   -- 100% Preventive
(1, 3, 1, 80, 0.0),    -- 80% Basic / Restorative
(1, 6, 1, 50, 0.0);    -- 50% Major (Crowns, Bridges)
