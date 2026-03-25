import { sendMessage } from '../publisher/telegram.js';
import { formatReviewMessage } from '../publisher/formatter.js';

/**
 * Send uncertain jobs to the admin for review.
 * Attaches inline keyboard with approve/reject buttons.
 */
export async function sendForReview(job) {
  const botToken = process.env.QA_BOT_TOKEN;
  const reviewChatId = process.env.REVIEW_CHAT_ID || process.env.ADMIN_CHAT_ID;

  const text = formatReviewMessage(job);
  const replyMarkup = {
    inline_keyboard: [[
      { text: '✅ QA', callback_data: `approve_qa_${job.id}` },
      { text: '✅ Dev', callback_data: `approve_dev_${job.id}` },
      { text: '❌ Skip', callback_data: `reject_${job.id}` },
    ]],
  };

  const messageId = await sendMessage(botToken, reviewChatId, null, text, replyMarkup);
  console.log(`[review] Sent job ${job.id} (${job.title}) for review, msg=${messageId}`);
  return messageId;
}
