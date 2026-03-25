import { getUpdates, answerCallbackQuery } from '../publisher/telegram.js';
import { approveJob, rejectJob } from '../dedup/dedup.js';

/**
 * Process pending review responses from Telegram.
 * Reads callback queries via getUpdates and updates job statuses.
 * Returns counts of processed approvals and rejections.
 */
export async function processReviewUpdates() {
  const botToken = process.env.QA_BOT_TOKEN;
  let offset = 0;
  let approvedCount = 0;
  let rejectedCount = 0;

  const updates = await getUpdates(botToken, offset);

  for (const update of updates) {
    offset = update.update_id + 1;

    const callback = update.callback_query;
    if (!callback || !callback.data) continue;

    const data = callback.data;
    const adminId = String(callback.from?.id);

    // Only accept responses from the configured admin
    if (adminId !== process.env.ADMIN_CHAT_ID) {
      await answerCallbackQuery(botToken, callback.id, 'Unauthorized');
      continue;
    }

    try {
      if (data.startsWith('approve_qa_')) {
        const jobId = data.replace('approve_qa_', '');
        await approveJob(jobId, 'qa');
        await answerCallbackQuery(botToken, callback.id, '✅ Approved as QA');
        approvedCount++;
        console.log(`[review] Approved job ${jobId} as QA`);
      } else if (data.startsWith('approve_dev_')) {
        const jobId = data.replace('approve_dev_', '');
        await approveJob(jobId, 'developer');
        await answerCallbackQuery(botToken, callback.id, '✅ Approved as Developer');
        approvedCount++;
        console.log(`[review] Approved job ${jobId} as Developer`);
      } else if (data.startsWith('reject_')) {
        const jobId = data.replace('reject_', '');
        await rejectJob(jobId);
        await answerCallbackQuery(botToken, callback.id, '❌ Rejected');
        rejectedCount++;
        console.log(`[review] Rejected job ${jobId}`);
      }
    } catch (err) {
      console.error(`[review] Error processing callback ${data}: ${err.message}`);
      await answerCallbackQuery(botToken, callback.id, 'Error processing');
    }
  }

  // Consume processed updates so they don't repeat
  if (offset > 0) {
    await getUpdates(botToken, offset);
  }

  return { approvedCount, rejectedCount };
}
