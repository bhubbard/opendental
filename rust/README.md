# Open Dental in Rust (`opendental-rs`) 🦷🦀

> High-performance, memory-safe, zero-cost-abstraction Rust implementation of [Open Dental](https://github.com/OpenDental/opendental) Practice Management Software (PMS).

[![Rust](https://img.shields.io/badge/Language-Rust%202021-orange.svg?logo=rust)](https://www.rust-lang.org)
[![License: GPL v2](https://img.shields.io/badge/License-GPL%20v2-blue.svg)](LICENSE)

---

## Features Ported from Upstream Open Dental

| System / Subsystem | Upstream C# Reference | Rust Module | Description |
| :--- | :--- | :--- | :--- |
| **Core Practice Repository** | `OpenDentBusiness/Data Interface/` | `opendental::PracticeRepository` | In-memory / transactional practice state with conflict checking |
| **Patient Demographics** | `TableTypes/Patient.cs` | `opendental::models::Patient` | Full patient demographic record matching schema |
| **Operatory Scheduling** | `TableTypes/Appointment.cs` | `opendental::models::Appointment` | Operatory assignment, time locking, collision detection |
| **Procedure Logging** | `TableTypes/ProcedureLog.cs` | `opendental::models::ProcedureLog` | Treatment planning (status 1) and completion (status 2) |
| **Insurance Adjudication** | `ClaimProcs.ComputeEstimates.cs` | `opendental::engine::claims` | Deductibles, coverage %, annual max caps, patient portions |
| **ANSI ASC X12 837D Claims**| `X12/X837_5010.cs` | `opendental::engine::x12::generate_edi_837d` | Dental 837D EDI transaction generation |
| **ANSI ASC X12 835 Remittance**| `Eclaims/X835.cs` | `opendental::engine::x12::parse_x12_835` | ERA EOB parsing and automatic claim payment adjudication |
| **Hardware Dental Bridges** | `WpfControlsOD/Bridges/` | `opendental::engine::imaging` | Native launch URIs for DEXIS, Schick, Carestream, Romexis, XVWeb |
| **DICOM Radiograph Windowing** | `Imaging/BitmapDicom.cs` | `opendental::engine::imaging::apply_windowing`| 16-bit to 8-bit grayscale mapping with bone/enamel contrast inversion |
| **Payment Ledger & PaySplits**| `TableTypes/PaySplit.cs` | `opendental::engine::payments` | Automated procedure line-item allocation, unearned prepayment, and balance tracking |
| **Tamper-Evident PaySplit Hash**| `TableTypes/PaySplit.cs:59` | `opendental::engine::payments::compute_paysplit_security_hash` | Salted SHA-256 hash chaining |
| **eRx & EPCS Prescribing** | `WebBridges/Erx/DoseSpot.cs` | `opendental::engine::erx` | DEA § 1311.115 dual-factor authentication, cryptographic signatures, NPI/DEA validation |
| **DoseSpot SSO Integration** | `DoseSpot.cs:CreateSsoCode` | `opendental::engine::erx::create_dosespot_sso_codes` | 32-char random UTF-8 phrase + SHA-512 Base64 hashing |
| **eClipboard Intake Sheets** | `SheetFramework/` | `opendental::engine::sheets` | Digital intake questionnaire and signature capture |
| **WebSched Online Booking** | `WebTypes/WebSched/` | `opendental::engine::websched` | Availability slot calculation with collision filtering |
| **HL7 v2 Messaging** | `HL7/MessageParser.cs` | `opendental::engine::hl7` | ADT (A04/A08) and SIU (S12) parser with standard `MSA|AA` ACK |
| **6-Site Periodontal Charting**| `TableTypes/PerioMeasure.cs` | `opendental::engine::perio` | 6 sites per tooth (MB, B, DB, ML, L, DL), pocket depth & bleeding indices |
| **HIPAA Security Audit** | `TableTypes/SecurityLogHash.cs` | `opendental::engine::security` | Tamper-evident SHA-256 Base64 hash chain |
| **ONC FHIR R4 Mapping** | ONC FHIR specification | `opendental::engine::fhir` | Native FHIR R4 Patient resource JSON serialization |

---

## Building & Testing

```bash
cd rust

# Run all 34 unit and integration tests
cargo test

# Build and run the CLI runner
cargo run

# Build optimized release binary
cargo build --release
```

---

## Test Verification

The test suite runs 34 tests directly testing every engine and subsystem:
```text
running 24 tests in src/lib.rs ... ok
running 1 test in tests/appointments_test.rs ... ok
running 2 tests in tests/claims_test.rs ... ok
running 1 test in tests/era835_hl7_test.rs ... ok
running 1 test in tests/erx_test.rs ... ok
running 1 test in tests/imaging_test.rs ... ok
running 1 test in tests/patients_test.rs ... ok
running 1 test in tests/payments_test.rs ... ok
running 1 test in tests/procedures_test.rs ... ok
running 1 test in tests/security_test.rs ... ok

test result: ok. 34 passed; 0 failed; 0 ignored; finished in 1.43s
```
