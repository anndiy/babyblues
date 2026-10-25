import { useEffect, useState } from 'react';
import { HeartPulse, ShieldCheck } from 'lucide-react';
import {
  STATIC_CRISIS_RESOURCES_IN,
  fetchSupportLevel,
  levelCopy,
  phoneHref,
} from '../lib/supportLevel';
import type { CrisisResources, SupportLevelResponse } from '../lib/supportLevel';

const API_BASE_URL: string =
  (import.meta.env as Record<string, string | undefined>).VITE_API_BASE_URL ?? 'http://localhost:3000';
const REGION: string =
  (import.meta.env as Record<string, string | undefined>).VITE_REGION ?? 'IN';

type Props = {
  accessToken: string;
  /** Change this value to reload the summary (e.g. after the dashboard data refreshes). */
  refreshKey: string;
};

function CrisisBox({ resources, emphasised }: { resources: CrisisResources; emphasised: boolean }) {
  const contacts = [resources.emergency, ...resources.support];
  return (
    <div className={`crisis-box${emphasised ? ' emphasised' : ''}`} role="region" aria-label="Support contacts">
      <strong>If you need to talk to someone now</strong>
      <p>You do not have to wait for a pattern or a score. Reaching out is always okay.</p>
      <ul>
        {contacts.map((contact) => {
          const href = phoneHref(contact.number);
          return (
            <li key={contact.label}>
              <span>{contact.label}</span>
              {href && contact.number ? <a href={href}>{contact.number}</a> : <em>Contact your local service</em>}
              {contact.note && <small>{contact.note}</small>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SupportLevelPanel({ accessToken, refreshKey }: Props) {
  const [data, setData] = useState<SupportLevelResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load(isActive: () => boolean) {
    setLoading(true);
    setError('');
    try {
      const result = await fetchSupportLevel({ apiBaseUrl: API_BASE_URL, accessToken, region: REGION });
      if (isActive()) setData(result);
    } catch (err) {
      if (isActive()) {
        setData(null);
        setError(err instanceof Error ? err.message : 'The support summary is unavailable.');
      }
    } finally {
      if (isActive()) setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void load(() => active);
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, refreshKey]);

  const level = data?.supportLevel.level;
  const copy = levelCopy(level);
  const resources = data?.crisisResources ?? STATIC_CRISIS_RESOURCES_IN;
  const showReasons = !!data && data.supportLevel.reasons.length > 0;
  const emphasised = level === 'talk_to_someone' || level === 'talk_to_someone_priority';

  return (
    <section className="panel support-panel support-level-panel" aria-live="polite">
      <div className="panel-heading">
        <div>
          <h2>Support level</h2>
          <p>Combines your own check-ins with changes in your logging, compared with your own earlier weeks</p>
        </div>
        <span className="panel-tag">EXPERIMENTAL</span>
      </div>

      {loading && <p className="loading-inline">Looking at your recent weeks…</p>}

      {!loading && error && (
        <div className="support-level-card calm">
          <HeartPulse size={18} />
          <div>
            <strong>Support summary unavailable right now</strong>
            <p>{error} Your data is safe, and the contacts below are always available.</p>
          </div>
        </div>
      )}

      {!loading && data && (
        <>
          <div className={`support-level-card ${copy.tone}`}>
            <HeartPulse size={18} />
            <div>
              <strong>{copy.title}</strong>
              <p>{data.supportLevel.message}</p>
            </div>
          </div>

          {showReasons && (
            <div className="support-reasons">
              <h3>What this is based on</h3>
              <ul>
                {data.supportLevel.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="support-usage">
            <h3>Logging pattern vs. your own earlier weeks</h3>
            <ul>
              {data.usage.measures.map((measure) => (
                <li key={measure.key} className={measure.direction}>
                  <span className="measure-dot" aria-hidden="true" />
                  <div>
                    <strong>{measure.title}</strong>
                    <p>{measure.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
            <details>
              <summary>Why logging can change for ordinary reasons</summary>
              <ul>
                {data.usage.ordinaryExplanations.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </details>
            <p className="chart-footnote">
              {data.selfReport.currentCheckinCount} check-ins recently, {data.selfReport.previousCheckinCount} in the
              weeks before. {data.usage.timezoneNote}
            </p>
          </div>
        </>
      )}

      <CrisisBox resources={resources} emphasised={emphasised} />

      <p className="chart-footnote">
        <ShieldCheck size={12} /> {data?.meta.notice ?? 'Rule-based prototype. Not a diagnosis, screening result, or validated clinical prediction.'}{' '}
        Changes in logging alone are never treated as a sign of a mental-health condition, and a check-in that
        concerns you is never dismissed because logging looks normal. No AI is used for this panel.
      </p>
    </section>
  );
}
