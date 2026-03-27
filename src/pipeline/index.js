import 'dotenv/config';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

import db from '../db.js';
import { migrate } from '../migrate.js';
import { fetchAllBoards, fetchJobDetail } from '../sources/greenhouse.js';
import { fetchWeb3Jobs } from '../sources/web3Career.js';
import { normalizeJob, normalizeWeb3Job } from '../normalizer/normalize.js';
import { isDuplicate, saveJob, updateJobDecisions, markPublished, getApprovedUnpublished } from '../dedup/dedup.js';
import { classifyJobs } from '../classifier/classify.js';
import { applyGeoFilter } from '../geo/geoFilter.js';
import { routeJob } from './router.js';
import { formatJobPost } from '../publisher/formatter.js';
import { publishJob } from '../publisher/telegram.js';
import { sendForReview } from '../review/reviewSender.js';
import { processReviewUpdates } from '../review/review.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOARDS_PATH = path.resolve(__dirname, '../../config/boards.json');
const CONFIDENCE_THRESHOLD = parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.8');
const FETCH_DELAY_MS = parseInt(process.env.FETCH_DELAY_MS || '200', 10);
const MAX_SOURCE_JOB_AGE_DAYS = parseInt(process.env.MAX_SOURCE_JOB_AGE_DAYS || '0', 10);
const SOURCE_MODE = (process.env.SOURCE_MODE || 'all').trim().toLowerCase();

function shouldRunGreenhouse() {
  return SOURCE_MODE === 'all' || SOURCE_MODE === 'greenhouse';
}

function shouldRunWeb3() {
  return SOURCE_MODE === 'all' || SOURCE_MODE === 'web3';
}

