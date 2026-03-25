import crypto from 'crypto';
import { query } from '../db.js';

/**
 * Compute fallback dedupe hash from job fields.
 */
export function computeDedupeHash(job) {
  const input = `${job.source}|${job.company}|${job.title}|${job.job_url}`;
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Check if a job already exists in the database.
 * Returns true if the job is a duplicate (should be skipped).
 */
export async function isDuplicate(dedupeKey) {
  const result = await query(
    'SELECT id FROM jobs WHERE dedupe_key = $1 LIMIT 1',
    [dedupeKey]
  );
  return result.rows.length > 0;
}

/**
 * Save a normalized job to the database.
 * Returns the inserted row.
 */
export async function saveJob(job) {
  const dedupeHash = computeDedupeHash(job);

  const result = await query(
    `INSERT INTO jobs (
      source, source_job_id, source_board_token, dedupe_key, dedupe_hash,
      company, title, location_text, location_country, work_mode,
      job_url, updated_at_source, fetched_at,
      description_raw, description_text,
      classification_label, classification_confidence, classification_reasons,
      geo_decision, final_decision, review_status, publish_target,
      raw_payload, processing_status
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      $11, $12, NOW(),
      $13, $14,
      $15, $16, $17,
      $18, $19, $20, $21,
      $22, $23
    )
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING id`,
    [
      job.source, job.source_job_id, job.source_board_token,
      job.dedupe_key, dedupeHash,
      job.company, job.title, job.location_text, job.location_country,
      job.work_mode, job.job_url, job.updated_at_source,
      job.description_raw, job.description_text,
      job.classification_label, job.classification_confidence,
      job.classification_reasons ? JSON.stringify(job.classification_reasons) : null,
      job.geo_decision, job.final_decision, job.review_status, job.publish_target,
      JSON.stringify(job.raw_payload), job.processing_status || 'new',
    ]
  );

  return result.rows[0] || null;
}

/**
 * Update a job's classification, routing, and status fields.
 */
export async function updateJobDecisions(dedupeKey, updates) {
  await query(
    `UPDATE jobs SET
      classification_label = $2,
      classification_confidence = $3,
      classification_reasons = $4,
      geo_decision = $5,
      final_decision = $6,
      review_status = $7,
      publish_target = $8,
      processing_status = $9,
      updated_at = NOW()
    WHERE dedupe_key = $1`,
    [
      dedupeKey,
      updates.classification_label,
      updates.classification_confidence,
      updates.classification_reasons ? JSON.stringify(updates.classification_reasons) : null,
      updates.geo_decision,
      updates.final_decision,
      updates.review_status,
      updates.publish_target,
      updates.processing_status || 'processed',
    ]
  );
}

/**
 * Mark a job as published.
 */
export async function markPublished(jobId, botName, telegramMessageId) {
  await query(
    `UPDATE jobs SET
      published_at = NOW(),
      published_by_bot = $2,
      telegram_message_id = $3,
      processing_status = 'published',
      updated_at = NOW()
    WHERE id = $1`,
    [jobId, botName, String(telegramMessageId)]
  );
}

/**
 * Get jobs pending review.
 */
export async function getPendingReviewJobs() {
  const result = await query(
    `SELECT * FROM jobs
     WHERE review_status = 'pending'
     ORDER BY created_at ASC`
  );
  return result.rows;
}

/**
 * Approve a reviewed job.
 */
export async function approveJob(jobId, publishTarget) {
  await query(
    `UPDATE jobs SET
      review_status = 'approved',
      publish_target = $2,
      updated_at = NOW()
    WHERE id = $1`,
    [jobId, publishTarget]
  );
}

/**
 * Reject a reviewed job.
 */
export async function rejectJob(jobId) {
  await query(
    `UPDATE jobs SET
      review_status = 'rejected',
      processing_status = 'processed',
      updated_at = NOW()
    WHERE id = $1`,
    [jobId]
  );
}

/**
 * Get approved jobs that have not been published yet.
 */
export async function getApprovedUnpublished() {
  const result = await query(
    `SELECT * FROM jobs
     WHERE review_status = 'approved'
       AND published_at IS NULL
     ORDER BY created_at ASC`
  );
  return result.rows;
}
