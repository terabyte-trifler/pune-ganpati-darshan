import 'server-only';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
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
