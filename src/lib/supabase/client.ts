'use client';

import { createBrowserClient } from '@supabase/ssr';
import { env, features } from '@/lib/env';
import type { Database } from '@/db/database.types';

/**
 * Browser Supabase client (anon key, RLS enforced).
 * Returns null when Supabase is not configured so the app can run in
 * catalogue-only mode rather than crashing (§35, §36).
 */
let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getSupabaseBrowserClient() {
  if (!features.supabase) return null;
  if (!cached) {
    cached = createBrowserClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL!,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return cached;
}
