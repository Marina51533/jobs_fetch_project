# Job Aggregation — Research

## Greenhouse API

### Overview

Greenhouse exposes a public Job Board API at `https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs`. No authentication required for public boards.

### Key endpoints

| Endpoint | Returns |
|---|---|
| `GET /v1/boards/{token}/jobs` | List of all published jobs for a board |
| `GET /v1/boards/{token}/jobs/{id}` | Single job with full description |

### Response shape (list endpoint)

```json
{
  "jobs": [
    {
      "id": 4012345,
      "title": "Senior QA Engineer",
      "updated_at": "2026-03-20T14:30:00Z",
      "absolute_url": "https://boards.greenhouse.io/stripe/jobs/4012345",
      "location": { "name": "Remote" },
      "metadata": [],
      "departments": [{ "name": "Engineering" }],
      "offices": [{ "name": "Berlin" }]
    }
  ]
}
```

### Rate limits

- No documented rate limit for public board API.
- Recommendation: add 200ms delay between board requests to be respectful.
- Fetch full job details only for new/updated jobs (compare `updated_at`).

### Limitations

- No filtering by date — you always get the full list.
- Location is a free-text string, often inconsistent across companies.
- Description is only available on the single-job endpoint (HTML format).

---

## Telegram Bot API

### Topic-based publishing

Telegram supergroups support **topics** (forum mode). Each topic has a `message_thread_id`. To post into a specific topic:

```
POST /bot{token}/sendMessage
{
  "chat_id": "<supergroup_id>",
  "message_thread_id": "<topic_id>",
  "text": "...",
  "parse_mode": "HTML"
}
```

### Inline keyboard for review

```json
{
  "reply_markup": {
    "inline_keyboard": [[
      { "text": "✅ QA", "callback_data": "approve_qa_{job_id}" },
      { "text": "✅ Dev", "callback_data": "approve_dev_{job_id}" },
      { "text": "❌ Skip", "callback_data": "reject_{job_id}" }
    ]]
  }
}
```

### getUpdates for review processing

- `getUpdates` returns pending callback queries (button presses).
- Telegram stores unprocessed updates for up to 24 hours.
- Compatible with schedule-based execution: process updates at the start of each pipeline run.
- **Constraint**: cannot use webhooks and `getUpdates` on the same bot simultaneously.

### Bot separation

| Bot | Purpose | Posts to |
|---|---|---|
| QA Bot | Publishes QA jobs, handles admin review | QA topic in supergroup |
| Developer Bot | Publishes Developer jobs | Developer topic in supergroup |

The QA bot also sends review messages to the admin's private chat (`ADMIN_CHAT_ID`).

---

## Classification Strategy

### MVP approach: keyword/rule engine

- Match against configurable keyword lists for QA and Developer roles.
- Inputs: job title, description text, location.
- Output: `{ label: "QA" | "Developer" | "Uncertain", confidence: 0.0–1.0, reasons: string[] }`.
- High confidence threshold for auto-publish: `>= 0.8`.
- Below threshold → `Uncertain` → review queue.

### QA keywords (examples)

```
QA, Quality Assurance, Test Engineer, SDET, Test Automation,
Software Tester, Quality Engineer, Test Analyst, Manual Testing,
Automation Engineer, Performance Tester, QA Lead, Test Lead
```

### Developer keywords (examples)

```
Software Engineer, Developer, Frontend, Backend, Full Stack,
Full-Stack, DevOps, SRE, Platform Engineer, Mobile Developer,
iOS Developer, Android Developer, Web Developer, Software Developer
```

### Ambiguous patterns

- "QA/Dev" in title → Uncertain
- "Engineering Manager" → Uncertain (could be either)
- No matching keywords → Uncertain

### Future evolution

- Replace keyword matching with a Python scoring model.
- Interface contract stays the same: `classify(job) → { label, confidence, reasons }`.

---

## Geography Handling

### Work mode extraction

| Location string pattern | Extracted work_mode |
|---|---|
| Contains "remote" (case-insensitive) | `remote` |
| Contains "hybrid" | `hybrid` |
| No location provided | `unknown` |
| Everything else | `onsite` |

### Geography decision matrix

| Work mode | Location | Decision |
|---|---|---|
| Remote | Worldwide / unspecified | **Publish** |
| Remote | EU-restricted (e.g., "Remote EMEA") | **Publish** |
| Remote | Non-EU-restricted (e.g., "Remote US only") | **Reject** |
| Onsite | Clearly European country/city | **Publish** |
| Onsite | Non-European | **Reject** |
| Onsite | Ambiguous / missing | **Review** |
| Hybrid | Clearly European | **Publish** |
| Hybrid | Non-European or ambiguous | **Review** |
| Unknown | Any | **Review** |

### European country detection

Maintain a list of European country names and common city names for matching. ISO country codes can be used for structured data if available.

---

## Deduplication Strategy

### Primary key

`source:board_token:source_job_id` — e.g., `greenhouse:stripe:4012345`.

### Fallback hash

`SHA256(source + company + title + job_url)` — used only if source job ID is missing.

### Behavior

- Check runs **before** classification to avoid reclassifying known jobs.
- A previously published job is never re-published.
- A previously rejected job is never re-reviewed.
- Updated jobs (same ID, newer `updated_at`) can optionally be re-processed (post-MVP).

---

## GitHub Actions Constraints

- Maximum run time: 6 hours (more than enough).
- Secrets injected via repository settings → `${{ secrets.VAR_NAME }}`.
- Schedule via cron syntax: `schedule: - cron: '0 */2 * * *'` (every 2 hours).
- No persistent filesystem — all state must live in the database.
- Rerun safety: pipeline must be idempotent (dedupe + publish-once logic).

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Greenhouse location data is inconsistent | Incorrect geography decisions | Normalize aggressively; send ambiguous to review |
| Greenhouse API outage for one board | Missing jobs from that source | Catch per-board errors; continue with remaining boards |
| Telegram rate limits (30 msg/sec to same chat) | Publishing failures | Batch with delays; retry with exponential backoff |
| Classification keywords miss edge cases | Wrong audience gets wrong jobs | Low confidence → review; iterate keyword lists |
| Admin ignores review queue | Uncertain jobs pile up | Optional 7-day auto-expire (configurable) |
| GitHub Actions schedule drift | Runs may be delayed by minutes | Acceptable for a job board; not real-time critical |
