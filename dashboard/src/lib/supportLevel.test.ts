import { describe, expect, it } from 'vitest';
import {
  STATIC_CRISIS_RESOURCES_IN,
  SUPPORT_LEVEL_COPY,
  describeScreeningAge,
  fetchSupportLevel,
  levelCopy,
  phoneHref,
  screeningBandLabel,
} from './supportLevel';

const okBody = { supportLevel: { level: 'no_flags' }, crisisResources: STATIC_CRISIS_RESOURCES_IN };

describe('support level wording', () => {
  it('has calm copy for all five levels and never claims a condition', () => {
    const levels = Object.keys(SUPPORT_LEVEL_COPY);
    expect(levels).toHaveLength(5);
    for (const level of levels) {
      const { title } = levelCopy(level);
      expect(/depress|diagnos|disorder|risk score|high risk/i.test(title)).toBe(false);
    }
  });

  it('falls back safely for an unknown level', () => {
    expect(levelCopy('something_new').title).toBe(SUPPORT_LEVEL_COPY.insufficient_data.title);
    expect(levelCopy(undefined).tone).toBe('calm');
  });
});

describe('built-in crisis resources', () => {
  it('include the verified Indian numbers', () => {
    expect(STATIC_CRISIS_RESOURCES_IN.support[0].number).toBe('14416');
    expect(STATIC_CRISIS_RESOURCES_IN.emergency.number).toBe('112');
  });

  it('build tel links and tolerate missing numbers', () => {
    expect(phoneHref('14416')).toBe('tel:14416');
    expect(phoneHref('+91 14416')).toBe('tel:+9114416');
    expect(phoneHref(null)).toBe(null);
    expect(phoneHref('')).toBe(null);
  });
});

describe('fetchSupportLevel', () => {
  it('sends a signed-in POST with the local time offset and region', async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return { ok: true, status: 200, json: async () => okBody };
    }) as unknown as typeof fetch;

    const result = await fetchSupportLevel({
      apiBaseUrl: 'http://localhost:3000/',
      accessToken: 'tok',
      utcOffsetMinutes: 330,
      fetchImpl,
    });
    expect(result.supportLevel.level).toBe('no_flags');
    expect(seen!.url).toBe('http://localhost:3000/api/support-level');
    expect((seen!.init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(JSON.parse(String(seen!.init.body))).toEqual({ windowDays: 28, utcOffsetMinutes: 330, region: 'IN' });
  });

  it('surfaces the server error message', async () => {
    const fetchImpl = (async () => ({ ok: false, status: 401, json: async () => ({ error: 'Sign in is required.' }) })) as unknown as typeof fetch;
    await expect(fetchSupportLevel({ apiBaseUrl: 'http://x', accessToken: 't', fetchImpl })).rejects.toThrow('Sign in is required.');
  });

  it('turns a network failure into a friendly message', async () => {
    const fetchImpl = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    await expect(fetchSupportLevel({ apiBaseUrl: 'http://x', accessToken: 't', fetchImpl })).rejects.toThrow('Could not reach the support service.');
  });

  it('times out instead of hanging', async () => {
    const fetchImpl = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal!.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); });
      })) as unknown as typeof fetch;
    await expect(fetchSupportLevel({ apiBaseUrl: 'http://x', accessToken: 't', fetchImpl, timeoutMs: 20 })).rejects.toThrow('took too long');
  });

  it('refuses to call when no address is configured', async () => {
    await expect(fetchSupportLevel({ apiBaseUrl: '', accessToken: 't' })).rejects.toThrow('address is not set');
  });
});

describe('questionnaire wording', () => {
  it('gives gentle labels for every band and never names a condition', () => {
    for (const band of ['minimal', 'mild', 'moderate', 'moderately_severe', 'severe', 'low', 'watch', 'likely']) {
      const label = screeningBandLabel(band);
      expect(/depress|diagnos|disorder/i.test(label)).toBe(false);
      expect(label.length > 0).toBe(true);
    }
    expect(screeningBandLabel('something_new')).toBe('Result recorded');
    expect(screeningBandLabel(undefined)).toBe('Result recorded');
  });

  it('describes how long ago a questionnaire was completed', () => {
    expect(describeScreeningAge(0)).toBe('today');
    expect(describeScreeningAge(1)).toBe('yesterday');
    expect(describeScreeningAge(9)).toBe('9 days ago');
  });
});
