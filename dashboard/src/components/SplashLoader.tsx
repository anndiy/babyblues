import { HeartPulse } from 'lucide-react';
import type { ResearchFact } from '../lib/facts';
import { SPLASH_MIN_MS } from '../lib/useSplash';

type Props = {
  fact: ResearchFact;
  leaving: boolean;
};

export function SplashLoader({ fact, leaving }: Props) {
  return (
    <div
      className={`splash${leaving ? ' is-leaving' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Loading BabyBlues"
      style={{ '--splash-ms': `${SPLASH_MIN_MS}ms` } as React.CSSProperties}
    >
      <div className="splash-glow" aria-hidden="true" />

      <div className="splash-inner">
        <div className="splash-brand">
          <span className="brand-mark splash-mark" aria-hidden="true">
            <HeartPulse size={26} />
          </span>
          <strong>BabyBlues</strong>
        </div>

        <figure className="splash-fact glass-panel border-gradient">
          <figcaption className="splash-kicker">Did you know?</figcaption>
          <blockquote className="splash-text">{fact.text}</blockquote>
          <p className="splash-cite">
            <a href={fact.url} target="_blank" rel="noopener noreferrer">
              {fact.citation}
            </a>
          </p>
        </figure>

        <div className="splash-progress" aria-hidden="true">
          <span />
        </div>
        <p className="splash-status">Preparing your overview…</p>
      </div>
    </div>
  );
}
