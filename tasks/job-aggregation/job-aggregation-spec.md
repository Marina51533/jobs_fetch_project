# Job Aggregation — Specification

## Main User Story

As a community owner, I want to automatically fetch job postings from Greenhouse, classify them into QA and Developer categories, filter by geography, and publish them into separate Telegram topics via separate bots, so that my audience gets relevant European and remote jobs in a structured way.

---

## Functional Requirements

### FR-1: Fetch jobs from Greenhouse

| Field | Detail |
|---|---|
| Source | Greenhouse public Job Board API |
| Config | List of 6–20 board tokens in `config/boards.json` |
| Data captured | `source_job_id`, `title`, `company` (from board token), `location`, `absolute_url`, `updated_at`, `departments`, `offices`, `description` (from detail endpoint) |
| Behavior | Fetch full job list per board; fetch description for new/updated jobs only |
| Error handling | Per-board failures are logged and skipped; pipeline continues with remaining boards |

**Acceptance criteria**
- System fetches jobs from all configured board tokens.
- System stores fetched job data in a normalized format.
- A single board failure does not stop the whole run.

### FR-2: Normalize job data

| Field | Detail |
|---|---|
| Input | Raw Greenhouse API response |
| Output | Normalized `Job` record with all MVP fields populated |
| Work mode extraction | Parse location string → `remote` / `onsite` / `hybrid` / `unknown` |
| Location normalization | Extract country/city when possible; map to European country list |

**Acceptance criteria**
- Every fetched job is converted to the internal `Job` schema.
- `work_mode` is correctly extracted from location data.
- `location_country` is populated when detectable.

### FR-3: Deduplicate jobs

| Field | Detail |
|---|---|
| Primary key | `source:board_token:source_job_id` |
| Fallback | `SHA256(source + company + title + job_url)` |
| Timing | Runs before classification |

**Acceptance criteria**
- A previously processed job is not re-classified or re-published.
- Duplicate detection uses source-specific identifiers.
- All processed jobs are tracked in the database.

### FR-4: Classify jobs into QA and Developer

| Field | Detail |
|---|---|
| Inputs | Job title, description, location |
| Outputs | `{ label: "QA" | "Developer" | "Uncertain", confidence: 0.0–1.0, reasons: string[] }` |
| Engine | Configurable keyword/rule matching in Python |
| Auto-publish threshold | Confidence >= 0.8 |
| Below threshold | Label set to `Uncertain` → sent to review |

**Acceptance criteria**
- QA-related jobs are labeled `QA`.
- Developer-related jobs are labeled `Developer`.
- Ambiguous jobs are labeled `Uncertain`.
- Classification rules are configurable via config file.

### FR-5: Apply geography filter

| Field | Detail |
|---|---|
| Inputs | `work_mode`, `location_country`, `location_text` |
| Decision matrix | See research doc |
| Independent from | Role classification (runs as second stage) |

**Acceptance criteria**
- Remote jobs (worldwide/unspecified) are allowed.
- Remote jobs restricted to non-EU regions are rejected.
- Onsite/hybrid jobs in Europe are allowed.
- Onsite/hybrid jobs outside Europe are rejected.
- Ambiguous locations go to review.

### FR-6: Route jobs based on combined decisions

| Role classifier | Geography filter | Result |
|---|---|---|
| QA or Dev (confident) | Publish | **Auto-publish** |
| QA or Dev (confident) | Review | **Review** |
| QA or Dev (confident) | Reject | **Reject** |
| Uncertain | Publish | **Review** |
| Uncertain | Review | **Review** |
| Uncertain | Reject | **Reject** |

**Acceptance criteria**
- A job is auto-published only if both stages pass.
- The stricter outcome always wins.
- Rejected jobs are logged with reason.

### FR-7: Publish QA jobs to Telegram

| Field | Detail |
|---|---|
| Bot | QA Bot (`QA_BOT_TOKEN`) |
| Target | QA topic in supergroup (`QA_TOPIC_ID`) |
| Format | Formatted HTML with title, company, location, source, URL, tags, short summary |

**Post template**
```
🔍 <b>{title}</b>
🏢 {company}
📍 {location} | {work_mode_emoji} {work_mode}
🔗 <a href="{url}">Apply</a>

{short_summary}

{tags}
```

**Acceptance criteria**
- QA jobs are posted only to the QA topic.
- QA jobs are posted by the QA bot.
- Each post contains: title, company, location, source, URL, tags, summary.

### FR-8: Publish Developer jobs to Telegram

