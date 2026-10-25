// Run with: npx tsx --test lib/phq9.test.ts   (uses Node's built-in test runner; no extra dependencies in the app)
import test from 'node:test';
import assert from 'node:assert/strict';
import { PHQ9_ITEMS, PHQ9_OPTIONS, phq9Band, phq9ResultCopy, scorePhq9 } from './phq9';

const zeros = () => Array<number>(9).fill(0);

test('there are 9 items and 4 options, in the published order', () => {
  assert.equal(PHQ9_ITEMS.length, 9);
  assert.deepEqual([...PHQ9_OPTIONS], ['Not at all', 'Several days', 'More than half the days', 'Nearly every day']);
  assert.match(PHQ9_ITEMS[8], /better off dead or of hurting yourself/);
});

test('totals, bands and thresholds', () => {
  assert.equal(scorePhq9(zeros())!.total, 0);
  assert.equal(scorePhq9(Array(9).fill(3))!.total, 27);
  for (const [t, b] of [[4, 'minimal'], [5, 'mild'], [9, 'mild'], [10, 'moderate'], [14, 'moderate'], [15, 'moderately_severe'], [19, 'moderately_severe'], [20, 'severe']] as const) {
    assert.equal(phq9Band(t), b);
  }
  assert.equal(scorePhq9([2, 1, 1, 1, 1, 1, 1, 2, 0])!.concern, true);
  assert.equal(scorePhq9([1, 1, 1, 1, 1, 1, 1, 1, 0])!.concern, false);
  assert.equal(scorePhq9([2, 2, 2, 2, 2, 2, 2, 1, 0])!.strong, true);
});

test('incomplete or invalid answers return null instead of a score', () => {
  assert.equal(scorePhq9([]), null);
  assert.equal(scorePhq9([0, 0, 0, 0, 0, 0, 0, 0, null]), null);
  assert.equal(scorePhq9([0, 0, 0, 0, 0, 0, 0, 0, 4]), null);
  assert.equal(scorePhq9([0, 0, 0, 0, 0, 0, 0, 0, 0.5]), null);
});

test('a positive item 9 always wins, even with a total of 1', () => {
  const r = scorePhq9([0, 0, 0, 0, 0, 0, 0, 0, 1])!;
  assert.equal(r.safetyFlag, true);
  const copy = phq9ResultCopy(r);
  assert.equal(copy.showCrisis, true);
  assert.match(copy.body, /not monitored by anyone in real time/);
});

test('result wording never names a condition and crisis contacts show when they should', () => {
  for (let total = 0; total <= 27; total++) {
    const answers = zeros();
    let left = total;
    for (let i = 0; i < 8 && left > 0; i++) { const add = Math.min(3, left); answers[i] = add; left -= add; }
    if (left > 0) answers[8] = left; // only totals above 24 need item 9
    const r = scorePhq9(answers)!;
    const copy = phq9ResultCopy(r);
    assert.ok(!/depress|diagnos(ed|is) (of|with)|disorder|you have/i.test(copy.headline + ' ' + copy.body), `total ${total}`);
    if (r.concern || r.safetyFlag) assert.equal(copy.showCrisis, true, `total ${total}`);
  }
});

test('sleep/tiredness/appetite-heavy scores are explained but still shown as a concern', () => {
  const r = scorePhq9([1, 1, 3, 3, 3, 0, 0, 0, 0])!;
  assert.equal(r.concern, true);
  assert.equal(r.somaticHeavy, true);
  assert.match(phq9ResultCopy(r).body, /sleep, tiredness and appetite/);
});
