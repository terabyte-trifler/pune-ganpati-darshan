import 'server-only';

import { getSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Server-side auth helpers.
 *
 * Authorization is decided here and in RLS — never by hiding UI (§27).
 * `isAdmin` reads the `profiles.is_admin` column, which users cannot
 * self-assign (enforced by the `profiles_no_self_admin` trigger).
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

  return {
    id: user.id,
    email: user.email ?? null,
    displayName: profile?.display_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    isAdmin: profile?.is_admin ?? false,
  };
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user?.isAdmin) {
    throw new Error('FORBIDDEN');
  }
  return user;
}
