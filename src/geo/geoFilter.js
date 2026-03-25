import { isNonEuRestricted, isEuRegion, isExplicitNonEuropeanLocation } from '../normalizer/location.js';

/**
 * Apply geography filter to a normalized job.
 *
 * Decision matrix:
 *   remote + worldwide/unspecified  → publish
 *   remote + EU/EMEA region         → publish
 *   remote + non-EU restricted      → reject
 *   onsite + European location      → publish
 *   onsite + non-European           → reject
 *   onsite + ambiguous              → review
 *   hybrid + European location      → publish
 *   hybrid + non-European/ambiguous → review
 *   unknown work mode               → review
 *
 * @param {object} job - Normalized job with work_mode, location_text, location_country
 * @returns {'publish'|'reject'|'review'}
 */
export function applyGeoFilter(job) {
  const { work_mode, location_text, location_country } = job;

  if (work_mode === 'remote') {
    if (isNonEuRestricted(location_text)) return 'reject';
    // Remote worldwide, EU-region, or unspecified → allowed
    return 'publish';
  }

  if (work_mode === 'onsite') {
    if (location_country) return 'publish';      // country was resolved to Europe
    if (isEuRegion(location_text)) return 'publish';
    if (isExplicitNonEuropeanLocation(location_text)) return 'reject';
    if (isNonEuRestricted(location_text)) return 'reject';
    // Ambiguous onsite
    return location_text ? 'review' : 'review';
  }

  if (work_mode === 'hybrid') {
    if (location_country) return 'publish';
    if (isEuRegion(location_text)) return 'publish';
    if (isExplicitNonEuropeanLocation(location_text)) return 'reject';
    // Hybrid with unclear location
    return 'review';
  }

  // unknown work mode
  return 'review';
}
