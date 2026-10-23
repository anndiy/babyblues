import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import { extractFeatures } from './features.js';
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
      db.from('care_logs')
        .select('event_type, logged_at')
        .eq('parent_id', userId).gte('logged_at', start).lte('logged_at', now.toISOString())
        .order('logged_at', { ascending: false }).limit(500)
    ]);
    if (checkinResult.error) return res.status(500).json({ error: `Could not load wellbeing check-ins: ${checkinResult.error.message}` });
    if (careResult.error) return res.status(500).json({ error: `Could not load baby-care activity: ${careResult.error.message}` });

    const features = extractFeatures({ checkins: checkinResult.data || [], careLogs: careResult.data || [], now, windowDays });
    const interpretation = await interpretFeatures(features);
    return res.json({
      generatedAt: new Date().toISOString(),
      windowDays,
      features: {
        currentCheckinCount: features.currentPeriod.checkinCount,
        previousCheckinCount: features.previousPeriod.checkinCount,
        signals: features.signals
      },
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

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`BabyBlues AI backend listening on port ${port}`));
