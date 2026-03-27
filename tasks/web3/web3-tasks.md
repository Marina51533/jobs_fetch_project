# Web3 Career Integration — Tasks

## Backlog

- [x] **W-01** Add `WEB3_CAREER_API_TOKEN` to environment documentation
- [x] **W-02** Create `src/sources/web3Career.js`
  - fetch JSON from `https://web3.career/api/v1?token=...&limit=100`
  - validate top-level array shape
  - extract jobs from index `2`
- [x] **W-03** Normalize Web3 fields into the shared job schema
  - map `id` to `source_job_id`
  - map `apply_url` to `job_url`
  - map `date` or `date_epoch` to `updated_at_source`
  - store full item as `raw_payload`
- [x] **W-04** Add dedupe support for `web3_career:{id}`
- [x] **W-05** Register the Web3 connector in the pipeline orchestrator
- [ ] **W-06** Add unit tests for Web3 response parsing
- [ ] **W-07** Add unit tests for URL preservation
- [ ] **W-08** Add unit tests for normalization and dedupe behavior
- [x] **W-09** Run a local smoke test with a valid token
- [x] **W-10** Decide runtime placement after local verification
- [x] **W-11** Remove Web3 from GitHub Actions because GitHub-hosted runners are blocked
- [x] **W-12** Add local Web3-only command `npm run start:web3`
- [x] **W-13** Add macOS LaunchAgent automation for Web3-only runs
- [x] **W-14** Add macOS LaunchAgent removal command

## Verification Checklist

- [x] token is read from env, not hardcoded
- [x] token is not printed in logs
- [ ] malformed responses fail safely
- [ ] `apply_url` is stored unchanged
- [x] duplicate jobs are skipped on rerun
- [x] Web3 jobs follow the standard review and publish flow

## Current Run Commands

- manual Web3-only run: `npm run start:web3`
- install local scheduler: `npm run schedule:macos`
- remove local scheduler: `npm run schedule:macos:remove`

## Deferred Items

- [ ] expose Web3 `tags` in Telegram post formatting
- [ ] evaluate whether source-side `tag` filtering is useful later
- [ ] evaluate whether Web3 requires per-run caps beyond existing pipeline controls