
import { describe, expect, it } from 'vitest';
import { generateSupportSignals } from './insights';
import type { WellbeingEntry } from './insights';

function makeEntry(
  overrides: Partial<WellbeingEntry> = {},
): WellbeingEntry {
  return {
    mood: 4,
    stress: 2,
    energy: 4,
    sleep_hours: 8,
    created_at: '2026-10-23T10:00:00Z',
    ...overrides,
  };
}

describe('generateSupportSignals', () => {
  it('requests more check-ins when there is insufficient data', () => {
    const result = generateSupportSignals([makeEntry()]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('insufficient-data');
  });

  it('flags low mood, high stress, and low energy', () => {
    const entries = [
      makeEntry({
        mood: 2,
        stress: 4,
        energy: 2,
        created_at: '2026-10-23T10:00:00Z',
      }),
      makeEntry({
        mood: 2,
        stress: 4,
        energy: 2,
        created_at: '2026-10-22T10:00:00Z',
      }),
      makeEntry({
        mood: 3,
        stress: 4,
        energy: 1,
        created_at: '2026-10-21T10:00:00Z',
      }),
    ];

    const ids = generateSupportSignals(entries).map((signal) => signal.id);

    expect(ids).toContain('low-mood');
    expect(ids).toContain('high-stress');
    expect(ids).toContain('low-energy');
  });

  it('uses the latest check-in for the short-sleep prompt', () => {
    const entries = [
      makeEntry({
        sleep_hours: 3,
        created_at: '2026-10-23T10:00:00Z',
      }),
      makeEntry({
        sleep_hours: 8,
        created_at: '2026-10-22T10:00:00Z',
      }),
      makeEntry({
        sleep_hours: 8,
        created_at: '2026-10-21T10:00:00Z',
      }),
    ];

    const result = generateSupportSignals(entries);

    expect(result.map((signal) => signal.id)).toContain('short-sleep');
  });

  it('does not flag configured thresholds when scores are outside them', () => {
    const entries = [
      makeEntry({ created_at: '2026-10-23T10:00:00Z' }),
      makeEntry({ created_at: '2026-10-22T10:00:00Z' }),
      makeEntry({ created_at: '2026-10-21T10:00:00Z' }),
    ];

    const result = generateSupportSignals(entries);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('no-flags');
  });
});
