
import { useEffect, useMemo, useState } from 'react';
import { generateSupportSignals } from './lib/insights';
import { evaluateWellbeingData } from './lib/evaluation';
import { SupportLevelPanel } from './components/SupportLevelPanel';
import { SplashLoader } from './components/SplashLoader';
import { pickRandomFact } from './lib/facts';
import { useSplash } from './lib/useSplash';
import {
  Activity,
  AlertTriangle,
  Baby,
  ClipboardList,
  Download,
  HeartPulse,
  LogOut,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import './App.css';

type BabyRecord = {
  id: string;
  display_name: string;
};

type CareLog = {
  id: string;
  event_type: string;
  logged_at: string;
  baby_id: string | null;
  feeding_type: string | null;
  amount_ml: number | null;
  sleep_started_at: string | null;
  sleep_ended_at: string | null;
  diaper_type: string | null;
};

type Checkin = {
  id: string;
  mood: number;
  stress: number;
  energy: number;
  sleep_hours: number | null;
  appetite: number;
  created_at: string;
};

const localDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

const titleCase = (value: string) =>
  value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

/* Chart styling for the glass-dark theme. Colours are paired with a legend
   (and dash patterns on the lines) so meaning never depends on colour alone. */
const CHART_AXIS_TICK = { fill: '#aab7ca', fontSize: 12 };
const CHART_GRID_STROKE = 'rgba(148, 163, 184, 0.16)';
const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    background: 'rgba(11, 18, 32, 0.94)',
    border: '1px solid rgba(148, 163, 184, 0.3)',
    borderRadius: 12,
    color: '#e2e8f0',
    boxShadow: '0 12px 32px rgba(2, 6, 23, 0.5)',
  },
  labelStyle: { color: '#f8fafc', fontWeight: 600 },
  itemStyle: { color: '#e2e8f0' },
} as const;
const CHART_LEGEND_STYLE = { color: '#cbd5e1', fontSize: 12, paddingTop: 10 } as const;

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [fact] = useState(pickRandomFact);

  // The opening loader holds for ~1.5s while auth and the first data load finish behind it.
  const splashPhase = useSplash(authReady && (!session || dataLoaded));

  const [babies, setBabies] = useState<BabyRecord[]>([]);
  const [careLogs, setCareLogs] = useState<CareLog[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setError('');
      setNotice('');
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setError('');

    try {
      const [babiesResult, logsResult, checkinsResult] = await Promise.all([
        supabase
          .from('babies')
          .select('id, display_name')
          .order('created_at', { ascending: false }),

        supabase
          .from('care_logs')
          .select(
            'id, event_type, logged_at, baby_id, feeding_type, amount_ml, sleep_started_at, sleep_ended_at, diaper_type',
          )
          .order('logged_at', { ascending: false })
          .limit(500),

        supabase
          .from('wellbeing_checkins')
          .select('id, mood, stress, energy, sleep_hours, appetite, created_at')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      if (babiesResult.error) throw babiesResult.error;
      if (logsResult.error) throw logsResult.error;
      if (checkinsResult.error) throw checkinsResult.error;

      setBabies((babiesResult.data ?? []) as BabyRecord[]);
      setCareLogs((logsResult.data ?? []) as CareLog[]);
      setCheckins((checkinsResult.data ?? []) as Checkin[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load dashboard data. Check your Supabase tables and RLS policies.',
      );
    } finally {
      setLoading(false);
      setDataLoaded(true);
    }
  }

  useEffect(() => {
    if (session) void loadDashboard();
  }, [session?.user.id]);

  const babyNames = useMemo(
    () => new Map(babies.map((baby) => [baby.id, baby.display_name])),
    [babies],
  );

  const activityData = useMemo(() => {
    const days: { date: string; label: string; feeding: number; sleep: number; diaper: number }[] = [];
    const now = new Date();

    for (let offset = 6; offset >= 0; offset--) {
      const day = new Date(now);
      day.setDate(now.getDate() - offset);
      day.setHours(0, 0, 0, 0);

      days.push({
        date: localDateKey(day),
        label: day.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        feeding: 0,
        sleep: 0,
        diaper: 0,
      });
    }

    for (const log of careLogs) {
      const date = new Date(log.logged_at);
      const key = localDateKey(date);
      const day = days.find((item) => item.date === key);
      if (!day) continue;

      const type = log.event_type.toLowerCase();
      if (type.includes('feed')) day.feeding += 1;
      else if (type.includes('sleep')) day.sleep += 1;
      else if (type.includes('diaper')) day.diaper += 1;
    }

    return days;
  }, [careLogs]);

  const wellbeingData = useMemo(
    () =>
      [...checkins]
        .slice(0, 14)
        .reverse()
        .map((item) => ({
          date: formatDate(item.created_at),
          Mood: item.mood,
          Stress: item.stress,
          Energy: item.energy,
        })),
    [checkins],
  );
  const supportSignals = useMemo(
    () => generateSupportSignals(checkins),
    [checkins],
  );
  const evaluation = useMemo(
    () => evaluateWellbeingData(checkins),
    [checkins],
  );

  function exportEvaluationCSV() {
    const headers = [
      'record_type',
      'record_id',
      'recorded_at',
      'event_type',
      'baby_profile',
      'feeding_type',
      'amount_ml',
      'sleep_started_at',
      'sleep_ended_at',
      'diaper_type',
      'mood',
      'stress',
      'energy',
      'sleep_hours',
      'appetite',
      'evaluation_notes',
    ];

    const rows: (string | number | null)[][] = [];

    const addRow = (
      recordType: string,
      recordId = '',
      recordedAt = '',
      eventType = '',
      babyProfile = '',
      feedingType: string | null = '',
      amountMl: number | null = null,
      sleepStartedAt: string | null = '',
      sleepEndedAt: string | null = '',
      diaperType: string | null = '',
      mood: number | null = null,
      stress: number | null = null,
      energy: number | null = null,
      sleepHours: number | null = null,
      appetite: number | null = null,
      notes = '',
    ) => {
      rows.push([
        recordType,
        recordId,
        recordedAt,
        eventType,
        babyProfile,
        feedingType,
        amountMl,
        sleepStartedAt,
        sleepEndedAt,
        diaperType,
        mood,
        stress,
        energy,
        sleepHours,
        appetite,
        notes,
      ]);
    };

    // Export wellbeing check-ins.
    for (const entry of checkins) {
      addRow(
        'wellbeing_checkin',
        entry.id,
        entry.created_at,
        '',
        '',
        '',
        null,
        '',
        '',
        '',
        entry.mood,
        entry.stress,
        entry.energy,
        entry.sleep_hours,
        entry.appetite,
      );
    }

    // Export care logs.
    for (const log of careLogs) {
      addRow(
        'care_log',
        log.id,
        log.logged_at,
        log.event_type,
        log.baby_id ? babyNames.get(log.baby_id) ?? 'Unknown profile' : '',
        log.feeding_type,
        log.amount_ml,
        log.sleep_started_at,
        log.sleep_ended_at,
        log.diaper_type,
      );
    }

    // Add a summary row for trend comparisons.
    addRow(
      'evaluation_summary',
      '',
      new Date().toISOString(),
      '',
      '',
      '',
      null,
      '',
      '',
      '',
      null,
      null,
      null,
      null,
      null,
      `Recent records: ${evaluation.recentCount}; previous records: ${evaluation.previousCount}; mood change: ${evaluation.moodChange ?? 'insufficient data'}; stress change: ${evaluation.stressChange ?? 'insufficient data'}; energy change: ${evaluation.energyChange ?? 'insufficient data'}`,
    );

    // Include any data-quality findings.
    for (const issue of evaluation.issues) {
      addRow(
        'data_quality_issue',
        issue.id,
        new Date().toISOString(),
        '',
        '',
        '',
        null,
        '',
        '',
        '',
        null,
        null,
        null,
        null,
        null,
        issue.message,
      );
    }

    const escapeCSV = (value: string | number | null) => {
      if (value === null || value === undefined) return '';
      const text = String(value);
      return `"${text.replace(/"/g, '""')}"`;
    };

    const csv = [
      headers.map(escapeCSV).join(','),
      ...rows.map((row) => row.map(escapeCSV).join(',')),
    ].join('\r\n');

    // UTF-8 BOM improves compatibility with spreadsheet software.
    const blob = new Blob(['\uFEFF', csv], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `babyblues-evaluation-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }


  const latestCheckin = checkins[0];

  async function handleAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthLoading(true);
    setError('');
    setNotice('');

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) throw signUpError;

        if (!data.session) {
          setNotice('Account created. Check your email to confirm it, then sign in.');
        } else {
          setNotice('Account created successfully.');
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignOut() {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(signOutError.message);
  }

  const splashVisible = splashPhase !== 'gone';
  const stageClass = `app-stage${splashPhase === 'showing' ? '' : ' is-revealed'}`;
  const splash = splashVisible ? (
    <SplashLoader fact={fact} leaving={splashPhase === 'leaving'} />
  ) : null;

  // The loader always sits in the same spot in the tree (after the page), so it is never
  // remounted when auth resolves and its progress bar runs uninterrupted.
  let page: React.ReactNode;

  if (!authReady) {
    page = splashVisible ? null : <main className="loading-screen">Loading BabyBlues…</main>;
  } else if (!session) {
    page = (
      <main className="auth-layout">
        <section className="auth-panel glass-panel border-gradient">
          <div className="brand-mark">
            <HeartPulse size={25} />
          </div>
          <p className="eyebrow">BABYBLUES · CARE RECORDS & WELLBEING DATA</p>
          <h1>Care records and wellbeing measures.</h1>
          <p className="auth-description">
            Sign in to review recorded infant-care events and self-reported maternal wellbeing measures.
          </p>

          <form onSubmit={handleAuth} className="auth-form">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              minLength={6}
              required
            />

            {error && (
              <p className="message error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="message success" role="status">
                {notice}
              </p>
            )}

            <button className="primary-button" disabled={authLoading}>
              {authLoading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <button
            type="button"
            className="text-button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
              setNotice('');
            }}
          >
            {isSignUp ? 'Already registered? Sign in' : 'Need an account? Create one'}
          </button>

          <p className="auth-footnote">
            <ShieldCheck size={15} /> Account access is managed through Supabase authentication.
          </p>
        </section>
      </main>
    );
  } else {
    page = (
      <main className="dashboard-shell">
        <header className="topbar glass-panel border-gradient">
          <div className="brand">
            <div className="brand-mark small">
              <HeartPulse size={21} />
            </div>
            <div>
              <strong>BabyBlues</strong>
              <span>Care records & wellbeing data</span>
            </div>
          </div>

          <div className="topbar-actions">
            <span className="user-email" title={session.user.email ?? undefined}>
              {session.user.email}
            </span>
            <button
              className={`icon-button${loading ? ' is-loading' : ''}`}
              onClick={() => void loadDashboard()}
              title="Refresh records"
              aria-label="Refresh dashboard records"
              disabled={loading}
            >
              <RefreshCw size={16} />
            </button>
            <button
              className="signout-button"
              onClick={exportEvaluationCSV}
              disabled={loading}
              aria-label="Export records and evaluation results as CSV"
            >
              <Download size={16} /> <span className="btn-label">Export CSV</span>
            </button>
            <button
              className="signout-button"
              onClick={() => void handleSignOut()}
              aria-label="Sign out"
            >
              <LogOut size={16} /> <span className="btn-label">Sign out</span>
            </button>
          </div>
        </header>

        <section className="welcome-row">
          <div>
            <p className="eyebrow">DATA OVERVIEW</p>
            <h1>Recorded care and self-reported wellbeing.</h1>
            <p className="muted">Descriptive summaries of care events and maternal wellbeing check-ins recorded in this account.</p>
          </div>
          <div className="privacy-note">
            <ShieldCheck size={17} /> Authenticated account
          </div>
        </section>

        {error && (
          <div className="message error dashboard-message" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="message success dashboard-message" role="status">
            {notice}
          </div>
        )}

        <section className="stat-grid" aria-label="Summary numbers">
          <article className="stat-card glass-panel border-gradient">
            <div className="stat-icon lavender">
              <Baby size={20} />
            </div>
            <p>Infant profiles</p>
            <strong>{babies.length}</strong>
            <span>Profiles accessible to this account</span>
          </article>

          <article className="stat-card glass-panel border-gradient">
            <div className="stat-icon blue">
              <ClipboardList size={20} />
            </div>
            <p>Care records retrieved</p>
            <strong>{careLogs.length}</strong>
            <span>Up to 500 most recent records</span>
          </article>

          <article className="stat-card glass-panel border-gradient">
            <div className="stat-icon peach">
              <HeartPulse size={20} />
            </div>
            <p>Wellbeing check-ins</p>
            <strong>{checkins.length}</strong>
            <span>Up to 100 most recent check-ins</span>
          </article>

          <article className="stat-card glass-panel border-gradient">
            <div className="stat-icon mint">
              <Activity size={20} />
            </div>
            <p>Latest reported mood</p>
            <strong>{latestCheckin ? `${latestCheckin.mood}/5` : '—'}</strong>
            <span>
              {latestCheckin
                ? formatDateTime(latestCheckin.created_at)
                : 'No check-in recorded yet'}
            </span>
          </article>
        </section>

        {loading && (
          <p className="loading-inline" role="status">
            Retrieving updated records…
          </p>
        )}

        <SupportLevelPanel
          accessToken={session.access_token}
          refreshKey={`${careLogs.length}-${checkins.length}`}
        />

        <div className="insight-grid">
          <section className="panel support-panel glass-panel border-gradient">
            <div className="panel-heading">
              <div>
                <h2>Rule-based wellbeing indicators</h2>
                <p>Indicators generated from recent self-reported check-ins using prototype rules</p>
              </div>
              <span className="panel-tag">EXPERIMENTAL</span>
            </div>

            <aside className="research-warning" role="note" aria-labelledby="research-warning-title">
              <AlertTriangle size={21} aria-hidden="true" />
              <div>
                <strong id="research-warning-title">Interpretation limits</strong>
                <p>These indicators are generated by prototype rules applied to self-reported check-ins.
                  They have not been clinically validated and are not a screening instrument. They
                  cannot estimate the likelihood of postpartum depression. Do not use these outputs
                  for diagnosis, treatment decisions, or emergency assessment.</p>
              </div>
            </aside>

            <div className="signal-list">
              {supportSignals.map((signal) => (
                <article key={signal.id} className={`signal-item ${signal.level}`}>
                  <div className="signal-dot" />
                  <div>
                    <strong>{signal.title}</strong>
                    <p>{signal.message}</p>
                  </div>
                </article>
              ))}
            </div>

            <p className="chart-footnote">
              Each indicator is a rule output, not a clinical finding. Interpret it alongside the
              underlying check-in records and the limitations stated above.
            </p>
          </section>

          <section className="panel support-panel glass-panel border-gradient">
            <div className="panel-heading">
              <div>
                <h2>Check-in summary & data validation</h2>
                <p>Mean of the latest three check-ins compared with the preceding three</p>
              </div>
              <span className="panel-tag">DATA REVIEW</span>
            </div>

            <div className="evaluation-grid">
              <article className="evaluation-item">
                <span>Recent check-ins (n)</span>
                <strong>{evaluation.recentCount}</strong>
              </article>
              <article className="evaluation-item">
                <span>Previous check-ins (n)</span>
                <strong>{evaluation.previousCount}</strong>
              </article>
              <article className="evaluation-item">
                <span>Mood mean difference</span>
                <strong>
                  {evaluation.moodChange === null
                    ? 'Not enough data'
                    : `${evaluation.moodChange > 0 ? '+' : ''}${evaluation.moodChange}`}
                </strong>
              </article>
              <article className="evaluation-item">
                <span>Stress mean difference</span>
                <strong>
                  {evaluation.stressChange === null
                    ? 'Not enough data'
                    : `${evaluation.stressChange > 0 ? '+' : ''}${evaluation.stressChange}`}
                </strong>
              </article>
              <article className="evaluation-item">
                <span>Energy mean difference</span>
                <strong>
                  {evaluation.energyChange === null
                    ? 'Not enough data'
                    : `${evaluation.energyChange > 0 ? '+' : ''}${evaluation.energyChange}`}
                </strong>
              </article>
            </div>

            <p className="chart-footnote">
              Differences are calculated as the recent mean minus the preceding mean. A positive
              stress difference represents higher self-reported stress. These descriptive changes
              are not clinical outcomes or statistical significance tests.
            </p>

            <h3 className="quality-heading">Input range validation</h3>

            {evaluation.issues.length === 0 ? (
              <p className="quality-clear">No out-of-range values were detected in the records checked.</p>
            ) : (
              <div className="quality-alert" role="alert" aria-labelledby="quality-alert-title">
                <div className="quality-alert-heading">
                  <AlertTriangle size={19} aria-hidden="true" />
                  <strong id="quality-alert-title">
                    {evaluation.issues.length} data-quality {evaluation.issues.length === 1 ? 'flag' : 'flags'} detected
                  </strong>
                </div>
                <p>Review the flagged records before interpreting the summary statistics.</p>
                <ul className="quality-list">
                  {evaluation.issues.map((issue) => (
                    <li key={issue.id}>{issue.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>

        <section className="chart-grid">
          <article className="panel glass-panel border-gradient">
            <div className="panel-heading">
              <div>
                <h2>Recorded care-event frequency</h2>
                <p>Daily counts of recorded feeding, sleep, and diaper events over seven days</p>
              </div>
              <span className="panel-tag">7 DAYS</span>
            </div>

            <div
              className="chart-container"
              role="img"
              aria-label="Bar chart of feeding, sleep and diaper records per day over the last seven days"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData} barGap={4}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke={CHART_GRID_STROKE}
                  />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={CHART_AXIS_TICK} />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                    tick={CHART_AXIS_TICK}
                  />
                  <Tooltip
                    {...CHART_TOOLTIP_STYLE}
                    cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={CHART_LEGEND_STYLE} />
                  <Bar dataKey="feeding" name="Feeding" fill="#60a5fa" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="sleep" name="Sleep" fill="#a78bfa" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="diaper" name="Diaper" fill="#fdba74" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="chart-footnote">Counts are grouped by the event_type value stored in each care record.</p>
          </article>

          <article className="panel glass-panel border-gradient">
            <div className="panel-heading">
              <div>
                <h2>Self-reported wellbeing measures</h2>
                <p>Mood, stress, and energy ratings from the latest 14 check-ins (1–5 scale)</p>
              </div>
              <span className="panel-tag">CHECK-INS</span>
            </div>

            {wellbeingData.length ? (
              <div
                className="chart-container"
                role="img"
                aria-label="Line chart of recent mood, stress and energy scores on a one to five scale"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={wellbeingData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke={CHART_GRID_STROKE}
                    />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={CHART_AXIS_TICK}
                    />
                    <YAxis
                      domain={[1, 5]}
                      ticks={[1, 2, 3, 4, 5]}
                      tickLine={false}
                      axisLine={false}
                      width={32}
                      tick={CHART_AXIS_TICK}
                    />
                    <Tooltip
                      {...CHART_TOOLTIP_STYLE}
                      cursor={{ stroke: 'rgba(148, 163, 184, 0.35)' }}
                    />
                    <Legend iconType="plainline" wrapperStyle={CHART_LEGEND_STYLE} />
                    <Line
                      type="monotone"
                      dataKey="Mood"
                      stroke="#6ee7b7"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Stress"
                      stroke="#fda4af"
                      strokeWidth={2.5}
                      strokeDasharray="7 4"
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Energy"
                      stroke="#93c5fd"
                      strokeWidth={2.5}
                      strokeDasharray="2 4"
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-state">
                <HeartPulse size={25} />
                <strong>No wellbeing records available</strong>
                <span>No check-in data is available for this account. Submit a check-in in the mobile app to populate this chart.</span>
              </div>
            )}
            <p className="chart-footnote">
              Scores are self-reported and are not a substitute for clinical assessment.
            </p>
          </article>
        </section>

        <section className="panel activity-panel glass-panel border-gradient">
          <div className="panel-heading">
            <div>
              <h2>Latest recorded care events</h2>
              <p>Most recent events, ordered by recorded timestamp</p>
            </div>
            <span className="panel-tag">{Math.min(careLogs.length, 10)} RECORDS</span>
          </div>

          {careLogs.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Event type</th>
                    <th scope="col">Infant profile</th>
                    <th scope="col">Recorded details</th>
                    <th scope="col">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {careLogs.slice(0, 10).map((log) => {
                    const details: string[] = [];

                    if (log.feeding_type) details.push(titleCase(log.feeding_type));
                    if (log.amount_ml != null) details.push(`${log.amount_ml} ml`);
                    if (log.diaper_type) details.push(`${titleCase(log.diaper_type)} diaper`);

                    if (log.sleep_started_at && log.sleep_ended_at) {
                      const hours =
                        (new Date(log.sleep_ended_at).getTime() -
                          new Date(log.sleep_started_at).getTime()) /
                        3_600_000;
                      if (hours > 0) details.push(`${hours.toFixed(1)} h sleep`);
                    }

                    return (
                      <tr key={log.id}>
                        <td>
                          <span className="event-pill">{titleCase(log.event_type)}</span>
                        </td>
                        <td>
                          {log.baby_id ? (babyNames.get(log.baby_id) ?? 'Baby profile') : '—'}
                        </td>
                        <td>{details.length ? details.join(' · ') : '—'}</td>
                        <td>{formatDateTime(log.logged_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state compact">
              <ClipboardList size={24} />
              <strong>No care records available</strong>
              <span>No feeding, sleep, or diaper events are currently available for this account.</span>
            </div>
          )}
        </section>

        <footer className="dashboard-footer">
          <span>BabyBlues · Research prototype</span>
          <span>Descriptive data review only. Not a screening, diagnostic, or emergency-care service.</span>
        </footer>
      </main>
    );
  }

  return (
    <>
      <div className={stageClass} inert={splashVisible}>
        {page}
      </div>
      {splash}
    </>
  );
}

export default App;
