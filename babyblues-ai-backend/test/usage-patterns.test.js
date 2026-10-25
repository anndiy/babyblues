import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, generateScenario } from '../src/synthetic-data.js';
import { extractFeatures } from '../src/features.js';
import { extractUsagePatterns, deriveSupportLevel } from '../src/usage-patterns.js';

const NOW = new Date('2026-10-23T12:00:00.000Z');
const OFFSET = 330;

function run(name, seed = 42, now = NOW) {
  const d = generateScenario(name, { now, days: 56, seed });
  const features = extractFeatures({ checkins: d.checkins, careLogs: d.careLogs, now, windowDays: 28 });
  const usage = extractUsagePatterns({ careLogs: d.careLogs, now, windowDays: 28, utcOffsetMinutes: OFFSET });
  return { d, features, usage, support: deriveSupportLevel({ features, usage }) };
}
const seeds = Array.from({ length: 60 }, (_, i) => i + 1);

test('expected support level for each scenario holds across many random seeds', () => {
  const expected = {
    steady: 'no_flags', recovery: 'no_flags', missing_fields: 'no_flags',
    irregular_care_activity: 'no_flags', conflicting_signals: 'no_flags',
    sparse_data: 'insufficient_data',
    usage_shift_no_checkins: 'gentle_prompt',
    combined_signals: 'talk_to_someone_priority'
  };
  for (const [name, level] of Object.entries(expected)) {
    for (const seed of seeds) assert.equal(run(name, seed).support.level, level, `${name} seed ${seed}`);
  }
});

test('self-report concern is never dismissed and never lowered by normal usage', () => {
  for (const seed of seeds) {
    const r = run('declining_wellbeing', seed);
    assert.ok(['talk_to_someone', 'talk_to_someone_priority'].includes(r.support.level), `seed ${seed}: ${r.support.level}`);
  }
});

test('usage change alone can never exceed a gentle prompt', () => {
  for (const name of Object.keys(SCENARIOS)) {
    for (const seed of seeds) {
      const d = generateScenario(name, { now: NOW, days: 56, seed });
      const features = extractFeatures({ checkins: [], careLogs: d.careLogs, now: NOW, windowDays: 28 });
      const usage = extractUsagePatterns({ careLogs: d.careLogs, now: NOW, windowDays: 28, utcOffsetMinutes: OFFSET });
      const level = deriveSupportLevel({ features, usage }).level;
      assert.ok(['insufficient_data', 'gentle_prompt'].includes(level), `${name} seed ${seed} gave ${level}`);
    }
  }
});

test('a steady parent rarely triggers a usage change (false-trigger rate under 3%)', () => {
  let notable = 0;
  const many = Array.from({ length: 200 }, (_, i) => i + 1);
  for (const seed of many) if (run('steady', seed).usage.status === 'notable_change') notable++;
  assert.ok(notable / many.length < 0.03, `false trigger rate ${notable}/${many.length}`);
});

test('no care logs at all is insufficient data, not a concern', () => {
  const usage = extractUsagePatterns({ careLogs: [], now: NOW, windowDays: 28 });
  const features = extractFeatures({ checkins: [], careLogs: [], now: NOW, windowDays: 28 });
  assert.equal(usage.status, 'insufficient_data');
  assert.equal(deriveSupportLevel({ features, usage }).level, 'insufficient_data');
});

test('malformed and missing timestamps are ignored safely', () => {
  const logs = [{ logged_at: 'not a date' }, { logged_at: null }, {}, { logged_at: '2026-10-20T10:00:00Z' }];
  const usage = extractUsagePatterns({ careLogs: logs, now: NOW, windowDays: 28 });
  assert.equal(usage.current.logCount, 1);
});

test('output always states limits and keeps crisis resources available', () => {
  for (const name of Object.keys(SCENARIOS)) {
    const s = run(name).support;
    assert.equal(s.crisisResourcesAlwaysAvailable, true);
    assert.equal(s.usageAloneCanEscalate, false);
    assert.ok(s.limits.length >= 3);
    assert.ok(!/depress|diagnos(is|ed)\b.*you have/i.test(s.message), 'message must not claim a condition');
  }
});

test('overnight share depends on the local time offset', () => {
  const logs = [{ logged_at: '2026-10-20T20:00:00Z' }]; // 01:30 in India (UTC+5:30)
  const inUtc = extractUsagePatterns({ careLogs: logs, now: NOW, windowDays: 28, utcOffsetMinutes: 0 });
  const inIst = extractUsagePatterns({ careLogs: logs, now: NOW, windowDays: 28, utcOffsetMinutes: 330 });
  assert.equal(inUtc.current.nightShare, 0);
  assert.equal(inIst.current.nightShare, 1);
});

test('crisis resources: India entry has verified numbers; unknown region falls back safely', async () => {
  const { getCrisisResources } = await import('../src/crisis-resources.js');
  const india = getCrisisResources('in');
  assert.equal(india.support[0].number, '14416');
  assert.equal(india.emergency.number, '112');
  const other = getCrisisResources('zz');
  assert.ok(other.emergency.note.length > 0);
  assert.equal(getCrisisResources(undefined).region, 'Your area');
});
