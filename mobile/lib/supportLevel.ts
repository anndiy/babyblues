/**
 * Support-level types, wording, built-in crisis resources, and the API call.
 * Keep in sync with mobile/lib/supportLevel.ts (identical file) and
 * babyblues-ai-backend/src/support-response.js (the server that produces the data).
 *
 * Nothing here is a diagnosis. The wording is deliberately calm and non-alarming.
 */

export type SupportLevelId =
  | 'insufficient_data'
  | 'no_flags'
  | 'gentle_prompt'
  | 'talk_to_someone'
  | 'talk_to_someone_priority';

export type SupportTone = 'calm' | 'gentle' | 'caring' | 'priority';

export type CrisisContact = { label: string; number: string | null; note?: string };

export type CrisisResources = {
  region: string;
  emergency: CrisisContact;
  support: CrisisContact[];
};

export type UsageMeasure = {
  key: string;
  title: string;
  direction: 'shifted' | 'stable' | 'insufficient_data';
  detail: string;
};

export type SupportLevelResponse = {
  generatedAt: string;
  windowDays: number;
  supportLevel: {
    level: SupportLevelId;
    message: string;
    reasons: string[];
    limits: string[];
    usageAloneCanEscalate: boolean;
    crisisResourcesAlwaysAvailable: boolean;
  };
  selfReport: { currentCheckinCount: number; previousCheckinCount: number; dataStatus: string };
  usage: {
    status: 'insufficient_data' | 'no_notable_change' | 'notable_change';
    measures: UsageMeasure[];
    ordinaryExplanations: string[];
    timezoneNote: string;
  };
  crisisResources: CrisisResources;
  meta: { usesAI: boolean; notice: string };
};

export const SUPPORT_LEVEL_COPY: Record<SupportLevelId, { title: string; tone: SupportTone }> = {
  insufficient_data: { title: 'Still getting to know your pattern', tone: 'calm' },
  no_flags: { title: 'Nothing stands out right now', tone: 'calm' },
  gentle_prompt: { title: 'A quick check-in could help', tone: 'gentle' },
  talk_to_someone: { title: 'It might help to talk to someone', tone: 'caring' },
  talk_to_someone_priority: { title: 'Please consider reaching out soon', tone: 'priority' },
};

/**
 * Built into the app on purpose: crisis numbers must still show if the backend is down.
 * Tele-MANAS 14416 verified 24 Oct 2026 (free, 24x7; https://jipmer.edu.in/Tele-MANAS).
 * Re-verify before any real deployment.
 */
export const STATIC_CRISIS_RESOURCES_IN: CrisisResources = {
  region: 'India',
  emergency: { label: 'Emergency services', number: '112', note: 'If you or your baby may be in immediate danger.' },
  support: [{ label: 'Tele-MANAS (free, 24x7 mental health support)', number: '14416' }],
};

export function levelCopy(level: string | undefined): { title: string; tone: SupportTone } {
  return SUPPORT_LEVEL_COPY[level as SupportLevelId] ?? SUPPORT_LEVEL_COPY.insufficient_data;
}

export function phoneHref(number: string | null | undefined): string | null {
  if (!number) return null;
  const digits = number.replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : null;
}

export type FetchSupportLevelOptions = {
  apiBaseUrl: string;
  accessToken: string;
  region?: string;
  windowDays?: number;
  utcOffsetMinutes?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export async function fetchSupportLevel(options: FetchSupportLevelOptions): Promise<SupportLevelResponse> {
  const {
    apiBaseUrl,
    accessToken,
    region = 'IN',
    windowDays = 28,
    utcOffsetMinutes = -new Date().getTimezoneOffset(),
    timeoutMs = 10000,
    fetchImpl = fetch,
  } = options;

  if (!apiBaseUrl) throw new Error('The support service address is not set.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${apiBaseUrl.replace(/\/$/, '')}/api/support-level`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ windowDays, utcOffsetMinutes, region }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        typeof payload?.error === 'string' ? payload.error : `The support summary is unavailable (${response.status}).`,
      );
    }
    return payload as SupportLevelResponse;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The support summary took too long to load.');
    }
    if (error instanceof TypeError) {
      throw new Error('Could not reach the support service.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
