import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import { extractFeatures } from './features.js';
import { extractUsagePatterns, deriveSupportLevel } from './usage-patterns.js';
import { getCrisisResources } from './crisis-resources.js';
import { buildSupportResponse } from './support-response.js';
import { fetchAllPages } from './paging.js';
import { interpretFeatures } from './gemini.js';

for (const key of ['SUPABASE_URL', 'SUPABASE_ANON_KEY']) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}
const app = express();
app.disable('x-powered-by');
app.use(helmet());
const origins = (process.env.CORS_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);
app.use(cors({
  origin(origin, cb) {
    if (!origin || origins.length === 0 || origins.includes(origin)) return cb(null, true);
    return cb(new Error('Origin not allowed by CORS'));
  },
  credentials: false
}));
app.use(express.json({ limit: '20kb' }));
app.use(rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false }));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'babyblues-ai-backend' }));

app.post('/api/analysis/wellbeing', async (req, res) => {
  const token = (req.headers.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return res.status(401).json({ error: 'Sign in is required.' });
  const windowDays = Number(req.body?.windowDays ?? 28);
  if (!Number.isInteger(windowDays) || windowDays < 7 || windowDays > 60) {
    return res.status(400).json({ error: 'windowDays must be an integer between 7 and 60.' });
  }

  // Optional: the client's UTC offset in minutes (e.g. India = 330) so "overnight" means the parent's local night.
  const utcOffsetMinutes = Number(req.body?.utcOffsetMinutes ?? 0);
  if (!Number.isInteger(utcOffsetMinutes) || utcOffsetMinutes < -840 || utcOffsetMinutes > 840) {
    return res.status(400).json({ error: 'utcOffsetMinutes must be an integer between -840 and 840.' });
  }

  try {
    const auth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: authData, error: authError } = await auth.auth.getUser(token);
    const userId = authData?.user?.id;
    if (authError || !userId) return res.status(401).json({ error: 'Your session is invalid or expired. Please sign in again.' });

    const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // This table is introduced by the supplied SQL migration; preference defaults to false.
    const { data: preference, error: prefError } = await db
      .from('wellbeing_analysis_preferences')
      .select('ai_sharing_enabled')
      .eq('user_id', userId)
      .maybeSingle();
    if (prefError) return res.status(500).json({ error: `Could not verify AI-sharing preference: ${prefError.message}` });
    if (preference?.ai_sharing_enabled !== true) {
      return res.status(403).json({ error: 'Enable AI-assisted reflections in My Insights before requesting an AI reflection.' });
    }

    const now = new Date();
    const start = new Date(now.getTime() - windowDays * 2 * 86400000).toISOString();
    const [checkinResult, careResult] = await Promise.all([
      db.from('wellbeing_checkins')
        .select('mood, stress, energy, sleep_hours, appetite, created_at')
        .eq('parent_id', userId).gte('created_at', start).lte('created_at', now.toISOString())
        .order('created_at', { ascending: false }).limit(120),
      fetchAllPages(() => db.from('care_logs')
        .select('event_type, logged_at')
        .eq('parent_id', userId).gte('logged_at', start).lte('logged_at', now.toISOString())
        .order('logged_at', { ascending: false }))
    ]);
    if (checkinResult.error) return res.status(500).json({ error: `Could not load wellbeing check-ins: ${checkinResult.error.message}` });
    if (careResult.error) return res.status(500).json({ error: `Could not load baby-care activity: ${careResult.error.message}` });

    const features = extractFeatures({ checkins: checkinResult.data || [], careLogs: careResult.data || [], now, windowDays });
    const careRows = careResult.data || [];
    const usage = extractUsagePatterns({ careLogs: careRows, now, windowDays, utcOffsetMinutes });
    const supportLevel = deriveSupportLevel({ features, usage });
    const interpretation = await interpretFeatures(features);
    return res.json({
      generatedAt: new Date().toISOString(),
      windowDays,
      features: {
        currentCheckinCount: features.currentPeriod.checkinCount,
        previousCheckinCount: features.previousPeriod.checkinCount,
        signals: features.signals
      },
      usage,
      supportLevel,
      crisisResources: getCrisisResources(req.body?.region),
      interpretation: {
        summary: interpretation.summary,
        context: interpretation.context,
        nextSteps: interpretation.nextSteps,
        disclaimer: interpretation.disclaimer
      },
      meta: {
        provider: interpretation.provider,
        providerError: interpretation.providerError || null,
        comparisonEligible: features.comparisonEligible,
        notice: 'Experimental reflection only. Not a diagnosis, screening result, or validated clinical prediction.'
      }
    });
  } catch (error) {
    console.error('Analysis request failed:', error?.message || error);
    return res.status(500).json({ error: 'Analysis could not be completed. Please try again later.' });
  }
});

