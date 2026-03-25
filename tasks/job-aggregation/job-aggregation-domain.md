# Job Aggregation — Domain Context

## Epic

**Automatic job aggregation and publishing for DEV Career Community | Europe**

## Problem Statement

The DEV Career Community on Telegram serves two audiences — QA engineers and software developers — looking for European and remote job opportunities. Today, finding and sharing relevant jobs is entirely manual: the community owner searches job boards, copy-pastes postings, and routes them to the right topic by hand. This does not scale, introduces delays, and leads to missed opportunities.

## Goal

Automatically collect jobs from external sources, classify them into **QA** and **Developer** categories, and publish them into separate Telegram topics using separate bots, so that community members can easily find relevant opportunities and the community can grow organically.

## Target Audience

| Audience | Need |
|---|---|
| QA engineers (community members) | See testing/QA job postings in one place |
| Software developers (community members) | See development job postings in one place |
| Community owner (admin) | Automate publishing, review edge cases, grow the community |

## Business Value

- **Community growth**: members stay because jobs are relevant, timely, and well-organized.
- **Reduced manual effort**: the owner spends minutes per day instead of hours.
- **Foundation for monetization**: once volume and trust are established, premium listings and sponsorships become viable (post-MVP).

## Key Concepts

| Concept | Definition |
|---|---|
| Board token | A Greenhouse identifier for one company's public job page (e.g., `stripe`, `notion`) |
| Classification | Assigning a role label (`QA`, `Developer`, `Uncertain`) to a job based on title, description, and location |
| Geography filter | A separate decision stage that determines if a job is publishable based on work mode and location |
| Work mode | `remote`, `onsite`, `hybrid`, or `unknown` — extracted during normalization |
| Review queue | Jobs that cannot be auto-classified or auto-filtered are sent to the admin for manual routing |
| Dedupe key | `source + board_token + source_job_id` — prevents duplicate posts |

## Scope Boundaries

### In scope (MVP)

- Greenhouse as the only job source (6–20 board tokens)
- QA / Developer / Uncertain classification
- Europe-only filter for onsite/hybrid roles; worldwide remote allowed
- Two Telegram bots, two topics
- Manual review via Telegram inline buttons
- Scheduled execution via GitHub Actions
- SQLite for persistent state (zero-config, file-based)

### Out of scope (future)

- LinkedIn or other sources
- Admin web panel
- ML-based classification
- Salary extraction
- Country / seniority filtering
- Analytics dashboards
- Monetization features
