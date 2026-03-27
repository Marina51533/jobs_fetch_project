import fetch from 'node-fetch';

const BASE_URL = 'https://web3.career/api/v1';

function buildWeb3Url(token) {
  const url = new URL(BASE_URL);
  url.searchParams.set('token', token);
  url.searchParams.set('limit', '100');
  return url.toString();
}

export function extractWeb3Jobs(payload) {
  if (!Array.isArray(payload)) {
    throw new Error('Web3 Career response must be a top-level JSON array');
  }

  const jobs = payload[2];
  if (!Array.isArray(jobs)) {
    throw new Error('Web3 Career response index 2 must contain the jobs array');
  }

  return jobs;
}

export async function fetchWeb3Jobs() {
  const token = process.env.WEB3_CAREER_API_TOKEN;
  if (!token || !String(token).trim()) {
    return { jobs: [], skipped: true, reason: 'WEB3_CAREER_API_TOKEN not configured' };
  }

  const res = await fetch(buildWeb3Url(token), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; JobAggregator/1.0)',
      'Accept': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => 'No response body');
    throw new Error(`Web3 Career API error: ${res.status} ${res.statusText}\nBody: ${text.substring(0, 500)}`);
  }

  const text = await res.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (err) {
    console.error(`[web3] JSON parse error. First 200 chars: ${text.substring(0, 200)}`);
    throw new Error(`Web3 Career API returned invalid JSON: ${err.message}`);
  }

  const jobs = extractWeb3Jobs(payload);
  console.log(`[web3] fetched ${jobs.length} jobs`);
  return { jobs };
}