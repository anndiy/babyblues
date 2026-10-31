import { useEffect, useState } from 'react';

/** The loader stays up for at least this long, so the fact can be read and the open feels unhurried. */
export const SPLASH_MIN_MS = 1500;
/** Safety cap: if sign-in or data loading stalls, the loader still gives way. */
export const SPLASH_MAX_MS = 4000;
/** Must match the exit transition on .splash in App.css. */
export const SPLASH_EXIT_MS = 600;

export type SplashPhase = 'showing' | 'leaving' | 'gone';

/**
 * Drives the opening loader.
 * It starts leaving once the minimum time has passed AND the app reports it is ready
 * (or the safety cap is reached), then is removed after the exit transition.
 */
export function useSplash(ready: boolean): SplashPhase {
  const [minElapsed, setMinElapsed] = useState(false);
  const [capped, setCapped] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const minTimer = window.setTimeout(() => setMinElapsed(true), SPLASH_MIN_MS);
    const capTimer = window.setTimeout(() => setCapped(true), SPLASH_MAX_MS);
    return () => {
      window.clearTimeout(minTimer);
      window.clearTimeout(capTimer);
    };
  }, []);

  const shouldLeave = capped || (minElapsed && ready);

  useEffect(() => {
    if (!shouldLeave) return;
    const timer = window.setTimeout(() => setGone(true), SPLASH_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [shouldLeave]);

  if (gone) return 'gone';
  return shouldLeave ? 'leaving' : 'showing';
}
