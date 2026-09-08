import 'server-only';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { env, features } from '@/lib/env';
import type { Database } from '@/db/database.types';

/**
 * Request-scoped Supabase client for Server Components and route handlers.
 * Uses the anon key, so RLS still applies — the user's own policies decide
 * what they can see.
 */
export async function getSupabaseServerClient() {
  if (!features.supabase) return null;

  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Session refresh is handled by middleware instead.
          }
        },
      },
    }
  );
}

/**
 * Cookieless anon client for PUBLIC data.
 *
 * The catalogue (mandals, areas, categories, festival config) is world-
 * readable under RLS and identical for every visitor, so binding it to a
 * session is wrong on three counts:
 *
 *  1. `generateStaticParams` runs at build time with no HTTP request, so
 *     `cookies()` throws there — which is exactly how this was found.
 *  2. Reading cookies opts the route out of static rendering.
 *  3. It implies a per-user result where none exists.
 *
 * Session-scoped reads (profiles, favourites, plans, admin) must keep using
 * `getSupabaseServerClient()`.
 */
let publicClient: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabasePublicClient() {
  if (!features.supabase) return null;
  publicClient ??= createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  return publicClient;
}
