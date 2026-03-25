# Job Aggregation — Architecture & Plan

## Technology Stack

| Layer | Technology | Reason |
|---|---|---|
| Orchestration | Node.js 20+ | HTTP fetching, Telegram API, pipeline control |
| Classification | Python 3.11+ | Text processing, future ML extensibility |
| Database | SQLite 3.35+ | Lightweight, zero-config, file-based, no external service |
| Scheduling | GitHub Actions | Cron-based, zero infrastructure, secret injection |
| IPC | Child process (JSON) | Node.js spawns Python classifier, communicates via stdin/stdout JSON |

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   GitHub Actions (cron)                  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Pipeline Orchestrator (Node.js)      │   │
│  │                                                   │   │
│  │  1. Process review approvals (getUpdates)         │   │
│  │  2. Publish approved review jobs                  │   │
│  │  3. Fetch from Greenhouse boards                  │   │
│  │  4. Normalize raw data                            │   │
│  │  5. Deduplicate                                   │   │
│  │  6. Classify roles ──► Python subprocess          │   │
│  │  7. Apply geography filter                        │   │
│  │  8. Route: auto-publish / review / reject         │   │
│  │  9. Publish to Telegram                           │   │
│  │  10. Send review items to admin                   │   │
│  └───────────┬──────────────┬───────────────────────┘   │
│              │              │                            │
│     ┌────────▼──────┐  ┌───▼────────────┐               │
│     │  SQLite (file) │  │  Telegram API  │               │
│     │  (hosted)     │  │  (2 bots)      │               │
│     └───────────────┘  └────────────────┘               │
└─────────────────────────────────────────────────────────┘
```

## Module Breakdown

### 1. Source Connectors (`src/sources/`)

- `greenhouse.js` — Fetch job lists and details from Greenhouse boards.
- Future: `linkedin.js`, etc.

### 2. Normalizer (`src/normalizer/`)

- `normalize.js` — Convert raw source data to internal `Job` schema.
- `workMode.js` — Extract `work_mode` from location strings.
- `location.js` — Extract country, detect European locations.

### 3. Deduplication (`src/dedup/`)

- `dedup.js` — Check database for existing `dedupe_key`; compute fallback hash.

### 4. Classifier (`classifier/`)

- `classify.py` — Python keyword/rule engine.
- `config.json` — Keyword lists and confidence thresholds.
- Called from Node.js via `child_process.spawn`.

### 5. Geography Filter (`src/geo/`)

- `geoFilter.js` — Apply geography decision matrix based on `work_mode` and `location_country`.
- `europeanCountries.js` — List of European countries and common city names.

### 6. Router (`src/pipeline/`)

- `router.js` — Combine classification + geography decisions into final routing.

### 7. Publisher (`src/publisher/`)

- `telegram.js` — Send formatted messages to Telegram topics.
- `formatter.js` — Build HTML message from job data.

### 8. Review Handler (`src/review/`)

- `review.js` — Process `getUpdates`, parse callback data, mark jobs approved/rejected.
- `reviewSender.js` — Send uncertain jobs to admin with inline buttons.

### 9. Pipeline Orchestrator (`src/pipeline/`)

- `index.js` — Main entry point: runs all stages in order.

## Configuration

### Environment variables (secrets)

```
DATABASE_PATH=./data/jobs.db
QA_BOT_TOKEN=...
DEV_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...       # Supergroup ID
QA_TOPIC_ID=...
DEV_TOPIC_ID=...
ADMIN_CHAT_ID=...          # Admin's private chat for review
```

### Config files (committed)

- `config/boards.json` — Greenhouse board tokens
- `classifier/config.json` — Keywords and thresholds

## Pipeline Execution Order

```
START
│
├─ 1. Read pending Telegram updates (getUpdates via QA bot)
├─ 2. Process approvals/rejections → update DB
├─ 3. Publish newly-approved jobs to correct bot/topic
│
├─ 4. Load board tokens from config
├─ 5. For each board:
│     ├─ Fetch job list
│     ├─ For each job:
│     │   ├─ Normalize
│     │   ├─ Check dedupe → skip if known
│     │   ├─ Fetch full description (if new)
│     │   ├─ Classify role (Python)
│     │   ├─ Apply geography filter
│     │   ├─ Compute final decision
│     │   ├─ Save to DB
│     │   ├─ If auto_publish → publish to Telegram
│     │   └─ If review → send to admin
│     └─ Log board summary
│
├─ 6. Log run summary
└─ END
```

## Delivery Phases

### Phase 1: Foundation

- [ ] Initialize Node.js project with dependencies
- [ ] Create database schema and migration
- [ ] Set up config files (boards, classifier keywords)

### Phase 2: Ingestion

- [ ] Greenhouse fetcher
- [ ] Job normalizer (fields, work mode, location)
- [ ] Deduplication service

### Phase 3: Intelligence

- [ ] Python classifier
- [ ] Geography filter
- [ ] Decision router (combine classification + geography)

### Phase 4: Publishing

- [ ] Telegram message formatter
- [ ] QA bot publisher
- [ ] Developer bot publisher
- [ ] Review sender (admin inline buttons)
- [ ] Review processor (getUpdates handling)

### Phase 5: Operations

- [ ] Pipeline orchestrator (main entry point)
- [ ] GitHub Actions workflow
- [ ] Structured logging
- [ ] Error handling and partial-failure resilience

### Phase 6: Verification

- [ ] Unit tests for normalizer, classifier, dedup, geo filter
- [ ] Integration test for pipeline (mock APIs)
- [ ] Manual verification checklist
