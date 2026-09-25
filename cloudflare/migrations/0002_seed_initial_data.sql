-- Migration: 0002_seed_initial_data.sql
-- Seed Initial Clinic, Providers, Operatories, CDT Codes, and Demo Patients

-- 1. Clinic
INSERT INTO clinic (ClinicNum, Description, Address, City, State, Zip, Phone, Email)
VALUES (1, 'BB Dental Care - Main Practice', '201 N Brand Blvd Ste 200', 'Glendale', 'CA', '91203', '818-555-0199', 'info@bbdental.test');

-- 2. Providers
INSERT INTO provider (ProvNum, Abbr, ItemOrder, LName, FName, MI, Suffix, Specialty, StateLicense, ProvColor, NationalProvID)
VALUES 
(1, 'DRB', 1, 'Hubbard', 'Brandon', '', 'DDS', 0, 'CA-DDS-89211', -16744272, '1295819201'),
(2, 'HYG', 2, 'Jenkins', 'Sarah', 'M', 'RDH', 1, 'CA-RDH-44102', -65281, '1982736154');

-- 3. Operatories
INSERT INTO operatory (OperatoryNum, OpName, Abbr, ItemOrder, ProvDentist, ProvHygienist, ClinicNum)
VALUES 
(1, 'Operatory 1 - Hygiene', 'Op 1', 1, 1, 2, 1),
(2, 'Operatory 2 - Restorative', 'Op 2', 2, 1, 0, 1),
(3, 'Operatory 3 - Oral Surgery', 'Op 3', 3, 1, 0, 1),
(4, 'Operatory 4 - Orthodontics', 'Op 4', 4, 1, 0, 1);

-- 4. Fee Schedule
INSERT INTO feesched (FeeSchedNum, Description, FeeSchedType)
VALUES (1, 'Standard UCR Office Fees', 1);

-- 5. Standard ADA CDT Procedure Codes
INSERT INTO procedurecode (CodeNum, ProcCode, Descript, AbbrDesc, ProcCat, TreatArea, ProcTime) VALUES
(1, 'D0120', 'Periodic oral evaluation - established patient', 'Exam-Per', 1, 3, '/X/'),
(2, 'D0150', 'Comprehensive oral evaluation - new or established patient', 'Exam-Comp', 1, 3, '/XX/'),
(3, 'D0210', 'Intraoral - comprehensive series of radiographic images', 'FMX', 1, 3, '/X/'),
(4, 'D0274', 'Bitewings - four radiographic images', 'BW4', 1, 3, '/X/'),
(5, 'D1110', 'Prophylaxis - adult', 'Prophy-Ad', 2, 3, '/X/'),
(6, 'D1206', 'Topical application of fluoride varnish', 'Fluoride', 2, 3, '//'),
(7, 'D2140', 'Amalgam - one surface, primary or permanent', 'Amalg-1S', 3, 1, '/X/'),
(8, 'D2391', 'Resin-based composite - one surface, posterior', 'Comp-1S', 3, 1, '/XX/'),
(9, 'D2392', 'Resin-based composite - two surfaces, posterior', 'Comp-2S', 3, 1, '/XX/'),
(10, 'D2740', 'Crown - porcelain/ceramic substrate', 'Crown-Porc', 6, 2, '/XXX/'),
(11, 'D3330', 'Endodontic therapy, molar tooth (excluding final restoration)', 'RCT-Molar', 4, 2, '/XXXX/'),
(12, 'D4341', 'Periodontal scaling and root planing - four or more teeth per quadrant', 'SRP-Quad', 5, 4, '/XX/'),
(13, 'D7140', 'Extraction, erupted tooth or exposed root', 'Extract', 7, 2, '/XX/'),
(14, 'D9110', 'Palliative treatment of dental pain - minor procedure', 'Palliative', 1, 3, '/X/');

-- Fee amounts
INSERT INTO fee (Amount, FeeSchedNum, CodeNum) VALUES
(65.0, 1, 1),
(110.0, 1, 2),
(165.0, 1, 3),
(85.0, 1, 4),
(105.0, 1, 5),
(45.0, 1, 6),
(175.0, 1, 7),
(220.0, 1, 8),
(285.0, 1, 9),
(1350.0, 1, 10),
(1250.0, 1, 11),
(295.0, 1, 12),
(210.0, 1, 13),
(125.0, 1, 14);

-- 6. Initial Patients
INSERT INTO patient (PatNum, LName, FName, MiddleI, Preferred, PatStatus, Gender, Position, Birthdate, SSN, Address, City, State, Zip, WirelessPhone, Email, PriProv, ClinicNum)
VALUES 
(1, 'Doe', 'Jane', 'A', 'Jane', 0, 1, 1, '1990-05-14', '987654321', '456 Oak Avenue', 'Glendale', 'CA', '91204', '818-555-1212', 'jane.doe@example.com', 1, 1),
(2, 'Smith', 'John', 'E', 'Johnny', 0, 0, 0, '1985-11-23', '123456789', '789 Maple Drive', 'Burbank', 'CA', '91501', '818-555-8844', 'john.smith@example.com', 1, 1),
(3, 'Rodriguez', 'Elena', '', 'Elena', 0, 1, 1, '1998-03-08', '456123789', '101 Glenoaks Blvd', 'Glendale', 'CA', '91202', '818-555-9090', 'elena.rodriguez@example.com', 1, 1);

-- 7. Appointments for Today (Dynamic date format string YYYY-MM-DD)
INSERT INTO appointment (AptNum, PatNum, AptStatus, Pattern, Op, Note, ProvNum, ProvHyg, AptDateTime, ProcDescript, ClinicNum, IsHygiene)
VALUES 
(1, 1, 1, '/XX/', 1, 'Periodic recall and cleaning', 1, 2, datetime('now', 'start of day', '+9 hours'), 'D0120, D1110, D0274', 1, 1),
(2, 2, 1, '/XXX/', 2, 'Tooth #19 Crown Prep', 1, 0, datetime('now', 'start of day', '+10 hours', '+30 minutes'), 'D2740', 1, 0),
(3, 3, 1, '/XX/', 3, 'Emergency toothache evaluation', 1, 0, datetime('now', 'start of day', '+13 hours'), 'D9110, D0220', 1, 0);

-- 8. Existing & Planned Procedures
INSERT INTO procedurelog (ProcNum, PatNum, AptNum, CodeNum, ProcDate, ProcFee, Surf, ToothNum, ProcStatus, ProvNum, ClinicNum)
VALUES 
(1, 1, 1, 1, date('now'), 65.0, '', '', 1, 1, 1),
(2, 1, 1, 5, date('now'), 105.0, '', '', 1, 2, 1),
(3, 2, 2, 10, date('now'), 1350.0, 'MOD', '19', 1, 1, 1),
(4, 2, 0, 8, date('now', '-30 days'), 220.0, 'DO', '14', 2, 1, 1); -- Completed prior restoration

-- 9. Initial Tooth Chart States (Tooth #1 missing, #16 missing, #17 wisdom tooth missing)
INSERT INTO toothinitial (ToothInitialNum, PatNum, ToothNum, InitialType, ColorAndComment)
VALUES 
(1, 1, '1', 0, 'Extracted wisdom tooth'),
(2, 1, '16', 0, 'Congenitally missing'),
(3, 2, '17', 0, 'Surgically removed');

-- 10. Sample API Key ("test-key-12345" SHA-256 hash)
INSERT INTO apikey (ApiKeyNum, KeyHash, ClientName, IsActive)
VALUES (1, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'Default Local Client', 1);
