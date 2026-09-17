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

describe('the matcher', () => {
  const matches = (path: string) =>
    new RegExp(`^${config.matcher[0]}$`).test(path);

  /** Polled by every open tab, and nothing under it reads a session. */
  it('skips the crowd endpoints entirely', () => {
    expect(matches('/api/crowd')).toBe(false);
    expect(matches('/api/crowd/batch')).toBe(false);
  });

  it('still covers the routes that need a user', () => {
    expect(matches('/api/plans')).toBe(true);
    expect(matches('/admin')).toBe(true);
    expect(matches('/')).toBe(true);
  });

  it('still skips Next internals and static files', () => {
    expect(matches('/_next/static/chunk.js')).toBe(false);
    expect(matches('/favicon.ico')).toBe(false);
  });
});