function validateEnv() {
  const required = [
    'QA_BOT_TOKEN',
    'DEV_BOT_TOKEN',
    'TELEGRAM_CHAT_ID',
    'QA_TOPIC_ID',
    'DEV_TOPIC_ID',
    'ADMIN_CHAT_ID',
  ];

  const missing = required.filter(name => !process.env[name] || !String(process.env[name]).trim());
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}. Copy .env.example to .env and fill in the Telegram values.`);
  }

  if (String(process.env.ADMIN_CHAT_ID).startsWith('-')) {
    throw new Error('ADMIN_CHAT_ID must be the approving user\'s Telegram user ID, not a group or channel ID. Use REVIEW_CHAT_ID for the admin review group/chat destination.');
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isWithinAgeLimit(updatedAt, maxAgeDays) {
  if (!maxAgeDays || maxAgeDays <= 0) return true;
  if (!updatedAt) return false;

  const timestamp = Date.parse(updatedAt);
  if (Number.isNaN(timestamp)) return false;

  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  return (Date.now() - timestamp) <= maxAgeMs;
}

async function loadBoards() {
  const raw = await readFile(BOARDS_PATH, 'utf-8');
  const config = JSON.parse(raw);
  return config.boards;
}

/**
 * Stage 1: Process pending review approvals/rejections from Telegram.
 * Then publish any newly approved jobs.
 */
async function stageProcessReviews() {
  console.log('\n=== Stage 1: Process review updates ===');

  const { approvedCount, rejectedCount } = await processReviewUpdates();
  console.log(`[reviews] Processed: ${approvedCount} approved, ${rejectedCount} rejected`);

  // Publish newly approved jobs
  const approvedJobs = await getApprovedUnpublished();
  let publishedCount = 0;

  for (const job of approvedJobs) {
    try {
      const post = formatJobPost(job);
      const messageId = await publishJob(job, post);
      await markPublished(
        job.id,
        job.publish_target === 'qa' ? 'qa_bot' : 'dev_bot',
        messageId
      );
      publishedCount++;
      console.log(`[publish] Published approved job: ${job.title} → ${job.publish_target}`);
    } catch (err) {
      console.error(`[publish] Failed to publish approved job ${job.id}: ${err.message}`);
    }
  }

  console.log(`[reviews] Published ${publishedCount} approved jobs`);
}

/**
 * Stage 2: Fetch, normalize, dedupe, classify, filter, route, publish/review new jobs.
 */
async function stageFetchAndProcess() {
  console.log('\n=== Stage 2: Fetch and process new jobs ===');

  let boardResults = [];
  if (shouldRunGreenhouse()) {
    const boards = await loadBoards();
    console.log(`[config] Loaded ${boards.length} board tokens`);
    boardResults = await fetchAllBoards(boards);
  } else {
    console.log('[config] Greenhouse fetch disabled for this run');
  }

  let web3Result = { jobs: [], skipped: true };
  if (shouldRunWeb3()) {
    try {
      web3Result = await fetchWeb3Jobs();
    } catch (err) {
      console.error(`[web3] FAILED — ${err.message}`);
    }
  } else {
    web3Result = { jobs: [], skipped: true, reason: 'disabled for this run' };
  }

  const stats = {
    fetched: 0,
    duplicates: 0,
    classified: 0,
    autoPublished: 0,
    sentToReview: 0,
    rejected: 0,
    errors: 0,
  };

  for (const boardResult of boardResults) {
    if (boardResult.error) continue;

    const { boardToken, company, jobs: rawJobs } = boardResult;
    console.log(`\n[board] Processing ${boardToken} (${rawJobs.length} jobs)`);

    // Collect new jobs for batch classification
    const newJobs = [];

    for (const rawJob of rawJobs) {
      stats.fetched++;
      const dedupeKey = `greenhouse:${boardToken}:${rawJob.id}`;

      if (!isWithinAgeLimit(rawJob.updated_at, MAX_SOURCE_JOB_AGE_DAYS)) {
        continue;
      }

      if (await isDuplicate(dedupeKey)) {
        stats.duplicates++;
        continue;
      }

      // Fetch full description for new jobs
      let fullJob = rawJob;
      try {
        fullJob = await fetchJobDetail(boardToken, rawJob.id);
        await sleep(FETCH_DELAY_MS);
      } catch (err) {
        console.error(`[detail] Failed to fetch detail for ${boardToken}/${rawJob.id}: ${err.message}`);
      }

      const normalized = normalizeJob(fullJob, boardToken, company);
      newJobs.push(normalized);
    }

    if (newJobs.length === 0) {
      console.log(`[board] ${boardToken}: no new jobs`);
      continue;
    }

    // Batch classify
    let classifications;
    try {
      classifications = await classifyJobs(newJobs);
      stats.classified += classifications.length;
    } catch (err) {
      console.error(`[classify] Classifier failed for ${boardToken}: ${err.message}`);
      stats.errors += newJobs.length;
      continue;
    }

    // Process each classified job
    for (let i = 0; i < newJobs.length; i++) {
      const job = newJobs[i];
      const classification = classifications[i];

      try {
        // Geography filter
        const geoDecision = applyGeoFilter(job);

        // Route
        const routing = routeJob(classification, geoDecision, CONFIDENCE_THRESHOLD);

        // Enrich job with decisions
        const enrichedJob = {
          ...job,
          classification_label: classification.label,
          classification_confidence: classification.confidence,
          classification_reasons: classification.reasons,
          geo_decision: geoDecision,
          final_decision: routing.final_decision,
          review_status: routing.review_status,
          publish_target: routing.publish_target,
          processing_status: 'processed',
        };

        // Save to database
        const saved = await saveJob(enrichedJob);
        if (!saved) {
          stats.duplicates++;
          continue;
        }

        // Act on decision
        if (routing.final_decision === 'auto_publish') {
          const post = formatJobPost({ ...enrichedJob, id: saved.id });
          const messageId = await publishJob(enrichedJob, post);
          await markPublished(
            saved.id,
            routing.publish_target === 'qa' ? 'qa_bot' : 'dev_bot',
            messageId
          );
          stats.autoPublished++;
          console.log(`[publish] ${job.title} → ${routing.publish_target}`);
        } else if (routing.final_decision === 'review') {
          await sendForReview({ ...enrichedJob, id: saved.id });
          stats.sentToReview++;
        } else {
          stats.rejected++;
          console.log(`[reject] ${job.title} — geo:${geoDecision} class:${classification.label}`);
        }
      } catch (err) {
        console.error(`[process] Error processing ${job.title}: ${err.message}`);
        stats.errors++;
      }
    }

    console.log(`[board] ${boardToken}: done`);
  }

  if (web3Result.skipped) {
    console.log(`[web3] Skipped — ${web3Result.reason}`);
    return stats;
  }

  console.log(`\n[source] Processing web3_career (${web3Result.jobs.length} jobs)`);
  const newWeb3Jobs = [];

  for (const rawJob of web3Result.jobs) {
    stats.fetched++;
    const dedupeKey = `web3_career:${rawJob.id}`;

    const updatedAt = rawJob.date_epoch
      ? (() => {
          const numericEpoch = Number(rawJob.date_epoch);
          if (!Number.isFinite(numericEpoch) || numericEpoch <= 0) return null;
          const epochMs = numericEpoch > 10_000_000_000 ? numericEpoch : numericEpoch * 1000;
          return new Date(epochMs).toISOString();
        })()
      : rawJob.date || null;

    if (!isWithinAgeLimit(updatedAt, MAX_SOURCE_JOB_AGE_DAYS)) {
      continue;
    }

    if (await isDuplicate(dedupeKey)) {
      stats.duplicates++;
      continue;
    }

    newWeb3Jobs.push(normalizeWeb3Job(rawJob));
  }

  if (newWeb3Jobs.length > 0) {
    let classifications;
    try {
      classifications = await classifyJobs(newWeb3Jobs);
      stats.classified += classifications.length;
    } catch (err) {
      console.error(`[classify] Classifier failed for web3_career: ${err.message}`);
      stats.errors += newWeb3Jobs.length;
      return stats;
    }

    for (let i = 0; i < newWeb3Jobs.length; i++) {
      const job = newWeb3Jobs[i];
      const classification = classifications[i];

      try {
        const geoDecision = applyGeoFilter(job);
        const routing = routeJob(classification, geoDecision, CONFIDENCE_THRESHOLD);

        const enrichedJob = {
          ...job,
          classification_label: classification.label,
          classification_confidence: classification.confidence,
          classification_reasons: classification.reasons,
          geo_decision: geoDecision,
          final_decision: routing.final_decision,
          review_status: routing.review_status,
          publish_target: routing.publish_target,
          processing_status: 'processed',
        };

        const saved = await saveJob(enrichedJob);
        if (!saved) {
          stats.duplicates++;
          continue;
        }

        if (routing.final_decision === 'auto_publish') {
          const post = formatJobPost({ ...enrichedJob, id: saved.id });
          const messageId = await publishJob(enrichedJob, post);
          await markPublished(
            saved.id,
            routing.publish_target === 'qa' ? 'qa_bot' : 'dev_bot',
            messageId
          );
          stats.autoPublished++;
          console.log(`[publish] ${job.title} → ${routing.publish_target}`);
        } else if (routing.final_decision === 'review') {
          await sendForReview({ ...enrichedJob, id: saved.id });
          stats.sentToReview++;
        } else {
          stats.rejected++;
          console.log(`[reject] ${job.title} — geo:${geoDecision} class:${classification.label}`);
        }
      } catch (err) {
        console.error(`[process] Error processing ${job.title}: ${err.message}`);
        stats.errors++;
      }
    }
  } else {
    console.log('[web3] no new jobs');
  }

  return stats;
}

/**
 * Main pipeline entry point.
 */
async function main() {
  console.log('========================================');
  console.log(' Job Aggregation Pipeline');
  console.log(` Started: ${new Date().toISOString()}`);
  console.log(` Source mode: ${SOURCE_MODE}`);
  console.log('========================================');

  try {
    validateEnv();

    // Ensure schema is up to date
    await migrate();

    // Stage 1: Process pending reviews
    await stageProcessReviews();

    // Stage 2: Fetch and process new jobs
    const stats = await stageFetchAndProcess();

    console.log('\n========================================');
    console.log(' Run Summary');
    console.log('========================================');
    console.log(` Fetched:        ${stats.fetched}`);
    console.log(` Duplicates:     ${stats.duplicates}`);
    console.log(` Classified:     ${stats.classified}`);
    console.log(` Auto-published: ${stats.autoPublished}`);
    console.log(` Sent to review: ${stats.sentToReview}`);
    console.log(` Rejected:       ${stats.rejected}`);
    console.log(` Errors:         ${stats.errors}`);
    console.log(`\n Finished: ${new Date().toISOString()}`);
  } catch (err) {
    console.error(`[FATAL] Pipeline failed: ${err.message}`);
    console.error(err.stack);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
}

main();
