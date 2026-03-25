const WORK_MODE_EMOJI = {
  remote: '🌍',
  onsite: '🏢',
  hybrid: '🔄',
  unknown: '❓',
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
  const tags = buildTags(job);
  const summary = buildSummary(job.description_text);

  let message = `🔍 <b>${escapeHtml(job.title)}</b>\n`;
  message += `🏢 ${escapeHtml(job.company)}\n`;
  message += `📍 ${escapeHtml(job.location_text || 'Not specified')} | ${emoji} ${job.work_mode}\n`;
  message += `🔗 <a href="${escapeHtml(job.job_url)}">Apply</a>\n`;

  if (summary) {
    message += `\n${escapeHtml(summary)}\n`;
  }

  if (tags) {
    message += `\n${tags}`;
  }

  return message;
}

/**
 * Format a job for admin review in Telegram.
 */
export function formatReviewMessage(job) {
  const emoji = WORK_MODE_EMOJI[job.work_mode] || '❓';

  let message = `🔍 <b>Review needed</b>\n\n`;
  message += `<b>Title:</b> ${escapeHtml(job.title)}\n`;
  message += `<b>Company:</b> ${escapeHtml(job.company)}\n`;
  message += `<b>Location:</b> ${escapeHtml(job.location_text || 'N/A')} | ${emoji} ${job.work_mode}\n`;
  message += `<b>Source:</b> ${job.source}/${job.source_board_token}\n`;
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
