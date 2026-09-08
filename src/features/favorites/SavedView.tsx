'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import { useFavorites } from '@/hooks/useFavorites';
import { GanpatiCard } from '@/features/discovery/GanpatiCard';
import { GanpatiCardSkeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import type { Ganpati } from '@/types/ganpati';

/**
 * Saved mandals.
 *
 * Reads localStorage, so it works with no account and with no network.
 * The skeleton covers the first paint before hydration rather than
 * flashing the empty state at someone who does have saved mandals.
 */
export function SavedView({ ganpatis }: { ganpatis: Ganpati[] }) {
  const { items, hydrated, synced, syncing } = useFavorites();

  if (!hydrated) {
    return (
      <ul className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i}><GanpatiCardSkeleton /></li>
        ))}
      </ul>
    );
  }

  const bySlug = new Map(ganpatis.map((g) => [g.slug, g]));
  const saved = items.map((s) => bySlug.get(s)).filter((g): g is Ganpati => Boolean(g));

  if (saved.length === 0) {
    return (
      <div
        className="mx-4 surface rounded-[var(--radius-card)] border border-[var(--line)] px-4 py-10 text-center"
        data-sync-state={syncing ? 'syncing' : synced ? 'account' : 'device'}
      >
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-[var(--line-strong)]">
          <Heart size={20} aria-hidden="true" className="text-[var(--muted)]" />
        </div>
        <p className="mt-3 text-[15px] font-semibold text-[var(--chandan)]">
          Nothing saved yet
        </p>
        <p className="mx-auto mt-1.5 max-w-xs text-[13px] leading-relaxed text-[var(--muted)]">
          Tap the heart on any mandal to keep it here.{' '}
          {synced
            ? 'They are kept on your account, so they follow you to other devices.'
            : 'Saved mandals stay on this device and work offline.'}
        </p>
        <Button asChild size="sm" className="mt-4">
          <Link href="/explore">Browse mandals</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <p
        className="mb-3 px-4 text-[13px] text-[var(--faint)]"
        data-sync-state={syncing ? 'syncing' : synced ? 'account' : 'device'}
      >
        {saved.length} saved ·{' '}
        {syncing
          ? 'syncing…'
          : synced
            ? 'kept on your account'
            : 'on this device'}
      </p>
      <ul className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 lg:grid-cols-4">
        {saved.map((g) => (
          <li key={g.id}><GanpatiCard ganpati={g} className="h-full" /></li>
        ))}
      </ul>
    </>
  );
}
