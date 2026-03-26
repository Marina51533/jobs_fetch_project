# Web3 Career Integration — Research

## Source Summary

Web3 Career provides API access after registration. The source is protected by a private token and exposes both JSON and RSS/XML endpoints.

## API Endpoints

| Endpoint | Purpose |
|---|---|
| `https://web3.career/api/v1?token=<TOKEN>` | JSON feed |
| `https://web3.career/api/v1.xml?token=<TOKEN>` | RSS/XML feed |

For this project, the JSON endpoint is the correct integration target.

## Source Rules From The Email

- keep the token private
- use the token only for the project website/system
- link back using `apply_url`
- use a followable link when rendered on a website
- do not use `nofollow`
- do not append params such as `utm_source`, `utm_medium`, or `ref`

These rules should be treated as integration requirements, not optional suggestions.

## Response Shape

The provided PHP sample shows this parsing pattern:

```php
$jobs = json_decode($data, true)[2];
```

That implies the response is not a standard object like `{ "jobs": [...] }`.

Assumptions that must be verified at runtime:

1. the response body parses as JSON
2. the top-level JSON value is an array
3. index `2` exists
4. index `2` contains an array of jobs

If any of those assumptions fail, the connector should raise a clear parse error and log the raw payload shape.

## Example Fields From The Email

The sample code indicates the following fields are available per job:

| Field | Notes |
|---|---|
| `id` | Source job identifier |
| `title` | Job title |
| `date` | Human-readable date |
| `date_epoch` | Timestamp |
| `country` | Country |
| `city` | City |
| `company` | Company name |
| `location` | Raw location string |
| `apply_url` | Canonical apply link |
| `tags` | Array of tags |
| `description` | Source description |

## URL Parameters

Parameters can be combined, for example:

```text
?country=france&tag=react
```

Available parameters from the email:

| Parameter | Example | Notes |
|---|---|---|
| `remote` | `true` | remote-only view |
| `limit` | `100` | default `50`, maximum `100` |
| `country` | `united-states` | source-side country filter |
| `tag` | `react` | source-side tag filter |
| `show_description` | `false` | omit description from payload |

## Recommended Integration Defaults

- use `limit=100`
- do not pre-filter by `country`
- do not pre-filter by `remote`
- keep descriptions enabled for classifier quality
- preserve `tags` in raw payload even if the pipeline does not use them yet

Reasoning:

- the existing router already decides what to publish, review, or reject
- early source filtering reduces visibility and makes quality tuning harder
- keeping descriptions improves classification accuracy

## Dedupe Strategy

Recommended source identity:

```text
source = web3_career
dedupe_key = web3_career:{id}
```

Fallback if needed:

```text
SHA256(source + company + title + apply_url)
```

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Token is committed or leaked | API access risk | store token only in `.env` and secrets |
| `apply_url` is modified | policy violation | preserve URL exactly as received |
| JSON shape changes | connector failure | validate structure before processing |
| Web3-specific titles increase false positives | irrelevant jobs published | rely on review queue and tune classifier |
| Source-side filtering hides useful jobs | missed opportunities | avoid aggressive fetch-time filtering |