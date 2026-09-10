import 'server-only';

import { getSupabaseServerClient } from '@/lib/supabase/server';
import { resolveIsAdmin } from '@/lib/admin-access';

/**
 * Server-side auth helpers.
 *
 * Authorization is decided here and in RLS — never by hiding UI (§27).
 *
 * Admin requires TWO independent things to be true:
 *
 *   1. `profiles.is_admin`, which users cannot self-assign (enforced by
 *      the `profiles_no_self_admin` trigger), and
 *   2. the account's email appearing in `ADMIN_EMAILS`, an environment
 *      variable that lives in the hosting platform rather than the
 *      database.
 *
 * Two gates because they fail independently. A database compromise that
 * flips `is_admin` still grants nothing without also changing a Vercel
 * environment variable, and someone who can edit environment variables
 * still needs a row in a table they cannot write to.
 *
 * The decision itself lives in `lib/admin-access.ts` so it can be tested
 * without this file's server-only Supabase imports.
 */

export interface SessionUser {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  // getUser() revalidates the JWT with the auth server. getSession() reads
  // an unverified cookie and must not be trusted for authorization.
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url, is_admin')
    .eq('id', user.id)
    .maybeSingle();

  const email = user.email ?? null;

  return {
    id: user.id,
    email,
    displayName: profile?.display_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    // Resolved once, here, so every caller — pages, server actions,
    // requireAdmin — agrees. A second place computing this is a second
    // place to get it wrong.
    isAdmin: resolveIsAdmin(email, profile?.is_admin ?? false),
  };
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user?.isAdmin) {
    throw new Error('FORBIDDEN');
  }
  return user;
}
