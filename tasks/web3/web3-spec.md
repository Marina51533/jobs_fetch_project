# Web3 Career Integration — Specification

## Main User Story

As the pipeline owner, I want to fetch jobs from the Web3 Career API as a separate source, normalize them into the shared job schema, and pass them through the existing classification, geography, review, and publishing flow, so that the channel receives more relevant jobs without breaking source policy.

---

## Functional Requirements

### FR-1: Fetch jobs from Web3 Career JSON API

| Field | Detail |
|---|---|
| Endpoint | `GET https://web3.career/api/v1?token=<TOKEN>` |
| Auth | `WEB3_CAREER_API_TOKEN` environment variable |
| Request defaults | `limit=100` |
| Data captured | `id`, `title`, `date`, `date_epoch`, `country`, `city`, `company`, `location`, `apply_url`, `tags`, `description` |
| Error handling | Invalid response shape or request failures are logged as source errors and do not stop the full pipeline |

**Acceptance criteria**
- connector authenticates using the environment token
- connector fetches JSON successfully when the token is valid
- a Web3 API failure does not stop other sources from running

### FR-2: Validate the response shape defensively

| Field | Detail |
|---|---|
| Expected shape | top-level array with job list at index `2` |
| Failure mode | clear parse error with enough context for debugging |

**Acceptance criteria**
- connector checks that the response is an array
- connector checks that index `2` exists
- connector checks that index `2` is an array of jobs
- malformed responses are rejected safely

### FR-3: Normalize Web3 jobs into the shared schema

| Web3 field | Internal field |
|---|---|
| `id` | `source_job_id` |
| `company` | `company` |
| `title` | `title` |
| `location` | `location_text` |
| `country` | `location_country` when present |
| `apply_url` | `job_url` |
| `date` or `date_epoch` | `updated_at_source` |
| `description` | `description_raw` and `description_text` |
| full item | `raw_payload` |

**Acceptance criteria**
- normalized jobs follow the same internal schema as Greenhouse jobs
- `job_url` comes from `apply_url`
- `raw_payload` stores the full source item for debugging

### FR-4: Preserve `apply_url` exactly as returned

| Rule | Detail |
|---|---|
| URL mutation | forbidden |
| Tracking params | forbidden |
| Website rendering | must use a followable link if rendered outside Telegram |

**Acceptance criteria**
- no extra params are appended to `apply_url`
- the stored and published URL equals the source value exactly

### FR-5: Deduplicate Web3 jobs

| Field | Detail |
|---|---|
| Source name | `web3_career` |
| Primary dedupe key | `web3_career:{source_job_id}` |
| Fallback hash | `SHA256(source + company + title + job_url)` |

**Acceptance criteria**
- previously processed Web3 jobs are not reprocessed unnecessarily
- dedupe does not depend on a board token

### FR-6: Reuse existing downstream pipeline stages

| Stage | Expected behavior |
|---|---|
| Classification | same classifier used for Greenhouse |
| Geography filter | same EU/remote logic used for Greenhouse |
| Router | same publish/review/reject decisions |
| Publisher | same Telegram publishers and topics |

**Acceptance criteria**
- Web3 jobs enter the same downstream pipeline as other sources
- no separate publish flow is required for Web3 jobs

---

## Non-Functional Requirements

### NFR-1: Credential safety

- the token must not be committed into the repo
- the token must be stored only in local env files or CI secrets

### NFR-2: Compliance safety

- the integration must preserve `apply_url` unchanged
- docs and code must avoid showing the raw token

### NFR-3: Source isolation

- Web3-specific logic should live inside a dedicated connector module
- shared pipeline logic should remain source-agnostic

### NFR-4: Observability

- source fetch count, parse errors, and processed job count should be logged
