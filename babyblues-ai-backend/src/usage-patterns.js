/**
 * Usage-pattern features and the support-level rules for BabyBlues.
 *
 * IMPORTANT DESIGN RULES (enforced by tests):
 *  1. Usage patterns are compared with the parent's OWN earlier baseline, never a population norm.
 *  2. Usage patterns alone can never raise anything above a gentle invitation to do a voluntary check-in.
 *  3. A concerning self-report is never lowered because usage looks normal.
 *  4. When self-report is available and not concerning, a usage change is shown as context only.
 *  5. Nothing here is a diagnosis or a validated clinical model.
 */

const HOUR_MS = 3600000;
const MINUTE_MS = 60000;

export const ORDINARY_EXPLANATIONS = Object.freeze([
  'A partner or relative may be logging or caring for the baby.',
  'Babies’ routines change as they grow, which changes how often care is logged.',
  'Travel, illness, a busy week, or simply taking a break from the app.',
  'Some parents log in bursts instead of in the moment.'
]);

const round1 = (n) => (n == null ? null : Math.round(n * 10) / 10);
const round2 = (n) => (n == null ? null : Math.round(n * 100) / 100);

function localHour(ms, offsetMinutes) {
  const d = new Date(ms + offsetMinutes * MINUTE_MS);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}
function localDayKey(ms, offsetMinutes) {
  return new Date(ms + offsetMinutes * MINUTE_MS).toISOString().slice(0, 10);
}

function windowStats(logs, startMs, endMs, windowDays, offsetMinutes) {
  const times = logs
    .map((row) => new Date(row.logged_at).getTime())
    .filter((t) => Number.isFinite(t) && t >= startMs && t < endMs)
    .sort((a, b) => a - b);

  const days = new Set(times.map((t) => localDayKey(t, offsetMinutes)));
  // Local "night" = midnight to 5am. For a newborn this is normal; only CHANGE from baseline matters.
  const nightCount = times.filter((t) => localHour(t, offsetMinutes) < 5).length;
  let longestGapHours = 0;
  for (let i = 1; i < times.length; i++) {
    longestGapHours = Math.max(longestGapHours, (times[i] - times[i - 1]) / HOUR_MS);
  }
  return {
    logCount: times.length,
    activeDays: days.size,
    activeDayShare: round2(days.size / windowDays),
    logsPerActiveDay: days.size ? round1(times.length / days.size) : null,
    nightShare: times.length ? round2(nightCount / times.length) : null,
    longestGapHours: times.length >= 2 ? round1(longestGapHours) : null
  };
}

/** Thresholds are deliberately conservative and are prototype values, not clinically derived. */
const MEASURES = [
  {
    key: 'active_day_share',
    title: 'Days with any care logged',
    field: 'activeDayShare',
    shifted: (prev, cur) => prev - cur >= 0.2,
    describe: (prev, cur) => `Care was logged on ${Math.round(prev * 100)}% of days before and ${Math.round(cur * 100)}% of days recently.`
  },
  {
    key: 'logs_per_active_day',
    title: 'Logs per active day',
    field: 'logsPerActiveDay',
    shifted: (prev, cur) => prev > 0 && (prev - cur) / prev >= 0.3,
    describe: (prev, cur) => `On days with logs, the average went from ${prev} to ${cur} per day.`
  },
  {
    key: 'night_share',
    title: 'Share of logs made between midnight and 5am',
    field: 'nightShare',
    shifted: (prev, cur) => cur - prev >= 0.1,
    describe: (prev, cur) => `${Math.round(prev * 100)}% of logs were overnight before; ${Math.round(cur * 100)}% recently.`
  },
  {
    key: 'longest_gap',
    title: 'Longest gap between logs',
    field: 'longestGapHours',
    shifted: (prev, cur) => cur - prev >= 8,
    describe: (prev, cur) => `The longest gap between logs went from ${prev} to ${cur} hours.`
  }
];

