import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreScreening, summarizeLatestScreening, phq9Band, epdsBand, FRESH_DAYS, INSTRUMENTS } from '../src/screening.js';

const NOW = new Date('2026-10-25T10:00:00Z');
const daysAgo = (d) => new Date(NOW.getTime() - d * 86400000).toISOString();
const phq = (arr) => ({ instrument: 'phq9', answers: arr });

test('PHQ-9 total is the plain sum and the bands match the published ranges', () => {
  assert.equal(scoreScreening(phq([0,0,0,0,0,0,0,0,0])).total, 0);
  assert.equal(scoreScreening(phq([3,3,3,3,3,3,3,3,3])).total, 27);
  const bands = [[0,'minimal'],[4,'minimal'],[5,'mild'],[9,'mild'],[10,'moderate'],[14,'moderate'],[15,'moderately_severe'],[19,'moderately_severe'],[20,'severe'],[27,'severe']];
  for (const [total, band] of bands) assert.equal(phq9Band(total), band, String(total));
});

test('PHQ-9 concern thresholds: 10 is a concern, 9 is not; 15 is strong', () => {
  assert.equal(scoreScreening(phq([1,1,1,1,1,1,1,1,1])).concern, false);      // 9
  assert.equal(scoreScreening(phq([2,1,1,1,1,1,1,1,1])).concern, true);       // 10
  assert.equal(scoreScreening(phq([2,2,2,2,2,2,1,1,0])).concern, true);       // 14: concern but not strong
  assert.equal(scoreScreening(phq([2,2,2,2,2,2,1,1,0])).strong, false);
});

test('PHQ-9 strong threshold exactly at 15', () => {
  assert.equal(scoreScreening(phq([2,2,2,2,2,2,2,1,0])).total, 15); // 2*7 + 1
  assert.equal(scoreScreening(phq([2,2,2,2,2,2,2,1,0])).strong, true);
  assert.equal(scoreScreening(phq([2,2,2,2,2,2,1,1,0])).total, 14);
});

test('PHQ-9 item 9 is a safety flag regardless of the total', () => {
  const r = scoreScreening(phq([0,0,0,0,0,0,0,0,1]));
  assert.equal(r.total, 1);
  assert.equal(r.concern, false);
  assert.equal(r.safetyFlag, true);
  assert.equal(scoreScreening(phq([3,3,3,3,3,3,3,3,0])).safetyFlag, false);
});

test('EPDS scoring: questions 1,2,4 forward, the rest reversed; maximum 30', () => {
  // best possible answers (top option for 1,2,4 ; bottom option for 3,5-10) => 0 points
  assert.equal(scoreScreening({ instrument: 'epds', answers: [0,0,3,0,3,3,3,3,3,3] }).total, 0);
  // worst possible answers => 30
  assert.equal(scoreScreening({ instrument: 'epds', answers: [3,3,0,3,0,0,0,0,0,0] }).total, 30);
  assert.equal(INSTRUMENTS.epds.maxScore, 30);
});

test('EPDS cut-offs and item 10 safety flag', () => {
  assert.equal(epdsBand(9), 'low'); assert.equal(epdsBand(10), 'watch'); assert.equal(epdsBand(12), 'watch'); assert.equal(epdsBand(13), 'likely');
  const base = [0,0,3,0,3,3,3,3,3,3]; // 0 points
  assert.equal(scoreScreening({ instrument: 'epds', answers: base }).safetyFlag, false);
  const sometimes = [...base]; sometimes[9] = 1; // "Sometimes" on question 10 -> 2 points
  const r = scoreScreening({ instrument: 'epds', answers: sometimes });
  assert.equal(r.safetyFlag, true);
  assert.equal(r.total, 2);
  assert.equal(r.concern, false);
});

test('EPDS item text is not part of this project', () => {
  assert.equal(INSTRUMENTS.epds.itemTextIncluded, false);
});

test('malformed input is rejected, never thrown', () => {
  for (const bad of [undefined, null, {}, { instrument: 'phq9' }, phq([0,0,0]), phq([0,0,0,0,0,0,0,0,4]), phq([0,0,0,0,0,0,0,0,-1]),
    phq([0,0,0,0,0,0,0,0,1.5]), phq(['1',0,0,0,0,0,0,0,0]), { instrument: 'nope', answers: [] }, { instrument: 'epds', answers: [0,0,0] }]) {
    assert.equal(scoreScreening(bad).valid, false);
  }
});

test('somatic-heavy scores are flagged but never downgraded', () => {
  // sleep, tiredness, appetite at 3 each = 9 points of the 11 total
  const r = scoreScreening(phq([1,1,3,3,3,0,0,0,0]));
  assert.equal(r.total, 11);
  assert.equal(r.concern, true);
  assert.equal(r.somaticHeavy, true);
  assert.equal(scoreScreening(phq([3,3,1,1,1,1,1,0,0])).somaticHeavy, false);
});

test('latest summary: freshness, ordering, and ignoring bad rows', () => {
  const rows = [
    { ...phq([0,0,0,0,0,0,0,0,0]), created_at: daysAgo(40) },
    { ...phq([2,2,2,2,2,2,2,0,0]), created_at: daysAgo(3) },
    { ...phq([9]), created_at: daysAgo(1) },                       // invalid -> ignored
    { ...phq([1,1,1,1,1,1,1,1,1]), created_at: 'not a date' },     // invalid date -> ignored
    { ...phq([3,3,3,3,3,3,3,3,3]), created_at: daysAgo(-5) }       // future -> ignored
  ];
  const s = summarizeLatestScreening(rows, NOW);
  assert.equal(s.total, 14);
  assert.equal(s.ageDays, 3);
  assert.equal(s.fresh, true);
  assert.equal(s.concern, true);
});

test('stale results do not drive the level and stale safety flags are not "fresh"', () => {
  const old = summarizeLatestScreening([{ ...phq([3,3,3,3,3,3,3,3,3]), created_at: daysAgo(FRESH_DAYS + 5) }], NOW);
  assert.equal(old.fresh, false);
  assert.equal(old.concern, false);
  assert.equal(old.safetyFlag, false);
  assert.equal(summarizeLatestScreening([], NOW), null);
  assert.equal(summarizeLatestScreening(undefined, NOW), null);
});
