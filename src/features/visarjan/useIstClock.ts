'use client';

import { useSyncExternalStore } from 'react';

/**
 * The IST clock, as an external store.
 *
 * Shared by everything on the visarjan page that needs to know the hour.
 * The page is ISR at revalidate = 3600, so the server cannot supply this:
 * a cached "now" would tell someone the procession had not reached a chowk
 * it passed forty minutes ago.
 *
 * The snapshot is the minute, so it is stable between ticks and React
 * re-renders when the minute turns rather than on every interval.
 */

const IST_OFFSET_MIN = 5.5 * 60;

/** Minutes past midnight IST. */
export function istMinutesNow(): number {
  const now = new Date();
  return (now.getUTCHours() * 60 + now.getUTCMinutes() + IST_OFFSET_MIN) % (24 * 60);
}

export function formatIst(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function subscribe(onChange: () => void): () => void {
  const id = setInterval(onChange, 30_000);
  return () => clearInterval(id);
}

const snapshot = () => istMinutesNow();
/** No clock in the prerendered HTML — the server has no "now" worth having. */
const serverSnapshot = (): number | null => null;

/**
 * Minutes past midnight IST, or null on the server, before hydration, and
 * on any day this page is not about.
 */
export function useIstMinutes(active: boolean): number | null {
  const value = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return active ? value : null;
}
