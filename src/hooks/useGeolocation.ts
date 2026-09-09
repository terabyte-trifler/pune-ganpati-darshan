'use client';

import { useEffect, useSyncExternalStore } from 'react';
import type { LatLng } from '@/lib/geo';

/**
 * Geolocation.
 *
 * The position was originally fetched exactly once and never again, to
 * avoid draining the battery of someone walking around Pune all evening
 * (§46). That reasoning was backwards: a person walking around Pune all
 * evening is precisely the one whose position has to keep up. Standing at
 * Tambdi Jogeshwari while the app insists you are at Dagdusheth — because
 * that is where you opened it three hundred metres ago — is worse than any
 * battery saving, and it broke the one feature this app exists for.
 *
 * It still does not use `watchPosition`, which keeps the GPS awake
 * continuously. Instead the position is re-acquired at the two moments it
 * can actually be wrong and seen:
 *
 *   - when the tab becomes visible again, which is the dominant pattern —
 *     phone into pocket, walk, phone out;
 *   - on a slow interval while the app is genuinely on screen.
 *
 * Both stop when the page is hidden or nothing is listening, mirroring how
 * the crowd store paces its own polling.
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
  // The first successful fix is what makes refreshing possible at all, so
  // the timer is (re)evaluated whenever the state changes rather than only
  // when a component subscribes.
  syncRefreshTimer();
}

/* ------------------------------------------------------------------ *
 * Keeping the position current while someone walks.
 * ------------------------------------------------------------------ */

const REFRESH_INTERVAL_MS = 60_000;

/**
 * Below this, a new fix is treated as the same place.
 *
 * Consumer GPS jitters by several metres while stationary. Without this
 * every refresh would publish a new object, re-render every subscriber and
 * re-sort the nearby rail, for movement that never happened. 12m is under
 * the 120m radius that decides "You're here", so it cannot mask a real
 * arrival.
 */
const SIGNIFICANT_MOVE_M = 12;

let refreshTimer: ReturnType<typeof setInterval> | null = null;

function metresBetween(a: LatLng, b: LatLng): number {
  const R = 6371008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Refresh only a position we already hold: this must never raise a prompt. */
function shouldRefresh(): boolean {
  if (typeof document === 'undefined' || typeof navigator === 'undefined') return false;
  if (!navigator.geolocation) return false;
  if (listeners.size === 0) return false;
  if (document.visibilityState === 'hidden') return false;
  return state.status === 'ready';
}

function refreshLocation() {
  if (!shouldRefresh()) return;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const next: LatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      // Publish only real movement, so standing still costs no renders.
      if (
        state.status === 'ready' &&
        metresBetween(state.position, next) < SIGNIFICANT_MOVE_M &&
        Math.abs(state.accuracyM - pos.coords.accuracy) < SIGNIFICANT_MOVE_M
      ) {
        return;
      }
      setState({ status: 'ready', position: next, accuracyM: pos.coords.accuracy });
    },
    () => {
      // A failed refresh keeps the last known fix. Downgrading to 'denied'
      // here would blank the nearby prompt over one bad reading in a lane
      // with no sky.
    },
    {
      enableHighAccuracy: true,
      // MUST be 0. Any other value lets the browser answer from the fix it
      // already holds — which is the stale one we are trying to replace —
      // so the position would never change no matter how far you walked.
      // This was exactly the bug: with a 15s allowance the refresh returned
      // the cached Dagdusheth fix while the device was standing at Kasba.
      maximumAge: 0,
      timeout: 10_000,
    }
  );
}

function syncRefreshTimer() {
  if (shouldRefresh()) {
    refreshTimer ??= setInterval(refreshLocation, REFRESH_INTERVAL_MS);
  } else if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

function onVisibilityChange() {
  syncRefreshTimer();
  // Returning to the app is the moment the held position is most likely to
  // be stale — the walk happened with the screen off.
  if (document.visibilityState === 'visible') refreshLocation();
}

function subscribe(listener: () => void): () => void {
  const first = listeners.size === 0;
  listeners.add(listener);

  if (first && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
    // Some mobile browsers restore a page without firing visibilitychange.
    window.addEventListener('pageshow', onVisibilityChange);
  }
  syncRefreshTimer();

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', onVisibilityChange);
    }
    syncRefreshTimer();
  };
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
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}
