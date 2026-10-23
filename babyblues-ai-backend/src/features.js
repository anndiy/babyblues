const mean = (rows, key) => {
  const values = rows.map((row) => row[key]).filter((v) => typeof v === 'number' && Number.isFinite(v));
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
};
const round = (n) => n == null ? null : Math.round(n * 10) / 10;
const ago = (days, now) => new Date(now.getTime() - days * 86400000);

function direction(delta, threshold, higherIsBetter) {
  if (delta == null) return 'insufficient_data';
  if (Math.abs(delta) < threshold) return 'stable';
  const favourable = higherIsBetter ? delta > 0 : delta < 0;
  return favourable ? 'improving' : 'worsening';
}

function compare(key, title, current, previous, threshold, higherIsBetter, unit = '/5') {
  if (current == null || previous == null) {
    return { key, title, direction: 'insufficient_data', detail: 'There is not enough data in both windows to compare this measure.', currentAverage: round(current), previousAverage: round(previous), change: null };
  }
  const delta = current - previous;
  const d = direction(delta, threshold, higherIsBetter);
  const sign = delta > 0 ? '+' : '';
  let detail = `Average changed from ${round(previous)}${unit} to ${round(current)}${unit} (${sign}${round(delta)}${unit}).`;
  if (d === 'stable') detail += ' This is broadly similar across the two windows.';
  else if (d === 'improving') detail += ' The direction is more favourable on this self-reported measure.';
  else detail += ' This change may be worth noticing, but the data does not explain why it occurred.';
  return { key, title, direction: d, detail, currentAverage: round(current), previousAverage: round(previous), change: round(delta) };
}

export function extractFeatures({ checkins, careLogs, now = new Date(), windowDays = 28 }) {
  const currentStart = ago(windowDays, now);
  const previousStart = ago(windowDays * 2, now);
  const inWindow = (row, field, start, end) => {
    const t = new Date(row[field]).getTime();
    return Number.isFinite(t) && t >= start.getTime() && t < end.getTime();
  };
  const currentCheckins = checkins.filter((r) => inWindow(r, 'created_at', currentStart, new Date(now.getTime() + 1)));
  const previousCheckins = checkins.filter((r) => inWindow(r, 'created_at', previousStart, currentStart));
  const currentLogs = careLogs.filter((r) => inWindow(r, 'logged_at', currentStart, new Date(now.getTime() + 1)));
  const previousLogs = careLogs.filter((r) => inWindow(r, 'logged_at', previousStart, currentStart));

  const signals = [
    compare('mood', 'Self-reported mood', mean(currentCheckins, 'mood'), mean(previousCheckins, 'mood'), 0.6, true),
    compare('stress', 'Self-reported stress', mean(currentCheckins, 'stress'), mean(previousCheckins, 'stress'), 0.6, false),
    compare('energy', 'Self-reported energy', mean(currentCheckins, 'energy'), mean(previousCheckins, 'energy'), 0.6, true),
    compare('sleep_hours', 'Reported sleep duration', mean(currentCheckins, 'sleep_hours'), mean(previousCheckins, 'sleep_hours'), 1, true, ' hours'),
    {
      key: 'checkin_frequency', title: 'Wellbeing check-in frequency', direction: 'context_only',
      detail: `There were ${currentCheckins.length} check-ins in the current window and ${previousCheckins.length} in the previous window. Frequency can change for many reasons and is not, by itself, evidence of a mental-health change.`,
      currentCount: currentCheckins.length, previousCount: previousCheckins.length
    },
    {
      key: 'care_log_activity', title: 'Baby-care logging activity (context only)', direction: 'context_only',
      detail: `There were ${currentLogs.length} care logs in the current window and ${previousLogs.length} in the previous window. These are app-log counts only; they are not interpreted as evidence of a parent's mental state or caregiving quality.`,
      currentCount: currentLogs.length, previousCount: previousLogs.length
    }
  ];

  const currentSnapshot = {
    mood: round(mean(currentCheckins, 'mood')),
    stress: round(mean(currentCheckins, 'stress')),
    energy: round(mean(currentCheckins, 'energy')),
    sleep_hours: round(mean(currentCheckins, 'sleep_hours')),
  };

  const dataStatus =
    currentCheckins.length < 3
      ? 'insufficient_recent_data'
      : previousCheckins.length < 3
        ? 'recent_snapshot_only'
        : 'comparison_available';


  return {
    windowDays,
    currentPeriod: { start: currentStart.toISOString(), end: now.toISOString(), checkinCount: currentCheckins.length, careLogCount: currentLogs.length },
    previousPeriod: { start: previousStart.toISOString(), end: currentStart.toISOString(), checkinCount: previousCheckins.length, careLogCount: previousLogs.length },
    comparisonEligible: currentCheckins.length >= 3 && previousCheckins.length >= 3,
    signals,
    dataStatus,
    currentSnapshot,
    notes: [
      'Descriptive features only; not a validated clinical model.',
      'Care-log and app-engagement counts are context only.',
      'Missing data is not evidence that someone is doing well or poorly.'
    ]
  };
}
