# Job Aggregation — Tasks

## MVP Backlog

### Phase 1: Foundation

- [ ] **T-01** Initialize Node.js project (`package.json`, dependencies, `.env.example`)
- [ ] **T-02** Create SQLite schema migration (`jobs` table, indexes)
- [ ] **T-03** Create database client module with connection pooling
- [ ] **T-04** Create `config/boards.json` with initial board tokens
- [ ] **T-05** Create `classifier/config.json` with keyword lists and thresholds

### Phase 2: Ingestion

- [ ] **T-06** Build Greenhouse fetcher (`src/sources/greenhouse.js`)
  - Fetch job list per board
  - Fetch full job detail for new/updated jobs
  - Handle per-board errors gracefully
- [ ] **T-07** Build job normalizer (`src/normalizer/normalize.js`)
  - Map Greenhouse fields to internal schema
  - Extract work mode from location
  - Extract country from location
- [ ] **T-08** Build deduplication service (`src/dedup/dedup.js`)
  - Check `dedupe_key` against database
  - Compute SHA256 fallback hash
  - Return `is_new` boolean

### Phase 3: Intelligence

- [ ] **T-09** Build Python classifier (`classifier/classify.py`)
  - Load keyword config
  - Accept job data via stdin JSON
  - Return `{ label, confidence, reasons }` via stdout JSON
  - Support batch classification
- [ ] **T-10** Build geography filter (`src/geo/geoFilter.js`)
  - Implement decision matrix
  - European country/city list
  - Return `publish` / `reject` / `review`
- [ ] **T-11** Build decision router (`src/pipeline/router.js`)
  - Combine classification + geography into final decision
  - Apply "stricter wins" rule

### Phase 4: Publishing

- [ ] **T-12** Build Telegram message formatter (`src/publisher/formatter.js`)
  - HTML template with title, company, location, work mode, URL, tags, summary
  - Sanitize HTML entities
- [ ] **T-13** Build Telegram publisher (`src/publisher/telegram.js`)
  - Send message to specific bot + topic
  - Handle rate limits with delays
  - Record `telegram_message_id` in database
- [ ] **T-14** Build review sender (`src/review/reviewSender.js`)
  - Format review message with inline buttons
  - Send to admin chat via QA bot
- [ ] **T-15** Build review processor (`src/review/review.js`)
  - Call `getUpdates` on QA bot
  - Parse callback data (`approve_qa_{id}`, `approve_dev_{id}`, `reject_{id}`)
  - Update job `review_status` and `publish_target` in database
  - Answer callback query to remove loading state

### Phase 5: Operations

- [ ] **T-16** Build pipeline orchestrator (`src/pipeline/index.js`)
  - Execute all stages in correct order
  - Structured logging per stage
  - Summary report at end
- [ ] **T-17** Create GitHub Actions workflow (`.github/workflows/fetch-jobs.yml`)
  - Cron schedule every 2 hours
  - Install Node.js and Python
  - Inject secrets as environment variables
  - Run pipeline
- [ ] **T-18** Add structured logging module
  - Log level, timestamp, stage, board, job count, errors
  - JSON format for parseable output
- [ ] **T-19** Update README with setup and configuration guide

### Phase 6: Verification

- [ ] **T-20** Unit tests for normalizer (field mapping, work mode, country extraction)
- [ ] **T-21** Unit tests for classifier (QA keywords, Dev keywords, uncertain cases)
- [ ] **T-22** Unit tests for dedup (new job, known job, hash fallback)
- [ ] **T-23** Unit tests for geo filter (all matrix combinations)
- [ ] **T-24** Unit tests for router (all decision combinations)
- [ ] **T-25** Integration test: full pipeline with mocked Greenhouse API and Telegram API

---

## Future Backlog

- [ ] **F-01** Add LinkedIn source connector
- [ ] **F-02** Add confidence scoring model (replace keyword rules)
- [ ] **F-03** Add admin review web panel
- [ ] **F-04** Add weekly summary / roundup posts
- [ ] **F-05** Add country and seniority filtering
- [ ] **F-06** Add analytics tracking (post counts, growth metrics)
- [ ] **F-07** Auto-expire unreviewed jobs after 7 days
- [ ] **F-08** Detect updated jobs and optionally reprocess
