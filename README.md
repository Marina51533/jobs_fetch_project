# Job Aggregation Pipeline

Automatic job aggregation and publishing for **DEV Career Community | Europe**.

Fetches jobs from Greenhouse, classifies them into QA and Developer categories, filters by geography, and publishes to separate Telegram topics via separate bots.

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
| `ADMIN_CHAT_ID` | Admin's Telegram user ID for reviews |
| `CONFIDENCE_THRESHOLD` | Minimum confidence for auto-publish (default: 0.8) |
| `FETCH_DELAY_MS` | Delay between Greenhouse API calls (default: 200) |
| `PUBLISH_DELAY_MS` | Delay between Telegram posts (default: 1000) |

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
│       └── job-aggregation-notes.md
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