| Field | Detail |
|---|---|
| Bot | Developer Bot (`DEV_BOT_TOKEN`) |
| Target | Developer topic in supergroup (`DEV_TOPIC_ID`) |
| Format | Same template as QA posts |

**Acceptance criteria**
- Developer jobs are posted only to the Developer topic.
- Developer jobs are posted by the Developer bot.

### FR-9: Admin review via Telegram

| Field | Detail |
|---|---|
| Bot used | QA Bot (admin-facing) |
| Target | Admin's private chat (`ADMIN_CHAT_ID`) |
| Format | Job details + inline buttons |
| Buttons | `[✅ QA]` `[✅ Dev]` `[❌ Skip]` |
| Processing | `getUpdates` at pipeline start; approved jobs published on same run |

**Review message template**
```
🔍 Review needed

Title: {title}
Company: {company}
Location: {location} | {work_mode}
Source: {source}/{board_token}
URL: {url}

Suggested: {label} (confidence: {confidence})
Reason: {reasons}

[✅ QA]  [✅ Dev]  [❌ Skip]
```

**Acceptance criteria**
- Uncertain jobs are sent to admin with inline buttons.
- Admin approval routes the job to the correct bot/topic.
- Admin rejection marks the job as skipped.
- Uncertain jobs are never auto-published.

### FR-10: Prevent duplicate posts

**Acceptance criteria**
- A previously posted job is not posted again.
- Duplicate detection uses `source:board_token:source_job_id`.
- Published jobs record `published_at`, `published_by_bot`, `telegram_message_id`.

---

## Non-Functional Requirements

### NFR-1: Scheduled execution

- Pipeline runs automatically every 2 hours via GitHub Actions cron.
- Failed runs are logged with structured error messages.
- Partial source failures do not stop the whole pipeline.

### NFR-2: Idempotent reruns

- Running the pipeline twice with no new data produces zero new posts.
- Dedupe and publish-once logic guarantee this.

### NFR-3: Modular source architecture

- Source fetchers are separated from classification and publishing.
- New sources can plug into the normalization layer.
- Core routing logic is reusable across sources.

### NFR-4: Secure credential handling

- Bot tokens stored as GitHub Actions secrets.
- Database URL stored as GitHub Actions secret.
- No credentials in source code or config files.

---

## Data Model

### `jobs` table

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PRIMARY KEY | Auto-increment primary key |
| `source` | TEXT | e.g., `greenhouse` |
| `source_job_id` | TEXT | Job ID from source |
| `source_board_token` | TEXT | Board token |
| `dedupe_key` | TEXT | `source:board_token:source_job_id` |
| `dedupe_hash` | TEXT | SHA256 fallback hash |
| `company` | TEXT | Company name |
| `title` | TEXT | Job title |
| `location_text` | TEXT | Raw location string |
| `location_country` | TEXT | Extracted country |
| `work_mode` | TEXT | `remote` / `onsite` / `hybrid` / `unknown` |
| `job_url` | TEXT | Application URL |
| `updated_at_source` | TEXT | Source's last update (ISO 8601) |
| `fetched_at` | TEXT | When we fetched it (ISO 8601) |
| `description_raw` | TEXT | Raw HTML description |
| `description_text` | TEXT | Cleaned text description |
| `classification_label` | TEXT | `QA` / `Developer` / `Uncertain` |
| `classification_confidence` | REAL | 0.00–1.00 |
| `classification_reasons` | TEXT | JSON array of matching reasons |
| `geo_decision` | TEXT | `publish` / `reject` / `review` |
| `final_decision` | TEXT | `auto_publish` / `review` / `reject` |
| `review_status` | TEXT | `pending` / `approved` / `rejected` / `expired` / NULL |
| `publish_target` | TEXT | `qa` / `developer` / NULL |
| `published_at` | TEXT | When posted to Telegram (ISO 8601) |
| `published_by_bot` | TEXT | `qa_bot` / `dev_bot` |
| `telegram_message_id` | TEXT | Telegram message ID |
| `raw_payload` | TEXT | Full source API response (JSON) |
| `processing_status` | TEXT | `new` / `processed` / `error` |
| `error_message` | TEXT | Error details if failed |
| `created_at` | TEXT | DB record creation (ISO 8601) |
| `updated_at` | TEXT | DB record last update (ISO 8601) |

### Indexes

- UNIQUE on `dedupe_key`
- INDEX on `review_status` (for pending review queries)
- INDEX on `final_decision, published_at` (for publish queue)
- INDEX on `source, source_board_token` (for per-board queries)
