'use client';

import { useEffect, useSyncExternalStore } from 'react';
import type { LatLng } from '@/lib/geo';

/**
 * Geolocation.
 *
 * The position is fetched once per request rather than watched, which
 * avoids draining the battery of someone walking around Pune all evening
 * (§46).
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

/**
 * Ask on open rather than waiting for a tap.
 *
 * `docs/02-architecture.md` used to require an explicit tap and never a
 * request on load (§14). That rule is relaxed here on the product owner's
 * instruction, but NOT by simply calling `getCurrentPosition` on mount —
 * the Permissions API is checked first, because the three cases are not
 * the same thing at all:
 *
 *   granted — the position is fetched immediately and NO dialog appears.
 *             The browser already has the answer. This is the case that
 *             makes "knows where I am the moment I open it" true, and it
 *             is the one that applies to every returning visitor.
 *   denied  — nothing is attempted. The browser would refuse silently and
 *             a retry cannot un-deny it.
 *   prompt  — a first-time visitor. `PROMPT_ON_OPEN` decides.
 *
 * Why that distinction is worth the code: a denied geolocation permission
 * is sticky per origin and the page cannot clear it. Someone who dismisses
 * a dialog they were shown before they understood why loses the nearby
 * rail, distance sorting and the report prompt permanently — until they
 * find it in browser settings, which nobody does. Spending the one prompt
 * carelessly is irreversible in a way that waiting for a tap never is.
 */
const PROMPT_ON_OPEN = true;

async function autoLocate() {
  if (typeof navigator === 'undefined') return;
  // Anything other than a cold start means a tap, or a fix, already
  // happened; re-entering here would re-request on every mount.
  if (state.status !== 'idle') return;

  // Safari shipped Permissions API support for geolocation late, and some
  // embedded webviews still lack it. Without it there is no way to tell
  // "already granted" from "never asked", so fall back to the configured
  // behaviour rather than guessing.
  const permissions = navigator.permissions;
  if (!permissions?.query) {
    if (PROMPT_ON_OPEN) requestLocation();
    return;
  }

  try {
    const result = await permissions.query({ name: 'geolocation' as PermissionName });
    if (result.state === 'granted') {
      requestLocation();
      return;
    }
    if (result.state === 'denied') {
      setState({ status: 'denied' });
      return;
    }
    if (PROMPT_ON_OPEN) requestLocation();
  } catch {
    if (PROMPT_ON_OPEN) requestLocation();
  }
}

/**
 * Acquire position on mount. Mounted once, on the home page — the app's
 * start_url. Running it on every route would fire a dialog at someone who
 * followed a shared link straight to one mandal, which is the same mistake
 * in a worse place.
 */
export function useAutoLocate() {
  useEffect(() => {
    void autoLocate();
  }, []);
}

export function useGeolocation() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { state: current, request: requestLocation };
}

export function resetGeolocationForTesting() {
  state = IDLE;
  listeners.clear();
}
