import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Refreshes the Supabase auth cookie so Server Components see a valid
 * session, and gates /admin at the edge.
 *
 * The edge check is a fast rejection, not the security boundary: the
 * boundary is `requireAdmin()` plus RLS. Both must hold.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const isAdminPath = request.nextUrl.pathname.startsWith('/admin');

  /**
   * An anonymous visitor has no session to refresh, so do not go and ask.
   *
   * `supabase.auth.getUser()` is a NETWORK CALL to Supabase Auth, and it
   * was made on every request this matcher accepts — which is every page
   * view and every API call, for the whole festival, overwhelmingly by
   * people who have never signed in and never will. The first Pro invoice
   * priced it: 973K function invocations, six hours of Fluid CPU and 2 GB
   * of origin transfer in a day and a half, most of it this line asking
   * Supabase to identify a user who does not exist.
   *
   * Someone signed in carries an `sb-…-auth-token` cookie, so the refresh
   * still happens for the people it exists for. Someone who does not
   * carry one has nothing that could be refreshed, and skipping is a
   * no-op rather than an optimisation with a cost.
   *
   * /admin is exempt and always does the full check: it must reach the
   * redirect below even — especially — when there is no cookie at all.
   * The security boundary is unchanged, and it was never here anyway
   * (see the note above: requireAdmin() plus RLS).
   */
  const hasSession = request.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'));
  if (!isAdminPath && !hasSession) return response;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without Supabase there are no sessions and no admin area to protect.
  if (!url || !key) {
    if (isAdminPath) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (isAdminPath) {
    if (!user) {
      const signIn = new URL('/signin', request.url);
      signIn.searchParams.set('next', request.nextUrl.pathname);
      return NextResponse.redirect(signIn);
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.is_admin) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return response;
}

export const config = {
  /*
   * An ALLOWLIST, not a denylist — and that inversion is the point.
   *
   * This matched everything except _next, favicon, icons, the service
   * worker, the manifest, .png and api/crowd. Which is to say: every
   * page, every other API route, every request a visitor makes. The
   * proxy exists to refresh a Supabase session and gate /admin, and it
   * was running on all of it.
   *
   * On 18 September the invoice showed 4.01M edge requests producing
   * 2.51M function invocations — 63% of requests reaching a function on
   * a site whose public pages are all statically rendered and cached.
   * Middleware that matches everything is the obvious candidate for the
   * gap, and Fluid Active CPU plus Function Invocations are $3.65 of an
   * $8.06 bill, both metered.
   *
   * What makes an allowlist safe here is that sign-in is allowlisted in
   * the DATABASE: a trigger on auth.users means only the owner's account
   * can ever exist (see 20260910160000_signin_allowlist.sql). Every
   * visitor is anonymous, favourites are per-device, and browsing, the
   * map, routes and crowd reporting need no account by design.
   *
   * So the set of paths where a session can matter is small and known.
   * Verified by grep before writing this: the only server-side readers of
   * a session are /admin/**, /api/admin/*, /api/plans, /signin and the
   * auth callback. No public page reads it. Adding a page that does means
   * adding it here — hence the test that pins this list against the
   * pages that actually call getSessionUser or requireAdmin.
   */
  matcher: [
    '/admin',
    '/admin/:path*',
    '/api/admin/:path*',
    '/api/plans',
    '/api/plans/:path*',
    '/auth/:path*',
    '/signin',
  ],
};
