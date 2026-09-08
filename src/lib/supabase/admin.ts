import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { serverEnv } from '@/lib/env.server';
import type { Database } from '@/db/database.types';

/**
 * Service-role client. BYPASSES RLS.
 *
 * `server-only` makes importing this from a Client Component a build
 * error, so the key cannot reach the browser even by mistake. Use it only
 * where a request has already been authorised (admin server actions,
 * server-side plan creation for anonymous users).
 */
export function getSupabaseAdminClient() {
  const { SUPABASE_SERVICE_ROLE_KEY } = serverEnv();

  if (!SUPABASE_SERVICE_ROLE_KEY || !env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error(
      'Admin client unavailable: SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL are required'
    );
  }

  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
