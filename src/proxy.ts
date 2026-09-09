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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without Supabase there are no sessions and no admin area to protect.
  if (!url || !key) {
    if (request.nextUrl.pathname.startsWith('/admin')) {
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

  if (request.nextUrl.pathname.startsWith('/admin')) {
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
     */
    '/((?!_next/|favicon.ico|icons/|sw.js|manifest.webmanifest|.*\\.png$).*)',
  ],
};
