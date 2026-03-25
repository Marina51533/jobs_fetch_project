/**
 * European countries for geography filtering.
 */
export const EUROPEAN_COUNTRIES = new Set([
  'albania', 'andorra', 'austria', 'belarus', 'belgium', 'bosnia and herzegovina',
  'bulgaria', 'croatia', 'cyprus', 'czech republic', 'czechia', 'denmark',
  'estonia', 'finland', 'france', 'germany', 'greece', 'hungary', 'iceland',
  'ireland', 'italy', 'kosovo', 'latvia', 'liechtenstein', 'lithuania',
  'luxembourg', 'malta', 'moldova', 'monaco', 'montenegro', 'netherlands',
  'north macedonia', 'norway', 'poland', 'portugal', 'romania', 'san marino',
  'serbia', 'slovakia', 'slovenia', 'spain', 'sweden', 'switzerland',
  'turkey', 'ukraine', 'united kingdom', 'uk', 'vatican city',
]);

/**
 * Common European city names (non-exhaustive, for fuzzy matching).
 */
export const EUROPEAN_CITIES = new Set([
  'amsterdam', 'athens', 'barcelona', 'belgrade', 'berlin', 'bern',
  'bratislava', 'brussels', 'bucharest', 'budapest', 'copenhagen',
  'dublin', 'edinburgh', 'florence', 'frankfurt', 'geneva', 'hamburg',
  'helsinki', 'istanbul', 'kyiv', 'lisbon', 'ljubljana', 'london',
  'luxembourg', 'lyon', 'madrid', 'milan', 'moscow', 'munich', 'naples',
  'nice', 'oslo', 'paris', 'prague', 'riga', 'rome', 'sofia',
  'stockholm', 'tallinn', 'the hague', 'vienna', 'vilnius', 'warsaw',
  'zagreb', 'zurich',
]);

/**
 * EU region identifiers (for "Remote EMEA" type strings).
 */
const EU_REGION_PATTERNS = [
  /\bemea\b/i,
  /\beu\b/i,
  /\beurope\b/i,
  /\beuro\b/i,
];

const NON_EU_REGION_PATTERNS = [
  /\bus\s+only\b/i,
  /\bunited\s+states\s+only\b/i,
  /\bamerica\s+only\b/i,
  /\bapac\s+only\b/i,
  /\basia\b/i,
  /\bcanada\s+only\b/i,
  /\blatin\s+america\b/i,
];

/**
 * Extract work mode from a location string.
 */
export function extractWorkMode(locationText) {
  const lower = (locationText || '').toLowerCase();

  if (!lower || lower === 'n/a') return 'unknown';

  const hasRemote = /\bremote\b/i.test(lower);
  const hasHybrid = /\bhybrid\b/i.test(lower);

  if (hasRemote && hasHybrid) return 'hybrid';
  if (hasHybrid) return 'hybrid';
  if (hasRemote) return 'remote';
  return 'onsite';
}

/**
 * Extract country from location string.
 * Returns the matched European country name (lowercase) or null.
 */
export function extractCountry(locationText) {
  const lower = (locationText || '').toLowerCase().trim();
  if (!lower) return null;

  // Check full country name matches
  for (const country of EUROPEAN_COUNTRIES) {
    if (lower.includes(country)) return country;
  }

  // Check city name matches
  for (const city of EUROPEAN_CITIES) {
    if (lower.includes(city)) return `europe (${city})`;
  }

  return null;
}

/**
 * Check if location indicates a specifically non-European remote restriction.
 */
export function isNonEuRestricted(locationText) {
  const lower = (locationText || '').toLowerCase();
  return NON_EU_REGION_PATTERNS.some(p => p.test(lower));
}

/**
 * Check if location indicates an EU/EMEA region.
 */
export function isEuRegion(locationText) {
  const lower = (locationText || '').toLowerCase();
  return EU_REGION_PATTERNS.some(p => p.test(lower));
}
