import { readFile } from 'fs/promises';
import { mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = new URL('./schema.sql', import.meta.url);

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
  console.log('[migrate] Schema applied successfully');
}

// Run directly: node src/migrate.js
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/.*\//, ''));
if (isMain) {
  migrate().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
}
