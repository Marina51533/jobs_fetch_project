import fetch from 'node-fetch';

const BASE_URL = 'https://boards-api.greenhouse.io/v1/boards';
const DELAY_MS = parseInt(process.env.FETCH_DELAY_MS || '200', 10);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch all published jobs from a single Greenhouse board.
 * Returns an array of raw job objects (list-level, no descriptions).
 */
export async function fetchBoardJobs(boardToken) {
  const url = `${BASE_URL}/${encodeURIComponent(boardToken)}/jobs`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Greenhouse API error for ${boardToken}: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return data.jobs || [];
}

/**
 * Fetch full details (including description) for a single job.
 */
export async function fetchJobDetail(boardToken, jobId) {
  const url = `${BASE_URL}/${encodeURIComponent(boardToken)}/jobs/${encodeURIComponent(jobId)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Greenhouse detail error for ${boardToken}/${jobId}: ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch jobs from all configured boards.
 * Yields { boardToken, company, jobs[] } per board.
 * Per-board errors are caught and logged — pipeline continues.
 */
export async function fetchAllBoards(boards) {
  const results = [];

  for (const board of boards) {
    try {
      const jobs = await fetchBoardJobs(board.token);
      results.push({
        boardToken: board.token,
        company: board.company,
        jobs,
      });
      console.log(`[greenhouse] ${board.token}: ${jobs.length} jobs`);
    } catch (err) {
      console.error(`[greenhouse] ${board.token}: FAILED — ${err.message}`);
      results.push({
        boardToken: board.token,
        company: board.company,
        jobs: [],
        error: err.message,
      });
    }
    await sleep(DELAY_MS);
  }

  return results;
}
