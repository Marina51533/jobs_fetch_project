import { convert } from 'html-to-text';
import { extractWorkMode, extractCountry } from './location.js';

function toDescriptionText(descriptionRaw) {
  return descriptionRaw
    ? convert(descriptionRaw, { wordwrap: false })
    : '';
}

function toIsoDate(rawJob) {
  if (rawJob.date_epoch) {
    const numericEpoch = Number(rawJob.date_epoch);
    if (Number.isFinite(numericEpoch) && numericEpoch > 0) {
      const epochMs = numericEpoch > 10_000_000_000 ? numericEpoch : numericEpoch * 1000;
      return new Date(epochMs).toISOString();
    }
  }

  if (rawJob.date) {
    const timestamp = Date.parse(rawJob.date);
    if (!Number.isNaN(timestamp)) {
      return new Date(timestamp).toISOString();
    }
  }

  return null;
}

function buildWeb3Location(rawJob) {
  if (rawJob.location && String(rawJob.location).trim()) {
    return String(rawJob.location).trim();
  }

  const parts = [rawJob.city, rawJob.country]
    .map(value => String(value || '').trim())
    .filter(Boolean);
  return parts.join(', ');
}

/**
 * Normalize a raw Greenhouse job object into the internal Job schema.
 */
export function normalizeJob(rawJob, boardToken, company) {
  const locationName = rawJob.location?.name || '';
  const workMode = extractWorkMode(locationName);
  const country = extractCountry(locationName);

  const descriptionRaw = rawJob.content || '';
  const descriptionText = toDescriptionText(descriptionRaw);

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
 * Normalize a raw Web3 Career job into the internal Job schema.
 */
export function normalizeWeb3Job(rawJob) {
  const locationText = buildWeb3Location(rawJob);
  const workMode = extractWorkMode(locationText);
  const country = rawJob.country ? String(rawJob.country).trim().toLowerCase() : extractCountry(locationText);
  const descriptionRaw = rawJob.description || '';
  const descriptionText = toDescriptionText(descriptionRaw);

  return {
    source: 'web3_career',
    source_job_id: String(rawJob.id),
    source_board_token: null,
    dedupe_key: `web3_career:${rawJob.id}`,
    company: rawJob.company || 'Unknown company',
    title: rawJob.title || '',
    location_text: locationText,
    location_country: country,
    work_mode: workMode,
    job_url: rawJob.apply_url || '',
    updated_at_source: toIsoDate(rawJob),
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
