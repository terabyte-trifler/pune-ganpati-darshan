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
  matcher: [
    /*
     * Everything except Next's own internals and static assets.
     *
     * This excluded `_next/static` and `_next/image` but not `_next/hmr`,
     * so in development every hot-reload WebSocket upgrade was routed
     * through this middleware, which answered with an ordinary HTTP
     * response. The handshake failed with ERR_INVALID_HTTP_RESPONSE, the
     * dev client never connected, and the page never hydrated — the app
     * rendered correctly and then did nothing at all when tapped, with no
     * error to explain why. Production was unaffected, which is what made
     * it look like a data problem rather than a routing one.
     *
     * Nothing under `_next/` needs a session refresh, so the whole prefix
     * is excluded rather than enumerating the parts.
     *
     * `api/crowd` is excluded for the same reason and a louder one: it is
     * the endpoint every open tab polls, nothing under it reads a session
     * — every write there is authorised by device id and database rules,
     * not by a user — and running this on it meant an invocation per poll
     * for a cookie that was never going to be there. /api/plans is the one
     * API route that does need a user, and it is still matched.
     */
    '/((?!_next/|api/crowd|favicon.ico|icons/|sw.js|manifest.webmanifest|.*\\.png$).*)',
  ],
};