// Rule-based support level. No AI and no third-party sharing, so it does not need AI-sharing consent.
// It still requires a signed-in user and reads only that user's own rows through Row Level Security.
app.post('/api/support-level', async (req, res) => {
  const token = (req.headers.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return res.status(401).json({ error: 'Sign in is required.' });
  const windowDays = Number(req.body?.windowDays ?? 28);
  if (!Number.isInteger(windowDays) || windowDays < 7 || windowDays > 60) {
    return res.status(400).json({ error: 'windowDays must be an integer between 7 and 60.' });
  }
  const utcOffsetMinutes = Number(req.body?.utcOffsetMinutes ?? 0);
  if (!Number.isInteger(utcOffsetMinutes) || utcOffsetMinutes < -840 || utcOffsetMinutes > 840) {
    return res.status(400).json({ error: 'utcOffsetMinutes must be an integer between -840 and 840.' });
  }
  const region = typeof req.body?.region === 'string' ? req.body.region.slice(0, 8) : undefined;

  try {
    const auth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: authData, error: authError } = await auth.auth.getUser(token);
    const userId = authData?.user?.id;
    if (authError || !userId) return res.status(401).json({ error: 'Your session is invalid or expired. Please sign in again.' });

    const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const now = new Date();
    const start = new Date(now.getTime() - windowDays * 2 * 86400000).toISOString();
    const [checkinResult, careResult] = await Promise.all([
      db.from('wellbeing_checkins')
        .select('mood, stress, energy, sleep_hours, appetite, created_at')
        .eq('parent_id', userId).gte('created_at', start).lte('created_at', now.toISOString())
        .order('created_at', { ascending: false }).limit(120),
      fetchAllPages(() => db.from('care_logs')
        .select('event_type, logged_at')
        .eq('parent_id', userId).gte('logged_at', start).lte('logged_at', now.toISOString())
        .order('logged_at', { ascending: false }))
    ]);
    if (checkinResult.error) return res.status(500).json({ error: 'Could not load wellbeing check-ins.' });
    if (careResult.error) return res.status(500).json({ error: 'Could not load baby-care activity.' });

    // Questionnaire results are optional: if the table is missing or unreadable, carry on without them.
    const screeningResult = await db.from('screening_responses')
      .select('instrument, answers, created_at')
      .eq('parent_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);
    if (screeningResult.error) console.warn('Screening responses unavailable:', screeningResult.error.code || screeningResult.error.message);

    return res.json(buildSupportResponse({
      checkins: checkinResult.data || [], careLogs: careResult.data || [],
      screeningRows: screeningResult.error ? [] : (screeningResult.data || []),
      screeningAvailable: !screeningResult.error,
      now, windowDays, utcOffsetMinutes, region
    }));
  } catch (error) {
    console.error('Support-level request failed:', error?.message || error);
    return res.status(500).json({ error: 'The support summary could not be completed. Please try again later.' });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`BabyBlues AI backend listening on port ${port}`));
