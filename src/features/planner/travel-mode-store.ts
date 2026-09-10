'use client';

import { useSyncExternalStore } from 'react';
import { toTravelMode } from '@/db/database.types';
import type { TravelMode } from '@/types/ganpati';

/**
 * How you are getting around, remembered.
 *
 * The wizard asked and the planner did not listen. Choosing Metro or
 * Two-wheeler on /start ORDERED the route for that mode, then handed over
 * to a planner that started at Walk — so a route optimised for a scooter
 * was presented as a walk, with the totals recomputed at walking pace. The
 * mode is a property of the darshan, not of one screen, so it lives beside
 * the plan itself.
 *
 * A module store rather than component state for the same reason
 * useLocalCollection is one: two surfaces read this and must agree, and it
 * has to survive the navigation from /start to /plan.
 */

const KEY = 'pg.mode';
const DEFAULT: TravelMode = 'walk';

type Listener = () => void;

let value: TravelMode | null = null;
const listeners = new Set<Listener>();

function load(): TravelMode {
  if (value !== null) return value;
  try {
    const raw = localStorage.getItem(KEY);
    // Through toTravelMode, so a retired value stored by an older build
    // ('drive', 'transit') resolves rather than falling back to walking.
    value = raw ? toTravelMode(raw) : DEFAULT;
  } catch {
    value = DEFAULT;
  }
  return value;
}

export function setTravelMode(next: TravelMode) {
  value = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // Storage unavailable — keep working from memory for this session.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: Listener) {
  load();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Server renders the default so the markup matches the first client paint;
 * the stored value arrives on subscribe, which is one render later and
 * before anything is interactive.
 */
export function useTravelMode(): [TravelMode, (m: TravelMode) => void] {
  const current = useSyncExternalStore(
    subscribe,
    () => load(),
    () => DEFAULT
  );
  return [current, setTravelMode];
}
