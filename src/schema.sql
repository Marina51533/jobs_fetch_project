-- Job Aggregation MVP — Database Schema
-- SQLite 3.35+

CREATE TABLE IF NOT EXISTS jobs (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Source identification
  source              TEXT NOT NULL,
  source_job_id       TEXT NOT NULL,
  source_board_token  TEXT NOT NULL,
  dedupe_key          TEXT NOT NULL,
  dedupe_hash         TEXT,

  -- Job content
  company             TEXT NOT NULL,
  title               TEXT NOT NULL,
  location_text       TEXT,
  location_country    TEXT,
  work_mode           TEXT NOT NULL DEFAULT 'unknown',
  job_url             TEXT NOT NULL,
  updated_at_source   TEXT,
  fetched_at          TEXT NOT NULL DEFAULT (datetime('now')),
  description_raw     TEXT,
  description_text    TEXT,

  -- Classification
  classification_label      TEXT,
  classification_confidence REAL,
  classification_reasons    TEXT,

  -- Geography & routing
  geo_decision        TEXT,
  final_decision      TEXT,

  -- Review
  review_status       TEXT,
  publish_target      TEXT,

  -- Publishing
  published_at        TEXT,
  published_by_bot    TEXT,
  telegram_message_id TEXT,

  -- Raw data
  raw_payload         TEXT,

  -- Processing
  processing_status   TEXT NOT NULL DEFAULT 'new',
  error_message       TEXT,

  -- Timestamps
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_dedupe_key ON jobs (dedupe_key);

-- Fast pending review queries
CREATE INDEX IF NOT EXISTS idx_jobs_review_status ON jobs (review_status);

-- Publish queue
CREATE INDEX IF NOT EXISTS idx_jobs_publish_queue ON jobs (final_decision, published_at);

-- Per-board queries
CREATE INDEX IF NOT EXISTS idx_jobs_source_board ON jobs (source, source_board_token);
