import { extractFeatures } from './features.js';
import { extractUsagePatterns, deriveSupportLevel } from './usage-patterns.js';
import { getCrisisResources } from './crisis-resources.js';
import { summarizeLatestScreening } from './screening.js';

/**
 * Pure function that builds the /api/support-level response. No network, no AI.
 * Nothing here is sent to a third party, so it does not require AI-sharing consent.
 */
export function buildSupportResponse({ checkins = [], careLogs = [], screeningRows = [], screeningAvailable = true, now = new Date(), windowDays = 28, utcOffsetMinutes = 0, region } = {}) {
  const features = extractFeatures({ checkins, careLogs, now, windowDays });
  const usage = extractUsagePatterns({ careLogs, now, windowDays, utcOffsetMinutes });
  const screening = summarizeLatestScreening(screeningRows, now);
  const supportLevel = deriveSupportLevel({ features, usage, screening });
  return {
    generatedAt: now.toISOString(),
    windowDays,
    supportLevel,
    selfReport: {
      currentCheckinCount: features.currentPeriod.checkinCount,
      previousCheckinCount: features.previousPeriod.checkinCount,
      dataStatus: features.dataStatus,
      signals: features.signals.filter((s) => ['mood', 'stress', 'energy', 'sleep_hours'].includes(s.key))
    },
    usage: {
      status: usage.status,
      measures: usage.measures,
      ordinaryExplanations: usage.ordinaryExplanations,
      timezoneNote: usage.timezoneNote
    },
    screening,
    crisisResources: getCrisisResources(region),
    meta: {
      usesAI: false,
      screeningAvailable,
      notice: 'Rule-based prototype. Not a diagnosis, screening result, or validated clinical prediction.'
    }
  };
}
