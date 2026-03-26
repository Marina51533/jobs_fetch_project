# Web3 Career Integration — Tasks

## Backlog

- [ ] **W-01** Add `WEB3_CAREER_API_TOKEN` to environment documentation
- [ ] **W-02** Create `src/sources/web3Career.js`
  - fetch JSON from `https://web3.career/api/v1?token=...&limit=100`
  - validate top-level array shape
  - extract jobs from index `2`
- [ ] **W-03** Normalize Web3 fields into the shared job schema
  - map `id` to `source_job_id`
  - map `apply_url` to `job_url`
  - map `date` or `date_epoch` to `updated_at_source`
  - store full item as `raw_payload`
- [ ] **W-04** Add dedupe support for `web3_career:{id}`
- [ ] **W-05** Register the Web3 connector in the pipeline orchestrator
- [ ] **W-06** Add unit tests for Web3 response parsing
- [ ] **W-07** Add unit tests for URL preservation
- [ ] **W-08** Add unit tests for normalization and dedupe behavior
- [ ] **W-09** Run a local smoke test with a valid token
- [ ] **W-10** Enable the source in GitHub Actions only after local verification

## Verification Checklist

- [ ] token is read from env, not hardcoded
- [ ] token is not printed in logs
- [ ] malformed responses fail safely
- [ ] `apply_url` is stored unchanged
- [ ] duplicate jobs are skipped on rerun
- [ ] Web3 jobs follow the standard review and publish flow

## Deferred Items

- [ ] expose Web3 `tags` in Telegram post formatting
- [ ] evaluate whether source-side `tag` filtering is useful later
- [ ] evaluate whether Web3 requires per-run caps beyond existing pipeline controls