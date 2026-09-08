'use client';

import { isUuid, uuidV4 } from '@/lib/uuid';

/**
 * Anonymous device identity.
 *
 * A random UUID in localStorage. No account, no email, no fingerprinting —
 * reporting a queue should not cost anyone their privacy, and the feature
 * is worth more with a low barrier than with verified identities.
 *
 * Explicitly NOT a security boundary. Anyone can clear storage or mint a
 * new one, so it earns exactly one thing: honest clients are de-duplicated.
 * Abuse resistance comes from the layers behind it — the shared IP
 * throttle, the per-device cap, the atomic cooldown — none of which trust
 * this value (§7).
 *
 * Validation uses the SAME rule as the server (see lib/uuid.ts). When the
 * two disagreed, a stored id could be accepted here and rejected there on
 * every single submission, which broke reporting permanently on that
 * device with no way for the user to discover why.
 */

const STORAGE_KEY = 'ganpatigo_device_id';

/** Cached so repeated reads do not touch storage on every render. */
let cached: string | null = null;

export function getDeviceId(): string | null {
  if (typeof window === 'undefined') return null;
  if (cached) return cached;

  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing && isUuid(existing)) {
      cached = existing;
      return cached;
    }

    // Anything malformed is replaced rather than reused: the server would
    // reject it forever, and the user has no way to clear it themselves.
    const id = uuidV4();
    window.localStorage.setItem(STORAGE_KEY, id);
    cached = id;
    return id;
  } catch {
    // Private mode or blocked storage. Fall back to a per-session id so
    // reporting still works; it just will not survive a reload.
    cached ??= uuidV4();
    return cached;
  }
}

/**
 * Throw away this device's id and mint a new one.
 *
 * Called when the server rejects the id as malformed. Without this, a bad
 * value is a permanent dead end: it is re-read from storage on every
 * attempt and rejected every time. Re-minting means the next tap works.
 */
export function resetDeviceId(): string | null {
  cached = null;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable; clearing the cache above is enough.
  }
  return getDeviceId();
}

/** Idempotency key for one submission attempt. */
export function newRequestId(): string {
  return uuidV4();
}

export function resetDeviceIdForTesting() {
  cached = null;
}
