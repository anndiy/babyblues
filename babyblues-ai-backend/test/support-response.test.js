import test from 'node:test';
import assert from 'node:assert/strict';
import { generateScenario } from '../src/synthetic-data.js';
import { buildSupportResponse } from '../src/support-response.js';

const NOW = new Date('2026-10-23T12:00:00.000Z');
const build = (name, extra = {}) => {
  const d = generateScenario(name, { now: NOW, days: 56, seed: 42 });
  return buildSupportResponse({ checkins: d.checkins, careLogs: d.careLogs, now: NOW, utcOffsetMinutes: 330, region: 'IN', ...extra });
};

test('response has the shape the apps depend on', () => {
  const r = build('combined_signals');
  assert.equal(r.supportLevel.level, 'talk_to_someone_priority');
  assert.equal(r.meta.usesAI, false);
  assert.equal(r.crisisResources.support[0].number, '14416');
  assert.ok(Array.isArray(r.usage.measures) && r.usage.measures.length === 4);
  assert.ok(r.selfReport.signals.every((s) => ['mood', 'stress', 'energy', 'sleep_hours'].includes(s.key)));
  assert.ok(Array.isArray(r.supportLevel.limits));
});

test('empty account is handled without error', () => {
  const r = buildSupportResponse({ now: NOW });
  assert.equal(r.supportLevel.level, 'insufficient_data');
  assert.equal(r.crisisResources.region, 'Your area');
});

test('response never contains raw care-log or check-in rows', () => {
  const json = JSON.stringify(build('steady'));
  assert.ok(!json.includes('logged_at'));
  assert.ok(!json.includes('Synthetic demo record'));
});

test('response never contains raw questionnaire answers or per-item scores', () => {
  const d = generateScenario('safety_item_positive', { now: NOW, days: 56, seed: 42 });
  const r = buildSupportResponse({ checkins: d.checkins, careLogs: d.careLogs, screeningRows: d.screening, now: NOW, region: 'IN' });
  const forbidden = new Set(['answers', 'difficulty', 'itemScores', 'item_scores', 'parent_id']);
  const walk = (o) => { if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { assert.ok(!forbidden.has(k), `leaked key ${k}`); walk(v); } };
  walk(r);
  assert.equal(r.screening.safetyFlag, true);
  assert.equal(r.supportLevel.safetyAlert, true);
});

test('missing screening table is reported, not fatal', () => {
  const r = buildSupportResponse({ screeningRows: [], screeningAvailable: false, now: NOW });
  assert.equal(r.meta.screeningAvailable, false);
  assert.equal(r.screening, null);
});
