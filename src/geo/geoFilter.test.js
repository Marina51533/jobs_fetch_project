import test from 'node:test';
import assert from 'node:assert/strict';

import { applyGeoFilter } from './geoFilter.js';

test('rejects Web3 onsite jobs with explicit non-EU country', () => {
  const decision = applyGeoFilter({
    work_mode: 'onsite',
    location_text: 'Argentina',
    location_country: 'argentina',
  });

  assert.equal(decision, 'reject');
});

test('rejects Web3 hybrid jobs with explicit non-EU country', () => {
  const decision = applyGeoFilter({
    work_mode: 'hybrid',
    location_text: 'San Francisco, United States',
    location_country: 'united-states',
  });

  assert.equal(decision, 'reject');
});

test('publishes onsite jobs with recognized European country marker', () => {
  const decision = applyGeoFilter({
    work_mode: 'onsite',
    location_text: 'Berlin, Germany',
    location_country: 'germany',
  });

  assert.equal(decision, 'publish');
});

test('publishes onsite jobs with recognized European city marker', () => {
  const decision = applyGeoFilter({
    work_mode: 'onsite',
    location_text: 'Stuttgart',
    location_country: 'europe (stuttgart)',
  });

  assert.equal(decision, 'publish');
});