# Web3 Career Integration — Plan

## Objective

Add Web3 Career as a dedicated source connector that plugs into the existing normalization, dedupe, classifier, geography, router, and Telegram layers.

## Architecture Fit

```text
macOS launchd / manual local run
  -> pipeline orchestrator (SOURCE_MODE=web3)
    -> web3Career source connector
    -> normalizer
    -> dedupe
    -> classifier
    -> geography filter
    -> router
    -> Telegram publish or review
```

## Proposed Module

```text
src/sources/web3Career.js
```

Responsibilities:

- read `WEB3_CAREER_API_TOKEN`
- call the JSON endpoint
- validate the unusual response shape
- return normalized or normalizable source items

## Normalization Plan

1. fetch the raw JSON payload
2. extract jobs from top-level index `2`
3. map fields into the shared job schema
4. derive `updated_at_source` from `date_epoch` when possible
5. keep the original source item in `raw_payload`

## Configuration Plan

Environment variable:

```text
WEB3_CAREER_API_TOKEN=...
```

Connector enablement rule:

- only run the Web3 source when the token is present
- local automation should set `SOURCE_MODE=web3`

Current run model:

- GitHub Actions: Greenhouse only
- local macOS scheduler: Web3 only
- manual local command: `npm run start:web3`

## Rollout Plan

### Phase 1: Connector

- implement fetch and parse logic
- add source-level logging
- add unit tests for parsing

### Phase 2: Normalization and dedupe

- normalize the Web3 fields
- generate `web3_career:{id}` dedupe keys
- verify duplicate suppression

### Phase 3: Pipeline integration

- register the connector in the pipeline
- run the existing classifier and geography stages
- verify review and publish behavior

### Phase 4: Verification

- test with a small local sample
- confirm the URL is preserved exactly
- confirm no token leakage in logs or docs

### Phase 5: Local automation

- install a macOS LaunchAgent for Web3-only runs
- log output to `data/logs/`
- provide start and remove commands through `package.json`

## Design Constraints

- do not reuse the Greenhouse board abstraction for Web3
- do not append params to `apply_url`
- do not source-filter aggressively at first
- do not create a separate publish path unless real source behavior forces it

## Success Criteria

- Web3 jobs flow through the same pipeline safely
- source policy is respected
- the implementation is isolated and easy to maintain
- the source runs reliably outside GitHub-hosted CI