export function extractUsagePatterns({ careLogs, now = new Date(), windowDays = 28, utcOffsetMinutes = 0 }) {
  const nowMs = now.getTime();
  const currentStart = nowMs - windowDays * 86400000;
  const previousStart = nowMs - windowDays * 2 * 86400000;
  const logs = Array.isArray(careLogs) ? careLogs : [];

  const current = windowStats(logs, currentStart, nowMs + 1, windowDays, utcOffsetMinutes);
  const previous = windowStats(logs, previousStart, currentStart, windowDays, utcOffsetMinutes);

  // Need a reasonable amount of logging in BOTH windows, otherwise a "change" could just be noise.
  const minLogs = 15;
  const minDays = Math.ceil(windowDays * 0.4);
  const comparisonEligible =
    previous.logCount >= minLogs && previous.activeDays >= minDays &&
    // The current window is allowed to be sparse (that may be the very change), but not totally empty-of-baseline.
    previous.logCount > 0;

  const measures = MEASURES.map((m) => {
    const prev = previous[m.field];
    const cur = current[m.field] ?? (m.field === 'logsPerActiveDay' ? 0 : null);
    if (!comparisonEligible || prev == null || cur == null) {
      return { key: m.key, title: m.title, direction: 'insufficient_data', previous: prev ?? null, current: cur ?? null,
        detail: 'There is not enough earlier logging to compare this against your own baseline.' };
    }
    const shifted = m.shifted(prev, cur);
    return {
      key: m.key, title: m.title, direction: shifted ? 'shifted' : 'stable', previous: prev, current: cur,
      detail: `${m.describe(prev, cur)} ${shifted ? 'This differs from your own earlier pattern.' : 'This is similar to your own earlier pattern.'}`
    };
  });

  const shiftedCount = measures.filter((m) => m.direction === 'shifted').length;
  // Require two independent measures to move, so one noisy number cannot trigger anything.
  const status = !comparisonEligible ? 'insufficient_data' : shiftedCount >= 2 ? 'notable_change' : 'no_notable_change';

  return {
    status,
    comparisonEligible,
    shiftedCount,
    current,
    previous,
    measures,
    ordinaryExplanations: ORDINARY_EXPLANATIONS,
    timezoneNote: utcOffsetMinutes === 0
      ? 'Overnight is measured in UTC because no local time offset was supplied.'
      : `Overnight is measured at UTC${utcOffsetMinutes > 0 ? '+' : ''}${utcOffsetMinutes / 60}.`
  };
}

/**
 * Combine self-report (features) and usage patterns into a support level.
 * Levels: insufficient_data | no_flags | gentle_prompt | talk_to_someone | talk_to_someone_priority
 */
export function deriveSupportLevel({ features, usage }) {
  const reasons = [];
  const snapshot = features?.currentSnapshot ?? {};
  const currentCheckins = features?.currentPeriod?.checkinCount ?? 0;
  const selfReportAvailable = currentCheckins >= 3;

  const worsening = (features?.signals ?? []).filter(
    (s) => ['mood', 'stress', 'energy'].includes(s.key) && s.direction === 'worsening'
  );
  const lowMood = Number.isFinite(snapshot.mood) && snapshot.mood <= 2.5;
  const highStress = Number.isFinite(snapshot.stress) && snapshot.stress >= 4;
  const selfReportConcern = selfReportAvailable && (lowMood || highStress || worsening.length >= 2);

  if (selfReportConcern) {
    if (lowMood) reasons.push(`Your recent mood check-ins average ${snapshot.mood}/5.`);
    if (highStress) reasons.push(`Your recent stress check-ins average ${snapshot.stress}/5.`);
    if (worsening.length >= 2) reasons.push(`${worsening.map((s) => s.title.toLowerCase()).join(', ')} moved in a less favourable direction compared with your earlier weeks.`);
  }

  const usageChange = usage?.status === 'notable_change';
  if (usageChange) {
    reasons.push(...usage.measures.filter((m) => m.direction === 'shifted').map((m) => m.detail));
  }

  let level;
  let message;
  if (selfReportConcern && usageChange) {
    level = 'talk_to_someone_priority';
    message = 'Your own check-ins and your logging pattern have both shifted from your earlier weeks. It would be worth speaking with a healthcare professional or someone you trust soon.';
  } else if (selfReportConcern) {
    level = 'talk_to_someone';
    message = 'Your recent check-ins suggest things may be hard right now. Consider talking to a healthcare professional or someone you trust.';
  } else if (usageChange && !selfReportAvailable) {
    level = 'gentle_prompt';
    message = 'Your logging pattern has changed from your earlier weeks. That is often ordinary, and we cannot tell from logging alone. A quick optional check-in would help us understand.';
  } else if (!selfReportAvailable && usage?.status !== 'notable_change') {
    level = 'insufficient_data';
    message = 'There is not enough information yet for a reliable picture. Missing entries do not mean anything is wrong.';
  } else {
    level = 'no_flags';
    message = usageChange
      ? 'Your logging pattern has changed, but your own check-ins look steady or better, so this is treated as context only.'
      : 'Nothing in your recent check-ins or logging pattern met this prototype’s thresholds. This does not rule out a concern.';
    if (usageChange) reasons.push('Self-reported check-ins are available and not concerning, so the usage change is context only.');
  }

  return {
    level,
    message,
    reasons,
    usageAloneCanEscalate: false,
    crisisResourcesAlwaysAvailable: true,
    limits: [
      'Not a diagnosis, screening result, or validated clinical prediction.',
      'Usage patterns have many ordinary explanations and are never used alone to suggest a concern.',
      'A concerning check-in is never dismissed because logging looks normal.'
    ]
  };
}
