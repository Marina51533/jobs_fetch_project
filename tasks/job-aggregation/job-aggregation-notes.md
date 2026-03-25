# Job Aggregation — Notes & Decisions

## Architecture Decisions

### ADR-1: Hybrid Node.js + Python stack

**Decision**: Node.js for orchestration/fetching/publishing; Python for classification.

**Context**: The pipeline is primarily HTTP + database + Telegram API work (natural for Node.js), but classification benefits from Python's text processing ecosystem and future ML extensibility.

**Trade-off**: Two runtimes increase GitHub Actions setup complexity slightly. Mitigated by using JSON stdin/stdout IPC — no shared services or network calls between runtimes.

**Status**: Accepted.

---

### ADR-2: Telegram getUpdates instead of webhooks

**Decision**: Use `getUpdates` polling at pipeline start, not webhooks.

**Context**: Webhooks require a persistent server endpoint. Since the MVP runs on GitHub Actions (scheduled, ephemeral), `getUpdates` is the only viable option without additional infrastructure.

**Trade-off**: Approval latency is up to 2 hours (worst case = one schedule interval). Acceptable for a job board.

**Status**: Accepted.

---

### ADR-3: QA bot handles admin review (no third bot)

**Decision**: The QA bot sends review messages to the admin's private chat and processes callback responses.

**Context**: Adding a third bot increases configuration and token management. Since review messages go to a private admin chat (not the public group), reusing the QA bot is clean and avoids confusion.

**Status**: Accepted.

---

### ADR-4: Two-stage decision pipeline

**Decision**: Role classification and geography filtering are separate, independent stages.

**Context**: Mixing them would make rules harder to debug, test, and configure independently. Separation allows each stage to evolve without affecting the other.

**Rule**: A job auto-publishes only if both stages pass. The stricter outcome wins.

**Status**: Accepted.

---

### ADR-5: SQLite for MVP

**Decision**: Use SQLite for storage — zero external dependencies, file-based, no server to manage.

**Context**: The pipeline runs on a schedule (GitHub Actions) with no concurrent writes. SQLite with WAL mode handles this well. It simplifies setup (no database provisioning), lowers operational cost, and keeps the data portable.

**Trade-off**: SQLite is single-writer; if the project ever needs true concurrent access from multiple processes, migration to PostgreSQL would be needed. For a scheduled pipeline with serial execution, this is not a constraint.

**Status**: Accepted.

---

### ADR-6: Remote jobs allowed worldwide

**Decision**: Remote jobs with no geographic restriction are published regardless of location. Only onsite/hybrid roles require a European location.

**Context**: The community targets European tech workers, but remote opportunities from worldwide companies are highly valuable. Restricting remote to EU-only would eliminate a large portion of desirable jobs.

**Status**: Accepted.

---

## Open Questions

| # | Question | Status | Resolution |
|---|---|---|---|
| 1 | Should internships and freelance roles be included? | Open | TBD — default: include all, filter later |
| 2 | Should seniority be extracted and shown in tags? | Open | TBD — nice to have, not blocking |
| 3 | How often should board token list be updated? | Open | Manual for MVP; re-evaluate quarterly |
| 4 | Should job expiry be tracked? | Deferred | Post-MVP |

---

## Changelog

| Date | Change |
|---|---|
| 2026-03-25 | Initial documentation created |
| 2026-03-25 | Geography rule updated: remote worldwide allowed |
| 2026-03-25 | Review flow specified: QA bot + inline buttons + getUpdates |
| 2026-03-25 | All spec issues resolved; plan is execution-ready |
