
export type WellbeingEntry = {
  mood: number;
  stress: number;
  energy: number;
  sleep_hours: number | null;
  created_at: string;
};

export type SupportSignal = {
  id: string;
  title: string;
  message: string;
  level: 'notice' | 'check-in';
};

export function generateSupportSignals(
  entries: WellbeingEntry[],
): SupportSignal[] {
  const signals: SupportSignal[] = [];

  // Use the three most recent check-ins, if available.
  const recent = [...entries]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime(),
    )
    .slice(0, 3);

  if (recent.length < 2) {
    return [
      {
        id: 'insufficient-data',
        title: 'More check-ins needed',
        message:
          'Record at least two wellbeing check-ins to begin comparing recent self-reported patterns.',
        level: 'notice',
      },
    ];
  }

  const average = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;

  const avgMood = average(recent.map((entry) => entry.mood));
  const avgStress = average(recent.map((entry) => entry.stress));
  const avgEnergy = average(recent.map((entry) => entry.energy));


  if (avgMood <= 2.5) {
    signals.push({
      id: 'low-mood',
      title: 'Mood check-in suggested',
      message:
        'Mood scores have been low across recent check-ins. Consider reaching out to someone trusted or a qualified healthcare professional.',
      level: 'check-in',
    });
  }

  if (avgStress >= 4) {
    signals.push({
      id: 'high-stress',
      title: 'Elevated self-reported stress',
      message:
        'Recent stress scores are elevated. A supportive conversation and practical help with daily care may be useful.',
      level: 'check-in',
    });
  }

  if (avgEnergy <= 2) {
    signals.push({
      id: 'low-energy',
      title: 'Low energy reported',
      message:
        'Recent energy scores are low. Consider whether rest, practical support, or a conversation with a healthcare professional would help.',
      level: 'notice',
    });
  }

    const latestSleep = recent[0]?.sleep_hours;

    if (latestSleep !== null && latestSleep !== undefined && latestSleep >= 0 && latestSleep < 5) {
      signals.push({
        id: 'short-sleep',
        title: 'Short sleep reported in latest check-in',
        message:
          `The latest check-in records ${latestSleep} hours of sleep. Consider whether additional rest or practical support would help.`,
        level: 'notice',
      });
    }


  if (signals.length === 0) {
    signals.push({
      id: 'no-flags',
      title: 'No configured support signals',
      message:
        'Recent check-ins did not meet this prototype’s configured thresholds. This does not establish that someone is well or rule out a mental health concern.',
      level: 'notice',
    });
  }

  return signals;
}
