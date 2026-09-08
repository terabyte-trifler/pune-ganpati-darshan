'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalCollection, FAVORITES_KEY } from '@/hooks/useLocalCollection';
import { useSession } from '@/hooks/useSession';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Favourites, device-local by default and synced across devices once signed in.
 *
 * localStorage stays the source of truth for reads. That is deliberate:
 * saving a mandal must work instantly, offline, and without an account —
 * a visitor standing in a crowded lane on patchy 4G should never wait on a
 * network round-trip to tap a heart.
 *
 * Signing in merges rather than replaces. Someone who saved mandals before
 * creating an account keeps them, and someone signing in on a second device
 * gets the union rather than whichever side happened to write last. Deletions
 * are propagated explicitly, so a merge cannot resurrect something removed.
 */
export function useFavorites() {
  const local = useLocalCollection(FAVORITES_KEY);
  const { user, loading } = useSession();
  const supabase = getSupabaseBrowserClient();
  const [syncing, setSyncing] = useState(false);
  const mergedFor = useRef<string | null>(null);

  const slugToId = useRef<Map<string, string>>(new Map());

  /* ---------------- Merge on sign-in ---------------- */
  useEffect(() => {
    if (!supabase || loading || !user) return;
    // Merge once per session, not on every render or focus change.
    if (mergedFor.current === user.id) return;
    mergedFor.current = user.id;

    let cancelled = false;
    (async () => {
      setSyncing(true);
      try {
        const { data: rows, error } = await supabase
          .from('favorites')
          .select('ganpati_id, ganpatis!inner(slug)');
        if (error || cancelled) return;

        /* eslint-disable @typescript-eslint/no-explicit-any */
        const remote = new Set<string>();
        for (const row of (rows ?? []) as any[]) {
          const g = Array.isArray(row.ganpatis) ? row.ganpatis[0] : row.ganpatis;
          if (g?.slug) {
            remote.add(g.slug);
            slugToId.current.set(g.slug, row.ganpati_id);
          }
        }
        /* eslint-enable @typescript-eslint/no-explicit-any */

        const localOnly = local.items.filter((slug) => !remote.has(slug));

        // Push what only this device had.
        if (localOnly.length > 0) {
          const { data: ganpatis } = await supabase
            .from('ganpatis').select('id, slug').in('slug', localOnly);
          const rowsToInsert = (ganpatis ?? []).map((g) => {
            slugToId.current.set(g.slug, g.id);
            return { user_id: user.id, ganpati_id: g.id };
          });
          if (rowsToInsert.length > 0) {
            await supabase.from('favorites').upsert(rowsToInsert, {
              onConflict: 'user_id,ganpati_id', ignoreDuplicates: true,
            });
          }
        }

        // Adopt the union locally.
        const union = [...new Set([...local.items, ...remote])];
        if (!cancelled && union.length !== local.items.length) local.replace(union);
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();

    return () => { cancelled = true; };
    // `local` is a stable store wrapper; including it would re-run the merge
    // on every favourite change, which is the opposite of "merge once".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, user, loading]);

  /* ---------------- Writes ---------------- */
  const persist = useCallback(
    async (slug: string, saved: boolean) => {
      if (!supabase || !user) return;
      try {
        let id = slugToId.current.get(slug);
        if (!id) {
          const { data } = await supabase
            .from('ganpatis').select('id').eq('slug', slug).maybeSingle();
          if (!data) return;
          id = data.id;
          slugToId.current.set(slug, id);
        }
        if (saved) {
          await supabase.from('favorites').upsert(
            { user_id: user.id, ganpati_id: id },
            { onConflict: 'user_id,ganpati_id', ignoreDuplicates: true }
          );
        } else {
          await supabase.from('favorites')
            .delete().eq('user_id', user.id).eq('ganpati_id', id);
        }
      } catch {
        // The local write already succeeded; a failed sync must never make
        // the button appear not to work.
      }
    },
    [supabase, user]
  );

  const toggle = useCallback(
    (slug: string) => {
      const saved = local.toggle(slug);
      void persist(slug, saved);
      return saved;
    },
    [local, persist]
  );

  return {
    ...local,
    toggle,
    /** True while the initial merge is in flight. */
    syncing,
    /** True when favourites are being kept on the account, not just here. */
    synced: Boolean(user),
  };
}
