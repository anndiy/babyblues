import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, generateScenario } from '../src/synthetic-data.js';
import { extractFeatures } from '../../babyblues-ai-backend new/src/features.js';

const NOW = new Date('2026-10-23T12:00:00.000Z');

test('all scenario names generate reproducible fictional datasets', () => {
  for (const name of Object.keys(SCENARIOS)) {
    const a = generateScenario(name, { now: NOW, seed: 123 });
    const b = generateScenario(name, { now: NOW, seed: 123 });
    assert.deepEqual(a, b, `${name} should be reproducible with the same seed`);
    assert.equal(a.metadata.generated, true);
    assert.ok(a.careLogs.length >= 0);
    assert.ok(a.checkins.length >= 0);
    assert.ok(a.careLogs.every((row) => ['feeding', 'sleep', 'diaper'].includes(row.event_type)));
    assert.ok(a.checkins.every((row) => row.mood >= 1 && row.mood <= 5 && row.stress >= 1 && row.stress <= 5));
  }
});

test('standard scenarios provide enough history for both analysis windows', () => {
  for (const name of ['steady', 'declining_wellbeing', 'recovery', 'irregular_care_activity', 'conflicting_signals', 'missing_fields']) {
    const data = generateScenario(name, { now: NOW, seed: 42 });
    const result = extractFeatures({ checkins: data.checkins, careLogs: data.careLogs, now: NOW, windowDays: 28 });
    assert.equal(result.comparisonEligible, true, `${name} should have >=3 check-ins in both windows`);
  }
});

test('sparse-data scenario remains ineligible for a comparison', () => {
  const data = generateScenario('sparse_data', { now: NOW, seed: 42 });
  const result = extractFeatures({ checkins: data.checkins, careLogs: data.careLogs, now: NOW, windowDays: 28 });
  assert.equal(result.comparisonEligible, false);
  assert.ok(result.currentPeriod.checkinCount < 3);
  assert.ok(result.previousPeriod.checkinCount < 3);
});

test('care-log frequency stays context-only even when activity declines', () => {
  const data = generateScenario('irregular_care_activity', { now: NOW, seed: 42 });
  const result = extractFeatures({ checkins: data.checkins, careLogs: data.careLogs, now: NOW, windowDays: 28 });
  assert.equal(result.signals.find((signal) => signal.key === 'care_log_activity').direction, 'context_only');
});

test('generator validates scenario and history length', () => {
  assert.throws(() => generateScenario('not-a-scenario'), /Unknown scenario/);
  assert.throws(() => generateScenario('steady', { days: 3 }), /days must be/);
});
