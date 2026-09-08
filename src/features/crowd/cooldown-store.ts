'use client';

import { getDeviceId } from './device';

/**
 * What this device has already reported, and until when.
 *
 * Shared, like the crowd store, for the same reason: the mandal page, the
 * map card and any future surface must agree about whether you can report
 * right now. Two components each fetching their own copy would disagree
 * for up to a poll interval and show one enabled button and one disabled.
 *
 * Held as absolute expiry timestamps rather than a counting-down number of
 * seconds. A countdown has to be driven by a timer that keeps ticking
 * while the tab is backgrounded — which it does not — so a phone that
 * sleeps for ten minutes wakes up believing it still has ten minutes left.
 * An expiry is simply compared against the clock and is right whatever the
 * device was doing in between.
 *
 * This is advisory only. The server re-checks on every submission, so a
 * wrong or tampered value here changes nothing except the wording someone
 * sees before they tap (§11, §31).
 */

const ENDPOINT = '/api/crowd/cooldowns';

/** mandalId → epoch ms at which reporting becomes available again. */
export type CooldownState = Readonly<Record<string, number>>;

let state: CooldownState = {};
let loaded = false;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function setState(next: CooldownState) {
  state = next;
  emit();
}

/**
 * Load once per page. Cooldowns change only when this device reports, and
 * that path updates the store directly, so there is nothing to poll for.
 */
async function load(): Promise<void> {
  if (inFlight) return inFlight;

  const deviceId = getDeviceId();
  if (!deviceId) return;

  inFlight = (async () => {
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
        cache: 'no-store',
      });

      if (!response.ok) return;

      const { cooldowns } = (await response.json()) as {
        cooldowns: Record<string, number>;
      };

      const now = Date.now();
      const next: Record<string, number> = {};
      for (const [mandalId, seconds] of Object.entries(cooldowns)) {
        if (seconds > 0) next[mandalId] = now + seconds * 1000;
      }
      setState(next);
    } catch {
      // Offline, or the endpoint is unavailable. Leaving this empty means
      // the buttons stay enabled and the server does the refusing — which
      // is the correct fallback, since the server is the authority anyway.
    } finally {
      loaded = true;
      inFlight = null;
    }
  })();

  return inFlight;
}

export function subscribeToCooldowns(listener: () => void): () => void {
  listeners.add(listener);
  if (!loaded) void load();
  return () => listeners.delete(listener);
}

export function getCooldownState(): CooldownState {
  return state;
}

/** Stable empty state for SSR, so hydration cannot mismatch. */
const EMPTY: CooldownState = {};
export function getServerCooldownState(): CooldownState {
  return EMPTY;
}

/**
 * Record a cooldown, from a successful report or from a server refusal.
 * Both tell us the same thing: this device cannot report this mandal yet.
 */
export function noteCooldown(mandalId: string, retryAfterSeconds: number) {
  setState({ ...state, [mandalId]: Date.now() + retryAfterSeconds * 1000 });
}

export function resetCooldownStoreForTesting() {
  state = {};
  loaded = false;
  inFlight = null;
  listeners.clear();
}
