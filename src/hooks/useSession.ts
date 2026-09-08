'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * The signed-in user, or null.
 *
 * Returns `loading` separately from `null` so callers can avoid flashing the
 * signed-out state at someone who is in fact signed in — the session is read
 * from a cookie asynchronously, so the first render cannot know yet.
 */
export interface SessionState {
  user: User | null;
  loading: boolean;
}

export function useSession(): SessionState {
  const supabase = getSupabaseBrowserClient();
  const [state, setState] = useState<SessionState>({
    user: null,
    // With Supabase unconfigured there is never a session; do not sit in a
    // loading state that will never resolve.
    loading: Boolean(supabase),
  });

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (active) setState({ user: data.user ?? null, loading: false });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState({ user: session?.user ?? null, loading: false });
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  return state;
}
