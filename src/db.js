import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DATABASE_PATH || path.resolve(__dirname, '..', 'data', 'jobs.db');

let db = null;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

/**
 * Run a query with optional params.
 * SELECT queries return { rows: [...] }.
 * INSERT/UPDATE/DELETE return { rows: [], changes, lastInsertRowid }.
 */
export async function query(text, params = []) {
  const d = getDb();
  // Convert $1, $2, ... placeholders to ? for SQLite
  const sqliteText = text.replace(/\$\d+/g, '?');
  // Replace NOW() with datetime('now')
  const finalSql = sqliteText.replace(/\bNOW\(\)/gi, "datetime('now')");

  const trimmed = finalSql.trim().toUpperCase();
  if (trimmed.startsWith('SELECT')) {
    const rows = d.prepare(finalSql).all(...params);
    return { rows };
  }

  // For INSERT ... RETURNING id
  if (/RETURNING\s+/i.test(finalSql)) {
    const withoutReturning = finalSql.replace(/\s*RETURNING\s+\w+/i, '');
    // Handle ON CONFLICT ... DO NOTHING
    const info = d.prepare(withoutReturning).run(...params);
    if (info.changes > 0) {
      return { rows: [{ id: String(info.lastInsertRowid) }] };
    }
    return { rows: [] };
  }

  const info = d.prepare(finalSql).run(...params);
  return { rows: [], changes: info.changes, lastInsertRowid: info.lastInsertRowid };
}

export async function close() {
  if (db) {
    db.close();
    db = null;
  }
}

export default { query, close };
