# Web3 Career Integration — Domain Context

## Epic

**Add Web3 Career as a separate job source for the jobs aggregation pipeline**

## Problem Statement

The current pipeline focuses on Greenhouse boards. A new source, Web3 Career, is available through a private token-based API and can provide additional developer and QA-relevant jobs, especially from crypto and Web3 companies.

This source comes with source-specific usage rules:

- the API token must stay private
- `apply_url` must be used exactly as provided
- no extra query params may be appended to `apply_url`
- if jobs are shown on a website, outbound links must point back to Web3 Career through `apply_url`

Without dedicated documentation, the source could be integrated incorrectly and risk API suspension or inconsistent data handling.

## Goal

Define a clear implementation contract for integrating Web3 Career into the existing pipeline as a separate source connector.

## Target Audience

| Audience | Need |
|---|---|
| Project owner | Understand API constraints and rollout steps |
| Developer implementing the connector | Have exact parsing, normalization, and compliance rules |
| Future maintainer | Understand why Web3 is handled differently from Greenhouse |

## Business Value

- increases the number of relevant jobs available to the community
- expands coverage into crypto and Web3 companies
- reduces implementation risk by documenting source-specific rules before coding
- protects API access by making compliance requirements explicit

## Key Concepts

| Concept | Definition |
|---|---|
| Web3 Career API | Token-protected API that returns job listings in JSON or RSS/XML |
| `apply_url` | Canonical outbound link supplied by Web3 Career; must not be rewritten |
| Source connector | A source-specific fetcher that converts Web3 API payloads into the shared internal job schema |
| Source job ID | The stable `id` field returned by Web3 Career and used for deduplication |
| Response index `2` | The job list location in the JSON example provided by Web3 Career |

## Scope Boundaries

### In scope

- document the Web3 Career API contract
- define normalization and dedupe rules
- define implementation requirements for a future connector
- define rollout and testing expectations

### Out of scope

- implementing the connector itself
- changing the current Greenhouse flow
- adding Web3-specific Telegram formatting rules
- adding source-specific website rendering