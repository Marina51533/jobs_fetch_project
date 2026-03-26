const WORK_MODE_EMOJI = {
  remote: '🌍',
  onsite: '🏢',
  hybrid: '🔄',
  unknown: '❓',
};

const WORK_MODE_LABEL = {
  remote: 'Remote',
  onsite: 'On-site',
  hybrid: 'Hybrid',
  unknown: 'Not specified',
};

/**
 * Escape HTML special characters for Telegram HTML parse mode.
 */
function escapeHtml(text) {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function pluralize(value, unit) {
  return `${value} ${unit}${value === 1 ? '' : 's'} ago`;
}

function formatPostedAt(isoDate) {
  if (!isoDate) return 'Recently posted';

  const timestamp = Date.parse(isoDate);
  if (Number.isNaN(timestamp)) return 'Recently posted';

  const diffMs = Date.now() - timestamp;
  if (diffMs <= 0) return 'Today';

  const minutes = Math.floor(diffMs / (60 * 1000));
  if (minutes < 60) return pluralize(Math.max(minutes, 1), 'minute');

  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 24) return pluralize(hours, 'hour');

  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days < 7) return pluralize(days, 'day');

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return pluralize(weeks, 'week');

  const months = Math.floor(days / 30);
  if (months < 12) return pluralize(months, 'month');

  const years = Math.floor(days / 365);
  return pluralize(years, 'year');
}

function buildShareUrl(job) {
  const shareText = `${job.title} at ${job.company}`;
  return `https://t.me/share/url?url=${encodeURIComponent(job.job_url)}&text=${encodeURIComponent(shareText)}`;
}

/**
 * Build tags string from classification reasons.
 */
function buildTags(job) {
  const tags = [];
  if (job.work_mode && job.work_mode !== 'unknown') {
    tags.push(`#${job.work_mode}`);
  }
  if (job.publish_target) {
    tags.push(`#${job.publish_target}`);
  }
  if (job.source) {
    tags.push(`#${job.source}`);
  }
  if (job.location_country) {
    const countryTag = job.location_country
      .replace(/[^a-zA-Z]/g, '')
      .toLowerCase();
    if (countryTag) tags.push(`#${countryTag}`);
  }
  return tags.join(' ');
}

/**
 * Generate a short summary from the description (first ~200 chars).
 */
function buildSummary(descriptionText) {
  if (!descriptionText) return '';
  const clean = descriptionText.replace(/\n+/g, ' ').trim();
  if (clean.length <= 200) return clean;
  return clean.slice(0, 197) + '...';
}

/**
 * Format a job for Telegram publishing.
 */
export function formatJobPost(job) {
  const emoji = WORK_MODE_EMOJI[job.work_mode] || '❓';
  const typeLabel = WORK_MODE_LABEL[job.work_mode] || WORK_MODE_LABEL.unknown;
  const postedAtLabel = formatPostedAt(job.updated_at_source);
  const locationLabel = job.location_text || 'Not specified';

  let message = `💼 <b>${escapeHtml(job.title)}</b>\n`;
  message += `🏢 <b>${escapeHtml(job.company)}</b>\n`;
  message += `📍 ${escapeHtml(locationLabel)}\n`;
  message += `${emoji} ${escapeHtml(typeLabel)}\n`;
  message += `🕒 Posted ${escapeHtml(postedAtLabel)}\n`;
  message += `✅ <a href="${escapeHtml(job.job_url)}">Apply now</a>`;

  return {
    text: message,
    replyMarkup: {
      inline_keyboard: [[
        { text: '✅ Apply', url: job.job_url },
        { text: '↗️ Share', url: buildShareUrl(job) },
      ]],
    },
  };
}

/**
 * Format a job for admin review in Telegram.
 */
export function formatReviewMessage(job) {
  const emoji = WORK_MODE_EMOJI[job.work_mode] || '❓';
  const sourceRef = job.source_board_token
    ? `${job.source}/${job.source_board_token}`
    : job.source;

  let message = `🔍 <b>Review needed</b>\n\n`;
  message += `<b>Title:</b> ${escapeHtml(job.title)}\n`;
  message += `<b>Company:</b> ${escapeHtml(job.company)}\n`;
  message += `<b>Location:</b> ${escapeHtml(job.location_text || 'N/A')} | ${emoji} ${job.work_mode}\n`;
  message += `<b>Source:</b> ${escapeHtml(sourceRef)}\n`;
  message += `<b>URL:</b> <a href="${escapeHtml(job.job_url)}">View job</a>\n\n`;
  message += `<b>Suggested:</b> ${job.classification_label} (confidence: ${job.classification_confidence})\n`;

  const reasons = job.classification_reasons;
  if (reasons) {
    const reasonList = typeof reasons === 'string' ? JSON.parse(reasons) : reasons;
    message += `<b>Reasons:</b> ${reasonList.join(', ')}\n`;
  }

  message += `\n<b>Geo decision:</b> ${job.geo_decision}`;

  return message;
}
