'use client';

/**
 * Anonymous device identity.
 *
 * A random UUID in localStorage. No account, no email, no fingerprinting —
 * reporting a queue should not cost anyone their privacy, and the feature
 * is worth more with a low barrier than with verified identities.
 *
 * This is explicitly NOT a security boundary. Anyone can clear storage or
 * mint a new id, so it earns exactly one thing: honest clients are
 * de-duplicated. Actual abuse resistance comes from the layers behind it
 * — the shared IP throttle, the per-device cap and the atomic cooldown —
 * none of which trust this value (§7).
 */

const STORAGE_KEY = 'ganpatigo_device_id';

/** Cached so repeated reads do not touch storage on every render. */
let cached: string | null = null;

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * A v4 UUID, without assuming `crypto.randomUUID` exists.
 *
 * It is undefined in insecure contexts — plain http, which includes some
 * corporate proxies and any local testing that is not on localhost — and
 * the earlier version of this file called it inside its own catch block,
 * so the fallback threw the same error it was meant to absorb and the
 * whole panel went down with it.
 *
 * The server validates strictly against RFC 4122, so the version and
 * variant nibbles have to be set correctly here rather than just
 * producing 32 random hex characters.
 */
function uuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    // Last resort. Only reachable on a browser with no Web Crypto at all;
    // this id is a de-duplication key, never a secret, so a weaker source
    // costs nothing that matters here.
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getDeviceId(): string | null {
  if (typeof window === 'undefined') return null;
  if (cached) return cached;

  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    // Re-mint anything malformed: a hand-edited value would be rejected by
    // the server's UUID check, and the user would see failures with no
    // explanation.
    if (existing && isUuid(existing)) {
      cached = existing;
      return cached;
    }

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

export function resetDeviceIdForTesting() {
  cached = null;
}

/** Idempotency key for one submission attempt. */
export function newRequestId(): string {
  return uuidV4();
}
