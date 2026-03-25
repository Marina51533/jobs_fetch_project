import { convert } from 'html-to-text';
import { extractWorkMode, extractCountry } from './location.js';

/**
 * Normalize a raw Greenhouse job object into the internal Job schema.
 */
export function normalizeJob(rawJob, boardToken, company) {
  const locationName = rawJob.location?.name || '';
  const workMode = extractWorkMode(locationName);
  const country = extractCountry(locationName);

  const descriptionRaw = rawJob.content || '';
  const descriptionText = descriptionRaw
    ? convert(descriptionRaw, { wordwrap: false })
    : '';

  return {
    source: 'greenhouse',
    source_job_id: String(rawJob.id),
    source_board_token: boardToken,
    dedupe_key: `greenhouse:${boardToken}:${rawJob.id}`,
    company,
    title: rawJob.title || '',
    location_text: locationName,
    location_country: country,
    work_mode: workMode,
    job_url: rawJob.absolute_url || '',
    updated_at_source: rawJob.updated_at || null,
    description_raw: descriptionRaw,
    description_text: descriptionText,
    raw_payload: rawJob,
  };
}

/**
 * Normalize an array of raw Greenhouse jobs from one board.
 */
export function normalizeBoard(rawJobs, boardToken, company) {
  return rawJobs.map(j => normalizeJob(j, boardToken, company));
}
