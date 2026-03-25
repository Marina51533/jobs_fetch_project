import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

import db from '../db.js';
import { migrate } from '../migrate.js';
import { fetchAllBoards, fetchJobDetail } from '../sources/greenhouse.js';
import { normalizeJob } from '../normalizer/normalize.js';
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

  const boards = await loadBoards();
  console.log(`[config] Loaded ${boards.length} board tokens`);

  const boardResults = await fetchAllBoards(boards);

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

  return stats;
}

/**
 * Main pipeline entry point.
 */
async function main() {
  console.log('========================================');
  console.log(' Job Aggregation Pipeline');
  console.log(` Started: ${new Date().toISOString()}`);
  console.log('========================================');

  try {
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
