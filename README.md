# Job Aggregation Pipeline

Automatic job aggregation and publishing for **DEV Career Community | Europe**.

Fetches jobs from Greenhouse, classifies them into QA and Developer categories, filters by geography, and publishes to separate Telegram topics via separate bots.

Greenhouse runs in GitHub Actions. Web3 runs locally on macOS because web3.career blocks GitHub-hosted runner IPs.

## Architecture

```
GitHub Actions (cron every 2h)
  → Node.js Pipeline Orchestrator
    → Greenhouse Fetcher (6–20 boards)
    → Normalizer (fields, work mode, country)
    → Deduplicator (SQLite)
    → Python Classifier (QA / Developer / Uncertain)
    → Geography Filter (EU onsite + worldwide remote)
    → Router (auto-publish / review / reject)
    → Telegram Publisher (2 bots, 2 topics)
    → Admin Review (inline buttons via getUpdates)

macOS launchd (every 2h)
  → Node.js Pipeline Orchestrator
    → Web3 Career Fetcher only
    → shared normalize / dedupe / classify / publish flow
```

## Quick Start

### Prerequisites

- Node.js 20+
- Python 3.11+
- Two Telegram bots (QA bot and Developer bot)
- A Telegram supergroup with two topics (QA jobs, Developer jobs)

### Setup

```bash
# Clone and install
git clone https://github.com/Marina51533/jobs_fetch_project.git
cd jobs_fetch_project
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Database is created automatically on first run (./data/jobs.db)

# Configure Greenhouse boards
# Edit config/boards.json with your target companies

# Run the pipeline
npm start

# Run Web3 only
npm run start:web3

# Install macOS local scheduler (runs immediately, then every 2 hours)
npm run schedule:macos

# Remove macOS local scheduler
npm run schedule:macos:remove
```

### Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_PATH` | SQLite database file path (default: `./data/jobs.db`) |
| `QA_BOT_TOKEN` | Telegram bot token for QA jobs |
| `DEV_BOT_TOKEN` | Telegram bot token for Developer jobs |
| `TELEGRAM_CHAT_ID` | Supergroup chat ID |
| `QA_TOPIC_ID` | Topic ID for QA jobs |
| `DEV_TOPIC_ID` | Topic ID for Developer jobs |
| `ADMIN_CHAT_ID` | Approving admin's Telegram user ID for review button clicks |
| `REVIEW_CHAT_ID` | Optional group/chat ID where review messages are sent |
| `CONFIDENCE_THRESHOLD` | Minimum confidence for auto-publish (default: 0.8) |
| `FETCH_DELAY_MS` | Delay between Greenhouse API calls (default: 200) |
| `PUBLISH_DELAY_MS` | Delay between Telegram posts (default: 1000) |
| `MAX_SOURCE_JOB_AGE_DAYS` | Only process jobs updated in the last N days; `0` disables the filter |

## Run Automatically On macOS

If you want Web3 fetching to run automatically on your Mac, use the bundled `launchd` helper instead of GitHub Actions.

```bash
npm run schedule:macos
```

This local scheduler runs the pipeline with `SOURCE_MODE=web3`, so only the Web3 source is fetched on your Mac.

Manual local Web3 run:

```bash
npm run start:web3
```

To remove the local scheduler:

```bash
npm run schedule:macos:remove
```

What it does:

- installs a LaunchAgent at `~/Library/LaunchAgents/com.marina.jobs-fetch-project.plist`
- runs the pipeline once on load
- reruns it every 2 hours
- writes logs to `data/logs/`

To verify it is loaded:

```bash
launchctl list | grep com.marina.jobs-fetch-project
```

To stop it:

```bash
launchctl unload ~/Library/LaunchAgents/com.marina.jobs-fetch-project.plist
```

GitHub Actions runs Greenhouse sources only. Web3 fetching is intended to run locally on macOS because web3.career blocks GitHub-hosted runner IPs.

## Project Structure

```
├── .github/workflows/     GitHub Actions pipeline schedule
│   └── fetch-jobs.yml
├── classifier/            Python classification engine
│   ├── classify.py
│   └── config.json        Keyword lists and scoring rules
├── config/
│   └── boards.json        Greenhouse board tokens
├── src/
│   ├── pipeline/          Orchestrator and routing
│   │   ├── index.js       Main entry point
│   │   └── router.js      Decision combiner
│   ├── sources/           Source connectors
│   │   └── greenhouse.js
│   ├── normalizer/        Data normalization
│   │   ├── normalize.js
│   │   └── location.js    Work mode + country extraction
│   ├── dedup/             Deduplication + DB operations
│   │   └── dedup.js
│   ├── classifier/        Node.js ↔ Python bridge
│   │   └── classify.js
│   ├── geo/               Geography filter
│   │   └── geoFilter.js
│   ├── publisher/         Telegram publishing
│   │   ├── telegram.js
│   │   └── formatter.js
│   ├── review/            Admin review flow
│   │   ├── review.js
│   │   └── reviewSender.js
│   ├── db.js              Database client
│   ├── migrate.js         Schema migration
│   └── schema.sql         PostgreSQL schema
├── tasks/                 Task documentation
│   └── job-aggregation/
│       ├── job-aggregation-domain.md
│       ├── job-aggregation-research.md
│       ├── job-aggregation-spec.md
│       ├── job-aggregation-plan.md
│       ├── job-aggregation-tasks.md
│       ├── job-aggregation-notes.md
│       └── job-aggregation-telegram-notes.md
├── .env.example
└── package.json
```

## Pipeline Flow

1. **Process reviews** — Read pending admin button presses via `getUpdates`, publish approved jobs
2. **Fetch** — Pull job listings from configured Greenhouse boards
3. **Normalize** — Convert to internal schema, extract work mode and country
4. **Deduplicate** — Skip already-known jobs
5. **Classify** — Python keyword engine assigns QA / Developer / Uncertain
6. **Geography filter** — Allow worldwide remote; require EU for onsite/hybrid
7. **Route** — Combine decisions: auto-publish, review, or reject
8. **Publish** — Send to correct Telegram bot and topic
9. **Review** — Route uncertain jobs to admin with inline buttons

## Documentation

Full task documentation is in [tasks/job-aggregation/](tasks/job-aggregation/):

- [Domain Context](tasks/job-aggregation/job-aggregation-domain.md) — Business context and scope
- [Research](tasks/job-aggregation/job-aggregation-research.md) — API research and technical constraints
- [Specification](tasks/job-aggregation/job-aggregation-spec.md) — Functional and non-functional requirements
- [Plan](tasks/job-aggregation/job-aggregation-plan.md) — Architecture, modules, delivery phases
- [Tasks](tasks/job-aggregation/job-aggregation-tasks.md) — MVP and future backlog
- [Notes](tasks/job-aggregation/job-aggregation-notes.md) — Architecture decisions and open questions
- [Telegram Notes](tasks/job-aggregation/job-aggregation-telegram-notes.md) — Telegram setup, IDs, topics, and `getUpdates` debugging

Web3-specific documentation is in [tasks/web3/](tasks/web3/):

- [Plan](tasks/web3/web3-plan.md) — Source integration and operating model
- [Tasks](tasks/web3/web3-tasks.md) — Remaining work and verification items
- [Notes](tasks/web3/web3-notes.md) — Source policy, local-only automation, and decisions