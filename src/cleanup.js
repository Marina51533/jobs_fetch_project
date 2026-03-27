import db from '../db.js';

/**
 * Cleans up jobs older than 45 days.
 */
async function cleanupOldJobs() {
  const DAYS_LIMIT = 45;
  console.log(`[cleanup] Starting database cleanup, removing jobs older than ${DAYS_LIMIT} days...`);

  try {
    // Delete jobs where created_at is older than 45 days
    const result = await db.query(
      `DELETE FROM jobs WHERE created_at < datetime('now', '-${DAYS_LIMIT} days')`
    );

    console.log(`[cleanup] Successfully removed ${result.changes} old jobs.`);

    // Optimize database file size
    console.log('[cleanup] Optimizing database (VACUUM)...');
    await db.query('VACUUM');
    console.log('[cleanup] Database optimized.');

  } catch (error) {
    console.error('[cleanup] Error during cleanup:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Check if run directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('cleanup.js')) {
  cleanupOldJobs();
}

export { cleanupOldJobs };
