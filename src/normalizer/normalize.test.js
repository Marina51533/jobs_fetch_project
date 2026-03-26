import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeWeb3Job } from './normalize.js';

test('normalizeWeb3Job preserves apply_url exactly', () => {
  const rawJob = {
    id: 42,
    title: 'Full Stack Engineer',
    company: 'Web3 Co',
    location: 'Remote',
    apply_url: 'https://web3.career/job/42?utm_source=web3career',
    description: 'Build protocol tooling',
    date_epoch: 1711440000,
  };

  const job = normalizeWeb3Job(rawJob);
  assert.equal(job.job_url, rawJob.apply_url);
  assert.equal(job.dedupe_key, 'web3_career:42');
  assert.equal(job.source_board_token, null);
  assert.equal(job.work_mode, 'remote');
});

test('normalizeWeb3Job falls back to city and country when location is missing', () => {
  const rawJob = {
    id: 99,
    title: 'QA Engineer',
    company: 'Web3 QA',
    city: 'Berlin',
    country: 'Germany',
    apply_url: 'https://web3.career/job/99',
    description: 'Testing smart contract apps',
  };

  const job = normalizeWeb3Job(rawJob);
  assert.equal(job.location_text, 'Berlin, Germany');
  assert.equal(job.location_country, 'germany');
});