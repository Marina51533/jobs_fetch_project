# Web3 Career Integration — Notes

## Source Email Summary

The source provider approved API access and included explicit policy guidance.

The key obligations are:

- keep the token private
- use `apply_url` as the outbound link
- do not add tracking params to `apply_url`
- if jobs are rendered on a site, the link should be followable and should not use `nofollow`

## Architecture Decisions

### ADR-1: Keep Web3 docs separate from job-aggregation docs

**Decision**: Maintain a standalone doc set under `tasks/web3/`.

**Reason**: The source has its own API behavior and compliance rules, and the user explicitly asked for separate documentation.

**Status**: Accepted.

---

### ADR-2: Redact the raw API token from project docs

**Decision**: Do not store the token from the email in repository documentation.

**Reason**: The provider explicitly requires token privacy, and committing it would be an avoidable security mistake.

**Status**: Accepted.

---

### ADR-3: Preserve `apply_url` unchanged

**Decision**: Treat `apply_url` as immutable source data.

**Reason**: The provider explicitly forbids adding extra parameters and expects traffic to flow back through that URL.

**Status**: Accepted.

---

### ADR-4: Build a dedicated connector

**Decision**: Web3 Career should be integrated through its own source connector rather than folded into the Greenhouse connector.

**Reason**: The response shape, authentication model, and policy constraints differ materially from Greenhouse.

**Status**: Accepted.

## Open Questions

| # | Question | Status |
|---|---|---|
| 1 | Should Web3 `tags` be surfaced in Telegram posts? | Open |
| 2 | Should the source be always on or env-gated? | Open, but env-gated is recommended |
| 3 | Should the pipeline use source-side filters later for performance? | Deferred |

## Implementation Reminder

If the connector is implemented later, the first safe local test should confirm:

- the token works
- the response shape still matches the sample assumption
- the parsed jobs contain stable IDs
- the preserved `apply_url` exactly matches the API value