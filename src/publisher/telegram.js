import fetch from 'node-fetch';

const PUBLISH_DELAY_MS = parseInt(process.env.PUBLISH_DELAY_MS || '1000', 10);
const TELEGRAM_MAX_RETRIES = parseInt(process.env.TELEGRAM_MAX_RETRIES || '3', 10);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildRequestBody(chatId, topicId, replyMarkup = null) {
  const body = {
    chat_id: chatId,
    message_thread_id: topicId ? Number(topicId) : undefined,
  };

  if (replyMarkup) {
    body.reply_markup = JSON.stringify(replyMarkup);
  }

  return body;
}

async function telegramPost(botToken, method, body) {
  const url = `https://api.telegram.org/bot${botToken}/${method}`;
  for (let attempt = 0; attempt <= TELEGRAM_MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (data.ok) {
      return data.result;
    }

    const retryAfter = data?.parameters?.retry_after;
    if (data.error_code === 429 && retryAfter && attempt < TELEGRAM_MAX_RETRIES) {
      await sleep((Number(retryAfter) + 1) * 1000);
      continue;
    }

    throw new Error(`Telegram ${method} error: ${JSON.stringify(data)}`);
  }

  throw new Error(`Telegram ${method} error: exceeded retry limit`);
}

function resolveUrl(url, baseUrl) {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractMetaContent(html, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return null;
}

async function resolveBannerUrl(job) {
  try {
    const res = await fetch(job.job_url, { redirect: 'follow' });
    if (!res.ok) return null;

    const html = await res.text();
    const imageUrl = extractMetaContent(html, [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["'][^>]*>/i,
      /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["'][^>]*>/i,
    ]);

    return imageUrl ? resolveUrl(imageUrl, res.url || job.job_url) : null;
  } catch {
    return null;
  }
}

async function sendPhoto(botToken, chatId, topicId, photoUrl, caption, replyMarkup = null) {
  const body = {
    ...buildRequestBody(chatId, topicId, replyMarkup),
    photo: photoUrl,
    caption,
    parse_mode: 'HTML',
  };

  const result = await telegramPost(botToken, 'sendPhoto', body);
  return result.message_id;
}

/**
 * Send a message to a Telegram chat/topic.
 * Returns the Telegram message_id on success.
 */
export async function sendMessage(botToken, chatId, topicId, text, replyMarkup = null) {
  const body = {
    ...buildRequestBody(chatId, topicId, replyMarkup),
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };

  const result = await telegramPost(botToken, 'sendMessage', body);
  return result.message_id;
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
export async function publishJob(job, post) {
  const isQa = job.publish_target === 'qa';
  const botToken = isQa ? process.env.QA_BOT_TOKEN : process.env.DEV_BOT_TOKEN;
  const topicId = isQa ? process.env.QA_TOPIC_ID : process.env.DEV_TOPIC_ID;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const bannerUrl = await resolveBannerUrl(job);
  const messageId = bannerUrl
    ? await sendPhoto(botToken, chatId, topicId, bannerUrl, post.text, post.replyMarkup)
    : await sendMessage(botToken, chatId, topicId, post.text, post.replyMarkup);

  await sleep(PUBLISH_DELAY_MS);
  return messageId;
}
