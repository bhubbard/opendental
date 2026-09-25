# Open Dental on Cloudflare (`opendental-cf`) 🦷☁️

> High-performance, edge-native serverless fork of [Open Dental](https://github.com/OpenDental/opendental): Dental Practice Management Software (PMS) running on Cloudflare Workers, D1, Durable Objects, R2, KV, and Queues.

[![CI](https://github.com/bhubbard/opendental-cf/actions/workflows/ci.yml/badge.svg)](https://github.com/bhubbard/opendental-cf/actions/workflows/ci.yml)
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
| **Fee Schedule & CDT Lookups** | Repeated SQL joins | **Cloudflare KV** (`OPENDENTAL_KV` sub-millisecond edge cache) |
| **Recalls & Claims Background** | Windows Task Scheduler / Service | **Cloudflare Queues** (`OPENDENTAL_QUEUE` async workers) |
| **Client UI** | Windows Desktop (.NET WinForms) | **Cloudflare Assets Web App** (iPad, Mac, Web browser) |

---

## Cloudflare Edge Architecture

```text
Browsers / Tablets / Operatories / 3rd-Party APIs
                    │
                    ▼
     Cloudflare Workers (Hono Router)
     ├─ CORS & HIPAA Audit Logging
     ├─ Open Dental REST API v1 (/api/v1/*)
     ├─ ShortQuery SQL Engine (/api/v1/queries/ShortQuery)
     └─ WebSockets (/ws/schedule, /ws/chart)
                    │
     ┌──────────────┼──────────────┬──────────────┬──────────────┐
     ▼              ▼              ▼              ▼              ▼
Cloudflare D1  Durable Objects  Cloudflare R2  Cloudflare KV  Queues
(Relational)   (Locking & Sync) (X-Rays/Docs)  (CDT Cache)    (Recalls/Claims)
```

---

## Getting Started

### Prerequisites

- Node.js 20+ or [Bun](https://bun.sh)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

### 1. Installation

```bash
git clone git@github.com:bhubbard/opendental-cf.git
cd opendental-cf

# Install dependencies with Bun
bun install
```

### 2. Apply D1 Database Migrations

Apply the Open Dental table schemas and initial demo seeds (clinic, providers, operatories, and ADA CDT codes):

```bash
# Apply to local emulator
bun run db:migrate:local

# Or apply to remote Cloudflare D1 production
bun run db:migrate:remote
```

### 3. Start Local Edge Development Server

```bash
bun run dev
```

Open `http://localhost:8787` in your browser to access the Practice Management UI!

---

## Core API Endpoints

All endpoints are fully compliant with the standard Open Dental REST API v1 specification:

- `GET /health` — Edge runtime status and health check
- `GET /api/v1/info` — Practice information and active patient counts
- `GET /api/v1/patients` — Search and list patients (`?name=...&phone=...`)
- `POST /api/v1/patients` — Create new patient record
- `GET /api/v1/appointments?date=YYYY-MM-DD` — Multi-operatory schedule by date
- `POST /api/v1/appointments` — Schedule appointment with atomic conflict detection
- `PUT /api/v1/appointments/:id` — Update status (`Scheduled`, `Arrived`, `In Chair`, `Complete`)
- `GET /api/v1/procedurelogs/codes` — ADA CDT procedure codes directory (cached in KV)
- `GET /api/v1/procedurelogs/logs?patNum=:id` — Patient treatment plan & procedure history
- `POST /api/v1/procedurelogs/logs` — Add planned or completed procedure
- `GET /api/v1/providers` — List dentists and hygienists
- `GET /api/v1/providers/operatories` — List operatory chairs
- `POST /api/v1/documents/upload` — Multipart stream upload directly to Cloudflare R2
- `GET /api/v1/documents/:id/download` — Stream download file directly from R2
- `POST /api/v1/queries/ShortQuery` — Execute read-only SQL queries for custom dental reports
- `WS /ws/schedule?clinicId=1` — Real-time WebSocket connection to `AppointmentScheduleDO`

---

## Testing

Run the automated test suite:

```bash
bun run test
```

Typecheck the codebase:

```bash
bun run typecheck
```

---

## Deployment to Cloudflare

Deploy your edge practice management worker and assets directly to Cloudflare:

```bash
bun run deploy
```

---

## Upstream & Licensing

This project is a Cloudflare edge-native port and fork based on [Open Dental](https://github.com/OpenDental/opendental). 
All upstream Open Dental entities, business rules, and schemas are preserved and adapted for modern serverless edge computing.