'use client';

import { useSyncExternalStore } from 'react';
import type { LatLng } from '@/lib/geo';

/**
 * Geolocation, requested only when the user asks for it.
 *
 * Deliberately NOT a `useEffect` that fires on mount: a permission prompt
 * on page load is hostile, and the brief forbids it (§14). The position is
 * fetched once per explicit request rather than watched, which also avoids
 * draining the battery of someone walking around Pune all evening (§46).
 *
 * The fix is held in ONE module-level store rather than in each caller's
 * state. Two components that each owned a copy would each show their own
 * "locate me" button, fire their own permission prompt, and then disagree
 * about where the user is — and the home page now has two consumers (the
 * nearby rail and the report prompt) that must agree, because one of them
 * names a mandal the user is supposedly standing at.
 */

export type GeoState =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'ready'; position: LatLng; accuracyM: number }
  | { status: 'denied' }
  | { status: 'unavailable' };

const IDLE: GeoState = { status: 'idle' };

let state: GeoState = IDLE;
const listeners = new Set<() => void>();

function setState(next: GeoState) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;
/** Stable across renders, so SSR and hydration cannot disagree. */
const getServerSnapshot = () => IDLE;

export function requestLocation() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    setState({ status: 'unavailable' });
    return;
  }

  // A second tap while the first fix is in flight would stack callbacks and
  // re-prompt on some browsers.
  if (state.status === 'locating') return;

  setState({ status: 'locating' });
  navigator.geolocation.getCurrentPosition(
    (pos) =>
      setState({
        status: 'ready',
        position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        accuracyM: pos.coords.accuracy,
      }),
    (error) =>
      setState(
        error.code === error.PERMISSION_DENIED
          ? { status: 'denied' }
          : { status: 'unavailable' }
      ),
    {
      enableHighAccuracy: true,
      // A stale-but-recent fix is fine and much faster outdoors.
      maximumAge: 60_000,
      timeout: 10_000,
    }
  );
}

export function useGeolocation() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { state: current, request: requestLocation };
}

export function resetGeolocationForTesting() {
  state = IDLE;
  listeners.clear();
}
