# Open Dental on Cloudflare (`opendental-cf`) 🦷☁️

> High-performance, edge-native serverless fork of [Open Dental](https://github.com/OpenDental/opendental): Dental Practice Management Software (PMS) running on Cloudflare Workers, D1, Durable Objects, R2, KV, and Queues.

[![CI](https://github.com/bhubbard/opendental/actions/workflows/ci.yml/badge.svg)](https://github.com/bhubbard/opendental/actions/workflows/ci.yml)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020.svg?logo=cloudflare)](https://workers.cloudflare.com)
[![Cloudflare D1](https://img.shields.io/badge/Storage-D1%20SQLite-blue.svg)](https://developers.cloudflare.com/d1/)
[![Cloudflare R2](https://img.shields.io/badge/Imaging-R2%20Bucket-orange.svg)](https://developers.cloudflare.com/r2/)
[![Durable Objects](https://img.shields.io/badge/Sync-Durable%20Objects-purple.svg)](https://developers.cloudflare.com/durable-objects/)

---

## Overview

Traditional Open Dental installations require dedicated on-premise Windows servers, local IIS instances, manual MySQL/MariaDB database maintenance, and SMB file shares for digital X-rays and documents ("OpenDentImages / A to Z folders").

`opendental-cf` re-architects Open Dental from the ground up for the Cloudflare serverless edge:

| Feature / Requirement | Traditional Open Dental | Open Dental on Cloudflare (`opendental-cf`) |
| :--- | :--- | :--- |
| **Hosting & Compute** | On-premise Windows Server / IIS | **Cloudflare Workers** (Global low-latency edge) |
| **Relational Database** | Local MySQL / MariaDB server | **Cloudflare D1** (Serverless distributed SQLite) |
| **Existing MySQL Bridging** | Direct connection or VPN | **Cloudflare Hyperdrive** (Connection pooling & cache) |
| **Real-Time Calendar Sync** | MySQL polling / ServiceManager | **Cloudflare Durable Objects** (`AppointmentScheduleDO`) |
| **Dental Charting State** | Local desktop rendering | **Cloudflare Durable Objects** (`ToothChartDO` + WebSockets) |
| **X-Rays & Imaging** | Network folder share (A to Z folder) | **Cloudflare R2** (`DOCUMENTS_BUCKET` HIPAA-ready object store) |
| **Hardware Dental Sensor Bridge**| Local USB / TWAIN desktop driver | **Edge Sensor Ingestion & Web DICOM** (16-to-8 bit windowing) |
| **Payment Processing** | PayConnect / PaySimple desktop | **Stripe Terminal & Automated PaySplit** (tamper-evident hash) |
| **Electronic Prescriptions** | DoseSpot / NewCrop WinForms | **eRx & EPCS Dual-Auth** (DEA § 1311.115 & DoseSpot SSO) |
| **Insurance Adjudication** | Clearinghouse desktop batch | **ANSI X12 837D & ERA 835 Auto-Posting** |
| **Patient Intake & Forms** | Paper or local kiosk | **eClipboard Web Forms** (Canvas digital signature capture) |
| **Public Online Booking** | WebSched desktop relay | **WebSched Edge Booking** (Cloudflare Turnstile protected) |
| **Hospital / EMR Integration**| Windows HL7 service | **HL7 v2 ADT / SIU Edge Receiver** |
| **Fee Schedule & CDT Lookups** | Repeated SQL joins | **Cloudflare KV** (`OPENDENTAL_KV` sub-millisecond edge cache) |
| **Recalls & Claims Background**| Windows Task Scheduler / Service | **Cloudflare Queues** (`OPENDENTAL_QUEUE` async workers) |
| **Client UI** | Windows Desktop (.NET WinForms) | **Cloudflare Assets Web App** (iPad, Mac, Web browser) |

---

## Cloudflare Edge Architecture

```text
Browsers / Tablets / Operatories / 3rd-Party APIs / Hardware Bridges
                               │
                               ▼
                Cloudflare Workers (Hono Router)
      ├─ CORS & HIPAA Tamper-Evident Audit Logging (SHA-256)
      ├─ Open Dental REST API v1 (/api/v1/*)
      ├─ Web DICOM & Sensor Bridge (/api/v1/imaging/*)
      ├─ EMV Terminal & PaySplit Ledger (/api/v1/payments/*)
      ├─ eRx & EPCS Dual-Auth (/api/v1/erx/*)
      ├─ Claims & ERA 835 Auto-Posting (/api/v1/claims/*)
      ├─ eClipboard Intake Forms (/api/v1/sheets/*)
      ├─ WebSched Online Booking (/api/v1/websched/*)
      ├─ HL7 v2 ADT/SIU Interface (/api/v1/hl7/*)
      ├─ ONC FHIR R4 API (/fhir/r4/*)
      ├─ ShortQuery SQL Engine (/api/v1/queries/ShortQuery)
      └─ WebSockets (/ws/schedule, /ws/chart)
                               │
      ┌──────────────┬─────────┴────┬──────────────┬──────────────┐
      ▼              ▼              ▼              ▼              ▼
Cloudflare D1  Durable Objects  Cloudflare R2  Cloudflare KV  Queues
(Relational)   (Locking & Sync) (DICOM / Docs) (CDT Cache)    (Recalls/Claims)
```

---

## Getting Started

### Prerequisites

- Node.js 20+ or [Bun](https://bun.sh)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

### 1. Installation

```bash
git clone git@github.com:bhubbard/opendental.git
cd opendental-cf

# Install dependencies with Bun
bun install
```

### 2. Apply D1 Database Migrations

Apply the Open Dental table schemas and initial demo seeds (clinic, providers, operatories, ADA CDT codes, periodontal chart, and payments/imaging):

```bash
# Apply migrations locally
bunx wrangler d1 migrations apply DB --local

# Or apply to remote Cloudflare D1 production
bunx wrangler d1 migrations apply DB --remote
```

### 3. Start Local Edge Development Server

```bash
bun run dev
```

Open `http://localhost:8787` in your browser to access the Practice Management UI!

---

## Testing & Verification

The test suite runs against [Vitest](https://vitest.dev/) with 48 tests ported directly from the upstream Open Dental C# unit test framework (`UnitTests/UnitTests/*.cs`):

```bash
# Run all tests
bun run test

# Type-check TypeScript code
bun run typecheck
```

### Test Coverage Highlights:
- **`patients.test.ts`**: Port of `PatientsTests.cs` (search, creation, duplicate detection, formatting)
- **`appointments.test.ts`**: Port of `AppointmentsTests.cs` (scheduling, operatory assignment, time pattern)
- **`procedures.test.ts`**: Port of `ProceduresTests.cs` (CDT code assignment, tooth surfaces, status transitions)
- **`claims.test.ts`**: Port of `ClaimsTests.cs` (deductibles, annual maximum caps, coinsurance calculations)
- **`security.test.ts`**: Port of `SecurityTests.cs` (HIPAA tamper-evident SHA-256 base64 hash chaining)
- **`hipaa-perio-fhir.test.ts`**: 6-site periodontal probing (MB/B/DB/ML/L/DL), bleeding indices, and ONC FHIR R4 Patient/Coverage resources
- **`imaging.test.ts`**: Port of `BitmapDicom.cs` 16-bit to 8-bit windowing algorithm, invert contrast, and Dexis/Schick/Romexis/XVWeb bridges
- **`payments.test.ts`**: Port of `Payment.cs` and `PaySplit.cs` automated procedure distribution, SHA-256 `SecurityHash`, and patient ledger balances
- **`erx.test.ts`**: Port of `DoseSpot.cs` 32-character SHA-512 SSO hash generation, drug allergy checks, and DEA EPCS § 1311.115 dual-factor authentication
- **`era835-sheets-websched-hl7.test.ts`**: Port of `X835.cs` remittance advice auto-posting, eClipboard sheets, WebSched booking, and HL7 v2 ADT/SIU messaging

---

## Upstream Compatibility & Porting Matrix

| Domain | Upstream Open Dental C# | Cloudflare Edge Implementation | Status |
| :--- | :--- | :--- | :--- |
| Core Practice Entities | `OpenDentBusiness/TableTypes/` | Cloudflare D1 SQL Schema (`migrations/0001` - `0004`) | ✅ Complete |
| Calendar Synchronization | `OpenDentBusiness/Appointments.cs` | Cloudflare Durable Objects (`AppointmentScheduleDO`) | ✅ Complete |
| Tooth Charting | `SparksToothChart/` | Cloudflare Durable Objects (`ToothChartDO`) | ✅ Complete |
| Dental Radiographs | `OpenDentBusiness/Imaging/BitmapDicom.cs` | Cloudflare R2 + Web DICOM Windowing API | ✅ Complete |
| Practice Bridges | `WpfControlsOD/Bridges/` | `imagingRoutes.get("/bridges/:bridgeName/patient/:PatNum")` | ✅ Complete |
| Payment Processing | `OpenDentBusiness/Payment.cs`, `PaySplit.cs`| `paymentRoutes.post("/charge")` + Auto PaySplit | ✅ Complete |
| eRx & EPCS Prescribing | `OpenDentBusiness/WebBridges/Erx/DoseSpot.cs`| `erxRoutes.post("/prescribe")` + DEA Dual-Auth | ✅ Complete |
| Claims & EDI 837D | `OpenDentBusiness/X12/X837_5010.cs` | ANSI ASC X12 837D Generator (`utils/edi837d.ts`) | ✅ Complete |
| Remittance & ERA 835 | `OpenDentBusiness/X12/X835.cs` | ANSI ASC X12 835 Auto-Posting Parser | ✅ Complete |
| eClipboard & Sheets | `OpenDentBusiness/SheetFramework/` | Digital Web Intake + Signature Canvas Capture | ✅ Complete |
| WebSched Online Booking | `OpenDentBusiness/WebTypes/WebSched/` | Conflict-checking + Cloudflare Turnstile API | ✅ Complete |
| HL7 v2 Hospital Feed | `OpenDentBusiness/HL7/` | ADT A04/A08 & SIU S12 Parser + ACK Generator | ✅ Complete |
| HIPAA Audit Trail | `OpenDentBusiness/SecurityLogHash.cs` | Tamper-evident SHA-256 Base64 Chain | ✅ Complete |
| Periodontal Charting | `OpenDentBusiness/PerioExam.cs` | 6-site probing and bleeding indices | ✅ Complete |
| ONC Interoperability | FHIR R4 standard | `/fhir/r4/Patient` and `/fhir/r4/Coverage` | ✅ Complete |
| SQL ShortQuery Engine | `OpenDentBusiness/Reports/` | Restricted SELECT Query Engine (`/queries/ShortQuery`) | ✅ Complete |

---

## License

This project is released under the GNU General Public License v2 (GPL-2.0), consistent with upstream Open Dental.