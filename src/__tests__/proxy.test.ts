import { describe, it, expect, vi, beforeEach } from 'vitest';

const getUser = vi.fn();
const from = vi.fn();
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser }, from }),
}));

import { proxy, config } from '@/proxy';
import { NextRequest } from 'next/server';

const req = (path: string, cookies: Record<string, string> = {}) => {
  const r = new NextRequest(new URL(`https://ganpatipune.in${path}`));
  for (const [k, v] of Object.entries(cookies)) r.cookies.set(k, v);
  return r;
};
const SESSION = { 'sb-abcdefgh-auth-token': 'x' };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  getUser.mockResolvedValue({ data: { user: null } });
});

/**
 * The proxy ran `supabase.auth.getUser()` — a network call to Supabase —
 * on every page view and every API call, overwhelmingly for visitors who
 * have never signed in. What is tested here is that skipping it for them
 * did not move the admin boundary, because that is the only thing in this
 * file that would be expensive to get wrong.
 */
describe('the proxy asks Supabase only when there is something to ask about', () => {
  it('does not call Supabase for an anonymous page view', async () => {
    await proxy(req('/'));
    expect(getUser).not.toHaveBeenCalled();
  });

  it('does not call Supabase for an anonymous API request', async () => {
    await proxy(req('/api/plans'));
    expect(getUser).not.toHaveBeenCalled();
  });

  it('still refreshes the session for someone signed in', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    await proxy(req('/', SESSION));
    expect(getUser).toHaveBeenCalled();
  });
});

describe('the admin gate is unchanged', () => {
  it('redirects /admin to sign-in when there is no cookie at all', async () => {
    const res = await proxy(req('/admin'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/signin');
    // The skip must NOT apply here: the check has to run to redirect.
    expect(getUser).toHaveBeenCalled();
  });

  it('keeps the attempted path so sign-in can return there', async () => {
    const res = await proxy(req('/admin/crowd'));
    expect(res.headers.get('location')).toContain('next=%2Fadmin%2Fcrowd');
  });

  it('bounces a signed-in NON-admin off /admin', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    from.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { is_admin: false } }) }) }),
    });
    const res = await proxy(req('/admin', SESSION));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://ganpatipune.in/');
  });

  it('lets a signed-in admin through', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    from.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { is_admin: true } }) }) }),
    });
    const res = await proxy(req('/admin', SESSION));
    expect(res.status).toBe(200);
  });
});

describe('the matcher is an allowlist, and covers exactly what needs a session', () => {
  /** Next matcher patterns, as simple prefix tests. */
  const matches = (path: string) =>
    config.matcher.some((pat) => {
      const base = pat.replace('/:path*', '');
      return pat.includes(':path*') ? path === base || path.startsWith(base + '/') : path === pat;
    });

  it('runs on the admin gate', () => {
    expect(matches('/admin')).toBe(true);
    expect(matches('/admin/crowd')).toBe(true);
    expect(matches('/admin/ganpati/abc')).toBe(true);
  });

  it('runs on the routes that read a user', () => {
    expect(matches('/api/plans')).toBe(true);
    expect(matches('/api/admin/crowd-override')).toBe(true);
    expect(matches('/signin')).toBe(true);
    expect(matches('/auth/callback')).toBe(true);
  });

  /**
   * The saving. The proxy used to run on all of these, refreshing a
   * session for visitors who cannot have one — sign-in is allowlisted in
   * the database, so only the owner's account can exist.
   */
  it('does NOT run on anything a visitor touches', () => {
    for (const p of [
      '/', '/map', '/explore', '/routes', '/routes/manache-5-sakal-walk',
      '/ganpati/dagdusheth-halwai-ganpati', '/area/kasba-peth',
      '/category/maanache', '/parking', '/plan', '/saved', '/start',
      '/about', '/guides', '/how-to-use', '/licences',
      '/api/crowd', '/api/crowd/batch', '/api/analytics', '/api/routes',
      '/_next/static/chunk.js', '/favicon.ico', '/sw.js', '/robots.txt',
    ]) {
      expect(matches(p), `${p} should not invoke the proxy`).toBe(false);
    }
  });

  /**
   * The guard that keeps this honest. If a page starts reading a session
   * it must be added to the matcher, and this fails until it is.
   */
  it('covers every page that actually reads a session', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const readers: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir)) {
        const full = join(dir, e);
        if (statSync(full).isDirectory()) { walk(full); continue; }
        if (!/\.(ts|tsx)$/.test(e)) continue;
        const src = readFileSync(full, 'utf8');
        if (/getSessionUser|requireAdmin\(/.test(src)) readers.push(full);
      }
    };
    walk('src/app');
    // Map each file back to its route and assert the matcher covers it.
    for (const f of readers) {
      const route = '/' + f
        .replace(/^src\/app\//, '')
        .replace(/\/(page|route)\.tsx?$/, '')
        .replace(/\/\[[^\]]+\]/g, '/x');
      expect(matches(route === '/' ? '/' : route), `${f} reads a session but ${route} is not matched`).toBe(true);
    }
    expect(readers.length).toBeGreaterThan(0);
  });
});
