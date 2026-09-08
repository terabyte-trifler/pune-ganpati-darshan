/**
 * Builds the auth cookies @supabase/ssr expects, using the library's own
 * chunking rather than reimplementing its encoding.
 *
 * Hand-rolling this produced cookies the server silently ignored — the page
 * simply rendered signed-out with no error, which is a slow thing to debug.
 * Using createChunks means the format cannot drift from the library.
 */
import { createChunks } from '@supabase/ssr';

export function sessionCookies(session, projectRef, baseUrl) {
  const key = `sb-${projectRef}-auth-token`;
  // Matches how @supabase/ssr stores a session client-side.
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  const { hostname } = new URL(baseUrl);

  return createChunks(key, value).map((chunk) => ({
    name: chunk.name,
    value: chunk.value,
    domain: hostname,
    path: '/',
    httpOnly: false,
    sameSite: 'Lax',
  }));
}
