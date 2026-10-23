import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFeatures } from '../src/features.js';

test('compares wellbeing measures and treats care logs as context only', () => {
  const now = new Date('2026-10-23T12:00:00.000Z');
  const checkins = [
    { mood: 2, stress: 4, energy: 2, sleep_hours: 4, created_at: '2026-10-20T12:00:00Z' },
    { mood: 2, stress: 4, energy: 2, sleep_hours: 5, created_at: '2026-10-17T12:00:00Z' },
    { mood: 3, stress: 4, energy: 2, sleep_hours: 4, created_at: '2026-10-12T12:00:00Z' },
    { mood: 4, stress: 2, energy: 4, sleep_hours: 7, created_at: '2026-09-24T12:00:00Z' },
    { mood: 4, stress: 2, energy: 4, sleep_hours: 7, created_at: '2026-09-20T12:00:00Z' },
    { mood: 4, stress: 2, energy: 4, sleep_hours: 7, created_at: '2026-09-10T12:00:00Z' }
  ];
  const result = extractFeatures({
    checkins,
    careLogs: [{ event_type: 'feeding', logged_at: '2026-10-20T13:00:00Z' }, { event_type: 'sleep', logged_at: '2026-09-20T13:00:00Z' }],
    now,
    windowDays: 28
  });
  assert.equal(result.comparisonEligible, true);
  assert.equal(result.currentPeriod.checkinCount, 3);
  assert.equal(result.previousPeriod.checkinCount, 3);
  assert.equal(result.signals.find((s) => s.key === 'mood').direction, 'worsening');
  assert.equal(result.signals.find((s) => s.key === 'stress').direction, 'worsening');
  assert.equal(result.signals.find((s) => s.key === 'care_log_activity').direction, 'context_only');
});

test('insufficient check-ins do not produce a meaningful comparison', () => {
  const result = extractFeatures({
    checkins: [{ mood: 4, stress: 2, energy: 4, created_at: '2026-10-20T12:00:00Z' }],
    careLogs: [],
    now: new Date('2026-10-23T12:00:00Z'),
    windowDays: 28
  });
  assert.equal(result.comparisonEligible, false);
  assert.equal(result.signals.find((s) => s.key === 'mood').direction, 'insufficient_data');
});
