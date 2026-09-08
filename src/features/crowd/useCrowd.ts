'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  getCrowdState,
  getServerCrowdState,
  subscribeToCrowd,
} from './crowd-store';
import type { CrowdStatus } from '@/types/crowd';

/**
 * Read crowd state from the shared store.
 *
 * `useSyncExternalStore` rather than an effect-and-state pair: it is the
 * API designed for exactly this, it gives a correct SSR snapshot so
 * hydration cannot mismatch, and it means mounting a hundred badges adds
 * a hundred listeners rather than a hundred pollers.
 */
export function useCrowdState() {
  return useSyncExternalStore(subscribeToCrowd, getCrowdState, getServerCrowdState);
}

export interface UseCrowdStatus {
  status: CrowdStatus | null;
  stale: boolean;
  unavailable: boolean;
  loading: boolean;
}

/**
 * Deliberately returns no derived age.
 *
 * Reading the clock during render is impure — two renders in the same
 * commit can disagree — and on a server-rendered page it guarantees a
 * hydration mismatch, because the server's clock is not the device's.
 * Components that show "updated 3 min ago" own that ticking themselves
 * (see CrowdPanel), which also lets the text update without a new fetch.
 */
export function useCrowdStatus(mandalId: string | null): UseCrowdStatus {
  const state = useCrowdState();
  return {
    status: mandalId ? state.byMandalId[mandalId] ?? null : null,
    stale: state.stale,
    unavailable: state.unavailable,
    loading: state.loading,
  };
}

/** Crowd status for many mandals at once — map markers, card lists. */
export function useCrowdStatuses(mandalIds: string[]): Record<string, CrowdStatus> {
  const state = useCrowdState();

  const pick = useCallback(() => {
    const out: Record<string, CrowdStatus> = {};
    for (const id of mandalIds) {
      const status = state.byMandalId[id];
      if (status) out[id] = status;
    }
    return out;
  }, [mandalIds, state]);

  return pick();
}

/* ------------------------------------------------------------------ *
 * A shared clock.
 *
 * "Updated 3 min ago" has to re-render as time passes, but the current
 * time is external state, not something derived from props — reading it
 * during render is impure, and an effect that immediately calls setState
 * is the same bug wearing a disguise. `useSyncExternalStore` is the right
 * shape for it, and as a bonus every panel and badge on the page shares
 * one timer instead of starting its own.
 *
 * The snapshot is bucketed to 30 seconds so it is stable between renders;
 * returning a fresh `Date.now()` on every call would make React loop.
 * ------------------------------------------------------------------ */

const TICK_MS = 30_000;
const tickListeners = new Set<() => void>();
let tickTimer: ReturnType<typeof setInterval> | null = null;

function subscribeTick(listener: () => void): () => void {
  tickListeners.add(listener);
  tickTimer ??= setInterval(() => {
    for (const l of tickListeners) l();
  }, TICK_MS);

  return () => {
    tickListeners.delete(listener);
    if (tickListeners.size === 0 && tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  };
}

const getTick = () => Math.floor(Date.now() / TICK_MS);
/** 0 marks "no clock yet", so the server never renders a relative time. */
const getServerTick = () => 0;

/** Current time to 30s resolution, or null before hydration. */
export function useClockMs(): number | null {
  const tick = useSyncExternalStore(subscribeTick, getTick, getServerTick);
  return tick === 0 ? null : tick * TICK_MS;
}
