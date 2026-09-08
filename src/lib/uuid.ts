/**
 * One definition of "is this a UUID", used by the browser and the server.
 *
 * These were separate: the client accepted any hex-shaped string with the
 * right dashes, the server used zod's stricter RFC-4122 check. A device id
 * that passed one and failed the other was stored permanently in
 * localStorage and rejected on every submission — so reporting was broken
 * forever on that device, with a message that said "try again shortly",
 * which would never have helped.
 *
 * Not `server-only`: this is deliberately shared, and the whole point is
 * that both sides evaluate the same rule.
 */

/**
 * RFC 4122 / 9562: version nibble 1-8, variant nibble 8/9/a/b.
 *
 * `crypto.randomUUID()` always satisfies this. Written out rather than
 * delegating to zod's `.uuid()` so the client can apply exactly the same
 * test without importing a validation library into the browser bundle.
 */
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * A v4 UUID, without assuming `crypto.randomUUID` exists.
 *
 * It is undefined in insecure contexts — plain http, which includes some
 * corporate proxies and any local testing that is not on localhost — so
 * the fallback must not call it again, which an earlier version did from
 * inside its own catch block.
 */
export function uuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    // Only reachable with no Web Crypto at all. This id is a
    // de-duplication key, never a secret, so a weaker source costs
    // nothing that matters here.
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
