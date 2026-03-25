import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { fetchBoardJobs, fetchJobDetail } from '../src/sources/greenhouse.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const BOARDS_PATH = path.join(ROOT_DIR, 'config', 'boards.json');
const CLASSIFIER_CONFIG_PATH = path.join(ROOT_DIR, 'classifier', 'config.json');

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getKeywords(config, mode) {
  if (mode === 'qa') {
    return [
      ...config.qa_keywords.strong,
      ...config.qa_keywords.moderate,
      ...config.qa_keywords.weak,
      'qa',
      'qe',
      'test',
      'testing',
      'tester',
      'quality',
      'verification',
      'validation',
      'certification',
      'reliability',
      'quality specialist',
      'quality associate',
      'quality analyst',
      'test specialist',
      'test associate',
      'quality operations',
      'verifications',
      'quality and test',
      'quality & test',
      'test engineering',
      'quality engineering',
    ];
  }

  if (mode === 'developer') {
    return [
      ...config.developer_keywords.strong,
      ...config.developer_keywords.moderate,
      ...config.developer_keywords.weak,
      'software',
      'engineering',
      'developer',
      'engineer',
      'platform',
      'application engineer',
      'application developer',
      'backend developer',
      'frontend developer',
      'fullstack developer',
      'mobile engineer',
      'web engineer',
      'software engineer',
      'software developer',
      'solutions developer',
      'solutions engineer',
      'engineering manager',
    ];
  }

  return [
    ...getKeywords(config, 'qa'),
    ...getKeywords(config, 'developer'),
  ];
}

function buildMatcher(keywords) {
  const uniqueKeywords = [...new Set(keywords.map(k => k.trim()).filter(Boolean))];
  const pattern = uniqueKeywords.map(escapeRegex).join('|');
  return new RegExp(`(${pattern})`, 'i');
}

function parseLimit(value) {
  const parsed = Number.parseInt(value || '20', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
}

async function loadJson(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function main() {
  const mode = (process.argv[2] || 'either').toLowerCase();
  const limit = parseLimit(process.argv[3]);
  if (!['qa', 'developer', 'either'].includes(mode)) {
    console.error('Usage: node scripts/find-sample-job.js [qa|developer|either] [limit]');
    process.exit(1);
  }

  const boardsConfig = await loadJson(BOARDS_PATH);
  const classifierConfig = await loadJson(CLASSIFIER_CONFIG_PATH);
  const matcher = buildMatcher(getKeywords(classifierConfig, mode));
  const matches = [];

  for (const board of boardsConfig.boards) {
    try {
      const jobs = await fetchBoardJobs(board.token);
      const matchedJobs = jobs.filter(job => matcher.test(job.title || ''));

      for (const job of matchedJobs) {
        matches.push({
          board: board.token,
          company: board.company,
          summary: job,
        });
      }
    } catch (err) {
      console.log(`Skipped board: ${board.token} - ${err.message}`);
    }
  }

  if (matches.length === 0) {
    console.log(`No ${mode} sample job found across configured boards.`);
    process.exit(0);
  }

  const limitedMatches = matches.slice(0, limit);

  console.log(`Matched mode: ${mode}`);
  console.log(`Total matches: ${matches.length}`);
  console.log(`Showing first ${limitedMatches.length} matches:`);

  for (const match of limitedMatches) {
    console.log(JSON.stringify({
      board: match.board,
      company: match.company,
      id: match.summary.id,
      title: match.summary.title,
      updated_at: match.summary.updated_at,
      absolute_url: match.summary.absolute_url,
      location: match.summary.location?.name || null,
    }, null, 2));
  }

  const detailTarget = limitedMatches[0];
  const detail = await fetchJobDetail(detailTarget.board, detailTarget.summary.id);
  console.log('First matched job detail:', JSON.stringify({
    board: detailTarget.board,
    company: detailTarget.company,
    id: detail.id,
    title: detail.title,
    location: detail.location?.name || null,
    absolute_url: detail.absolute_url,
    updated_at: detail.updated_at,
    content_preview: (detail.content || '').replace(/\s+/g, ' ').slice(0, 240),
  }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});