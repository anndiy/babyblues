
import { describe, expect, it } from 'vitest';
import { evaluateWellbeingData } from './evaluation';
import type { WellbeingEntry } from './insights';

function makeEntry(
  day: number,
  overrides: Partial<WellbeingEntry> = {},
): WellbeingEntry {
  return {
    mood: 3,
    stress: 3,
    energy: 3,
    sleep_hours: 7,
    created_at: `2026-10-${String(day).padStart(2, '0')}T10:00:00Z`,
    ...overrides,
  };
}

describe('evaluateWellbeingData', () => {
  it('returns insufficient comparison data when fewer than six records exist', () => {
    const result = evaluateWellbeingData([
      makeEntry(23),
      makeEntry(22),
      makeEntry(21),
    ]);

    expect(result.recentCount).toBe(3);
    expect(result.previousCount).toBe(0);
    expect(result.moodChange).toBeNull();
    expect(result.stressChange).toBeNull();
    expect(result.energyChange).toBeNull();
  });

  it('compares the latest three entries with the preceding three', () => {
    const entries = [
      makeEntry(23, { mood: 4, stress: 2, energy: 5 }),
      makeEntry(22, { mood: 4, stress: 2, energy: 4 }),
      makeEntry(21, { mood: 4, stress: 2, energy: 5 }),
      makeEntry(20, { mood: 2, stress: 4, energy: 3 }),
      makeEntry(19, { mood: 2, stress: 4, energy: 3 }),
      makeEntry(18, { mood: 2, stress: 4, energy: 3 }),
    ];

    const result = evaluateWellbeingData(entries);

    expect(result.recentCount).toBe(3);
    expect(result.previousCount).toBe(3);
    expect(result.moodChange).toBe(2);
    expect(result.stressChange).toBe(-2);
    expect(result.energyChange).toBe(1.67);
  });

  it('detects out-of-range mood and sleep values', () => {
    const result = evaluateWellbeingData([
      makeEntry(23, { mood: 6, sleep_hours: 25 }),
    ]);

    expect(result.issues.some((issue) => issue.id === 'mood-0')).toBe(true);
    expect(result.issues.some((issue) => issue.id === 'sleep-0')).toBe(true);
  });

  it('does not flag valid values', () => {
    const result = evaluateWellbeingData([
      makeEntry(23),
      makeEntry(22),
    ]);

    expect(result.issues).toHaveLength(0);
  });
});
