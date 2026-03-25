import fetch from 'node-fetch';

const PUBLISH_DELAY_MS = parseInt(process.env.PUBLISH_DELAY_MS || '1000', 10);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Send a message to a Telegram chat/topic.
 * Returns the Telegram message_id on success.
 */
export async function sendMessage(botToken, chatId, topicId, text, replyMarkup = null) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const body = {
    chat_id: chatId,
    message_thread_id: topicId ? Number(topicId) : undefined,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };

  if (replyMarkup) {
    body.reply_markup = JSON.stringify(replyMarkup);
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!data.ok) {
    throw new Error(`Telegram sendMessage error: ${JSON.stringify(data)}`);
  }

  return data.result.message_id;
}

/**
 * Get pending updates (callback queries) from a bot.
 * Uses long-polling with offset to consume processed updates.
 */
export async function getUpdates(botToken, offset = 0) {
  const url = `https://api.telegram.org/bot${botToken}/getUpdates`;
  const body = {
    offset,
    timeout: 5,
    allowed_updates: ['callback_query'],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!data.ok) {
    throw new Error(`Telegram getUpdates error: ${JSON.stringify(data)}`);
  }

  return data.result || [];
}

/**
 * Answer a callback query to remove the loading indicator.
 */
export async function answerCallbackQuery(botToken, callbackQueryId, text = '') {
  const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
  const body = {
    callback_query_id: callbackQueryId,
    text,
  };

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * Publish a job to the correct Telegram topic.
 * Returns the message_id.
 */
export async function publishJob(job, messageText) {
  const isQa = job.publish_target === 'qa';
  const botToken = isQa ? process.env.QA_BOT_TOKEN : process.env.DEV_BOT_TOKEN;
  const topicId = isQa ? process.env.QA_TOPIC_ID : process.env.DEV_TOPIC_ID;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const messageId = await sendMessage(botToken, chatId, topicId, messageText);
  await sleep(PUBLISH_DELAY_MS);
  return messageId;
}
