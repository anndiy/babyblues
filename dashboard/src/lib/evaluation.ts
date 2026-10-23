
import type { WellbeingEntry } from './insights';

export type DataQualityIssue = {
  id: string;
  message: string;
};

export type WellbeingEvaluation = {
  recentCount: number;
  previousCount: number;
  moodChange: number | null;
  stressChange: number | null;
  energyChange: number | null;
  issues: DataQualityIssue[];
};

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function evaluateWellbeingData(
  entries: WellbeingEntry[],
): WellbeingEvaluation {
  const sorted = [...entries].sort(
    (a, b) =>
      new Date(b.created_at).getTime() -
      new Date(a.created_at).getTime(),
  );

  const recent = sorted.slice(0, 3);
  const previous = sorted.slice(3, 6);
  const issues: DataQualityIssue[] = [];

  sorted.forEach((entry, index) => {
    if (
      !Number.isFinite(entry.mood) ||
      entry.mood < 1 ||
      entry.mood > 5
    ) {
      issues.push({
        id: `mood-${index}`,
        message: `Check-in ${index + 1}: mood is outside the expected 1–5 scale.`,
      });
    }

    if (
      !Number.isFinite(entry.stress) ||
      entry.stress < 1 ||
      entry.stress > 5
    ) {
      issues.push({
        id: `stress-${index}`,
        message: `Check-in ${index + 1}: stress is outside the expected 1–5 scale.`,
      });
    }

    if (
      !Number.isFinite(entry.energy) ||
      entry.energy < 1 ||
      entry.energy > 5
    ) {
      issues.push({
        id: `energy-${index}`,
        message: `Check-in ${index + 1}: energy is outside the expected 1–5 scale.`,
      });
    }

    if (
      entry.sleep_hours !== null &&
      (!Number.isFinite(entry.sleep_hours) ||
        entry.sleep_hours < 0 ||
        entry.sleep_hours > 24)
    ) {
      issues.push({
        id: `sleep-${index}`,
        message: `Check-in ${index + 1}: sleep duration is outside the accepted 0–24 hour range.`,
      });
    }
  });

  const recentMood = average(recent.map((entry) => entry.mood));
  const previousMood = average(previous.map((entry) => entry.mood));

  const recentStress = average(recent.map((entry) => entry.stress));
  const previousStress = average(previous.map((entry) => entry.stress));

  const recentEnergy = average(recent.map((entry) => entry.energy));
  const previousEnergy = average(previous.map((entry) => entry.energy));

  return {
    recentCount: recent.length,
    previousCount: previous.length,
    moodChange:
      recentMood !== null && previousMood !== null
        ? Number((recentMood - previousMood).toFixed(2))
        : null,
    stressChange:
      recentStress !== null && previousStress !== null
        ? Number((recentStress - previousStress).toFixed(2))
        : null,
    energyChange:
      recentEnergy !== null && previousEnergy !== null
        ? Number((recentEnergy - previousEnergy).toFixed(2))
        : null,
    issues,
  };
}
