import test from 'node:test';
import assert from 'node:assert/strict';

import { extractWeb3Jobs } from './web3Career.js';

test('extractWeb3Jobs returns jobs array from payload index 2', () => {
  const jobs = extractWeb3Jobs(['meta', { count: 1 }, [{ id: 123, title: 'Backend Engineer' }]]);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, 123);
});

test('extractWeb3Jobs rejects non-array payloads', () => {
  assert.throws(() => extractWeb3Jobs({ jobs: [] }), /top-level JSON array/);
});

test('extractWeb3Jobs rejects missing job array', () => {
  assert.throws(() => extractWeb3Jobs(['meta', {}]), /index 2 must contain the jobs array/);
});