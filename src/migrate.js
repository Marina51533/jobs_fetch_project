import { readFile } from 'fs/promises';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = new URL('./schema.sql', import.meta.url);

async function isSourceBoardTokenRequired() {
  const result = await query("PRAGMA table_info(jobs)");
  if (!result.rows.length) return false;

  const column = result.rows.find(row => row.name === 'source_board_token');
  return Boolean(column?.notnull);
}

async function rebuildJobsTableForNullableBoardToken() {
  const columns = await query("PRAGMA table_info(jobs)");
  if (!columns.rows.length) return;

  await query('BEGIN');
  try {
    await query(`ALTER TABLE jobs RENAME TO jobs_old`);
    const sql = await readFile(schemaPath, 'utf-8');
    const stripped = sql.replace(/--.*$/gm, '');
    const statements = stripped
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const [createTableStatement, ...indexStatements] = statements;

    await query(createTableStatement);

    await query(`INSERT INTO jobs (
      id, source, source_job_id, source_board_token, dedupe_key, dedupe_hash,
      company, title, location_text, location_country, work_mode,
      job_url, updated_at_source, fetched_at,
      description_raw, description_text,
      classification_label, classification_confidence, classification_reasons,
      geo_decision, final_decision, review_status, publish_target,
      published_at, published_by_bot, telegram_message_id,
      raw_payload, processing_status, error_message, created_at, updated_at
    )
    SELECT
      id, source, source_job_id, NULLIF(source_board_token, ''), dedupe_key, dedupe_hash,
      company, title, location_text, location_country, work_mode,
      job_url, updated_at_source, fetched_at,
      description_raw, description_text,
      classification_label, classification_confidence, classification_reasons,
      geo_decision, final_decision, review_status, publish_target,
      published_at, published_by_bot, telegram_message_id,
      raw_payload, processing_status, error_message, created_at, updated_at
    FROM jobs_old`);
    await query(`DROP TABLE jobs_old`);

    for (const stmt of indexStatements) {
      await query(stmt);
    }

    await query('COMMIT');
    console.log('[migrate] Rebuilt jobs table to allow non-board sources');
  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }
}

export async function migrate() {
  // Ensure data directory exists
  const dataDir = process.env.DATABASE_PATH
    ? path.dirname(process.env.DATABASE_PATH)
    : path.resolve(__dirname, '..', 'data');
  mkdirSync(dataDir, { recursive: true });

  const sql = await readFile(schemaPath, 'utf-8');
  // Strip single-line comments, then split by semicolons
  const stripped = sql.replace(/--.*$/gm, '');
  const statements = stripped
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const stmt of statements) {
    await query(stmt);
  }

  if (await isSourceBoardTokenRequired()) {
    await rebuildJobsTableForNullableBoardToken();
  }

  console.log('[migrate] Schema applied successfully');
}

// Run directly: node src/migrate.js
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/.*\//, ''));
if (isMain) {
  migrate().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
}
