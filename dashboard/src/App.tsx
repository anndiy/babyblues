
import { useEffect, useMemo, useState } from 'react';
import { generateSupportSignals } from './lib/insights';
import { evaluateWellbeingData } from './lib/evaluation';
import {
  Activity,
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
        date: day.toISOString().slice(0, 10),
        label: day.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        feeding: 0,
        sleep: 0,
        diaper: 0,
      });
    }

    for (const log of careLogs) {
      const date = new Date(log.logged_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
  console.log('Recent wellbeing check-ins:', checkins.slice(0, 3));
  console.log('Generated support signals:', supportSignals);

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

  if (!authReady) {
    return <main className="loading-screen">Loading BabyBlues…</main>;
  }

  if (!session) {
    return (
      <main className="auth-layout">
        <section className="auth-panel">
          <div className="brand-mark"><HeartPulse size={25} /></div>
          <p className="eyebrow">BABYBLUES · CARE INSIGHTS</p>
          <h1>Care data, made clearer.</h1>
          <p className="auth-description">
            Sign in to review baby-care activity and maternal wellbeing check-ins.
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

            {error && <p className="message error">{error}</p>}
            {notice && <p className="message success">{notice}</p>}

            <button className="primary-button" disabled={authLoading}>
              {authLoading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <button
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
            <ShieldCheck size={15} /> Your dashboard uses your authenticated Supabase session.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark small"><HeartPulse size={21} /></div>
          <div>
            <strong>BabyBlues</strong>
            <span>Care insights dashboard</span>
          </div>
        </div>

        <div className="topbar-actions">
          <span className="user-email">{session.user.email}</span>
          <button className="icon-button" onClick={() => void loadDashboard()} title="Refresh data">
            <RefreshCw size={16} />
          </button>
          <button
            className="signout-button"
            onClick={exportEvaluationCSV}
            disabled={loading}
          >
            <Download size={16} /> Export CSV
          </button>
          <button className="signout-button" onClick={() => void handleSignOut()}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </header>

      <section className="welcome-row">
        <div>
          <p className="eyebrow">YOUR OVERVIEW</p>
          <h1>Care, at a glance.</h1>
          <p className="muted">A summary of the data recorded in your BabyBlues app.</p>
        </div>
        <div className="privacy-note"><ShieldCheck size={17} /> Signed-in account view</div>
      </section>

      {error && <div className="message error dashboard-message">{error}</div>}
      {notice && <div className="message success dashboard-message">{notice}</div>}

      <section className="stat-grid">
        <article className="stat-card">
          <div className="stat-icon lavender"><Baby size={20} /></div>
          <p>Baby profiles</p>
          <strong>{babies.length}</strong>
          <span>Profiles available to this account</span>
        </article>

        <article className="stat-card">
          <div className="stat-icon blue"><ClipboardList size={20} /></div>
          <p>Care logs loaded</p>
          <strong>{careLogs.length}</strong>
          <span>Most recent 500 records maximum</span>
        </article>

        <article className="stat-card">
          <div className="stat-icon peach"><HeartPulse size={20} /></div>
          <p>Wellbeing check-ins</p>
          <strong>{checkins.length}</strong>
          <span>Most recent 100 records maximum</span>
        </article>

        <article className="stat-card">
          <div className="stat-icon mint"><Activity size={20} /></div>
          <p>Latest mood score</p>
          <strong>{latestCheckin ? `${latestCheckin.mood}/5` : '—'}</strong>
          <span>{latestCheckin ? formatDateTime(latestCheckin.created_at) : 'No check-in recorded yet'}</span>
        </article>
      </section>

      {loading && <p className="loading-inline">Refreshing dashboard data…</p>}
      
<section className="panel support-panel">
  <div className="panel-heading">
    <div>
      <h2>Wellbeing support signals</h2>
      <p>Transparent prompts based on recent self-reported check-ins</p>
    </div>
    <span className="panel-tag">EXPERIMENTAL</span>
  </div>

  <div className="signal-list">
    {supportSignals.map((signal) => (
      <article
        key={signal.id}
        className={`signal-item ${signal.level}`}
      >
        <div className="signal-dot" />
        <div>
          <strong>{signal.title}</strong>
          <p>{signal.message}</p>
        </div>
      </article>
    ))}
  </div>

  <p className="chart-footnote">
    Prototype rules only. These signals are not clinically validated,
    do not estimate a probability of postpartum depression, and must
    not be used to make clinical decisions.
  </p>
</section>

<section className="panel support-panel">
  <div className="panel-heading">
    <div>
      <h2>Data quality & trend comparison</h2>
      <p>Recent three check-ins compared with the preceding three</p>
    </div>
    <span className="panel-tag">DATA REVIEW</span>
  </div>

  <div className="evaluation-grid">
    <article className="evaluation-item">
      <span>Recent records</span>
      <strong>{evaluation.recentCount}</strong>
    </article>
    <article className="evaluation-item">
      <span>Previous records</span>
      <strong>{evaluation.previousCount}</strong>
    </article>
    <article className="evaluation-item">
      <span>Mood change</span>
      <strong>
        {evaluation.moodChange === null
          ? 'Not enough data'
          : `${evaluation.moodChange > 0 ? '+' : ''}${evaluation.moodChange}`}
      </strong>
    </article>
    <article className="evaluation-item">
      <span>Stress change</span>
      <strong>
        {evaluation.stressChange === null
          ? 'Not enough data'
          : `${evaluation.stressChange > 0 ? '+' : ''}${evaluation.stressChange}`}
      </strong>
    </article>
    <article className="evaluation-item">
      <span>Energy change</span>
      <strong>
        {evaluation.energyChange === null
          ? 'Not enough data'
          : `${evaluation.energyChange > 0 ? '+' : ''}${evaluation.energyChange}`}
      </strong>
    </article>
  </div>

  <p className="chart-footnote">
    Changes are recent averages minus previous averages. Positive values
    do not always indicate improvement, particularly for stress.
  </p>

  <h3 className="quality-heading">Data-quality checks</h3>

  {evaluation.issues.length === 0 ? (
    <p className="quality-clear">
      No out-of-range values detected by these checks.
    </p>
  ) : (
    <ul className="quality-list">
      {evaluation.issues.map((issue) => (
        <li key={issue.id}>{issue.message}</li>
      ))}
    </ul>
  )}
</section>

      <section className="chart-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>Care activity</h2>
              <p>Daily records over the last seven days</p>
            </div>
            <span className="panel-tag">7 DAYS</span>
          </div>

          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9e7ef" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} />
                <Tooltip />
                <Bar dataKey="feeding" name="Feeding" fill="#7c72d8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sleep" name="Sleep" fill="#64a7ce" radius={[4, 4, 0, 0]} />
                <Bar dataKey="diaper" name="Diaper" fill="#e6a47d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="chart-footnote">Counts use the event type saved in each care log.</p>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <h2>Wellbeing trends</h2>
              <p>Recent self-reported scores, on a 1–5 scale</p>
            </div>
            <span className="panel-tag">CHECK-INS</span>
          </div>

          {wellbeingData.length ? (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={wellbeingData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9e7ef" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} />
                  <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tickLine={false} axisLine={false} width={30} />
                  <Tooltip />
                  <Line type="monotone" dataKey="Mood" stroke="#7c72d8" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Stress" stroke="#e6a47d" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Energy" stroke="#64a7ce" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state">
              <HeartPulse size={25} />
              <strong>No check-ins yet</strong>
              <span>Submit a wellbeing check-in in the mobile app to see trends here.</span>
            </div>
          )}
          <p className="chart-footnote">These are self-reported measures, not a clinical assessment.</p>
        </article>
      </section>

      <section className="panel activity-panel">
        <div className="panel-heading">
          <div>
            <h2>Recent care activity</h2>
            <p>The latest recorded events</p>
          </div>
          <span className="panel-tag">{Math.min(careLogs.length, 10)} RECORDS</span>
        </div>

        {careLogs.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Baby profile</th>
                  <th>Details</th>
                  <th>Recorded</th>
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
                      <td><span className="event-pill">{titleCase(log.event_type)}</span></td>
                      <td>{log.baby_id ? babyNames.get(log.baby_id) ?? 'Baby profile' : '—'}</td>
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
            <strong>No care logs found</strong>
            <span>Record a feeding, sleep, or diaper event in the mobile app.</span>
          </div>
        )}
      </section>

      <footer className="dashboard-footer">
        <span>BabyBlues · Prototype dashboard</span>
        <span>Not a diagnostic or emergency-care tool.</span>
      </footer>
    </main>
  );
}

export default App;
