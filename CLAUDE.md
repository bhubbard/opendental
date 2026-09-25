# CLAUDE.md - Open Dental on Cloudflare (`opendental-cf`)

`opendental-cf` is an edge-native serverless fork of [Open Dental](https://github.com/OpenDental/opendental), the standard dental practice management software (PMS).

Instead of requiring on-premise Windows servers, IIS, and local MySQL databases with SMB file shares, `opendental-cf` runs 100% natively on Cloudflare serverless edge primitives.

## Architecture & Primitives

- **Compute & API Routing**: Cloudflare Workers (`cloudflare/src/worker.ts`) with Hono router, HIPAA audit headers, and Open Dental REST API v1 endpoints.
- **Relational Storage**: Cloudflare D1 SQLite (`cloudflare/migrations/0001_initial_opendental_schema.sql`). Accurately models core Open Dental tables (`patient`, `appointment`, `procedurelog`, `procedurecode`, `provider`, `operatory`, `clinic`, `claim`, `recall`, `commlog`, `toothinitial`, `feesched`).
- **Real-Time State & Locking**: Cloudflare Durable Objects (`cloudflare/src/durable-objects/`):
  - `AppointmentScheduleDO`: Operatory calendar coordination, double-booking prevention, and WebSocket live broadcasting.
  - `ToothChartDO`: Real-time collaborative 32-tooth dental charting sync across chairside operatories and front desk.
- **Digital Imaging & Documents**: Cloudflare R2 (`DOCUMENTS_BUCKET`). Replaces legacy "OpenDentImages / A to Z" folder shares with secure, HIPAA-compliant object storage for digital X-rays (DICOM), intraoral photos, and PDFs.
- **Edge Cache**: Cloudflare KV (`OPENDENTAL_KV`). Caches ADA CDT procedure code lookup tables, fee schedules, and active session tokens.
- **Asynchronous Workflows**: Cloudflare Queues (`OPENDENTAL_QUEUE` / `opendental-jobs`). Asynchronous hygiene recall SMS reminders, electronic claim generation (EDI 837D), and eligibility verifications.
- **Existing MySQL Bridging**: Cloudflare Hyperdrive. Enables practices with existing on-prem or cloud MariaDB/MySQL Open Dental installations to query through Cloudflare edge pooling with zero schema changes.
- **Practice Management UI**: Cloudflare Assets (`cloudflare/public/`). Responsive multi-operatory schedule calendar, interactive 32-tooth dental chart, patient demographics, and Open Dental ShortQuery reporting console.

## Commands

```bash
# Install dependencies
npm install

# Start local emulation with Wrangler
npm run dev

# Apply D1 migrations to local emulator
npm run db:migrate:local

# Apply D1 migrations to remote Cloudflare production
npm run db:migrate:remote

# Run test suite
npm test

# Deploy to Cloudflare
npm run deploy
```

## API Specification

- `GET /health` - Health check & edge runtime status
- `GET /api/v1/info` - Practice summary & active patient count
- `GET /api/v1/patients` - Search and list patients (query: `name`, `phone`, `limit`)
- `POST /api/v1/patients` - Create patient
- `GET /api/v1/appointments?date=YYYY-MM-DD` - Operatory schedule by date
- `POST /api/v1/appointments` - Schedule appointment (with operatory conflict detection)
- `PUT /api/v1/appointments/:id` - Update status (1=Scheduled, 2=Complete, 3=Arrived, 4=In Chair)
- `GET /api/v1/procedurelogs/codes` - ADA CDT procedure code directory (cached in KV)
- `GET /api/v1/procedurelogs/logs?patNum=:id` - Patient procedure history & treatment plans
- `POST /api/v1/procedurelogs/logs` - Add treatment-planned or completed procedure
- `GET /api/v1/providers` - Providers list
- `GET /api/v1/providers/operatories` - Operatories list
- `POST /api/v1/documents/upload` - Stream upload X-Ray/document to Cloudflare R2
- `GET /api/v1/documents/:id/download` - Stream download file directly from R2
- `POST /api/v1/queries/ShortQuery` - Open Dental SQL query runner for custom reports
- `WS /ws/schedule?clinicId=:id` - WebSocket feed for real-time operatory calendar
- `WS /ws/chart/:patNum` - WebSocket feed for real-time tooth chart sync
