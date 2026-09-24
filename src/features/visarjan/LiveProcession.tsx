'use client';

import { useEffect, useState } from 'react';
import { Radio } from 'lucide-react';
import type { TrackingSnapshot, ProcessionStatus } from '@/services/visarjan-tracking';

/**
 * Which mandals are moving, waiting, and done.
 *
 * ---------------------------------------------------------------------
 * The one thing this page could not answer.
 *
 * Everything else here is a plan: the notice's hours, the mandal's own
 * checkpoints, the corridor. None of it knows whether Tulshibaug has
 * actually set off. The police track it, and this reads their feed
 * through our own proxy so a reader gets the answer without leaving.
 *
 * It renders NOTHING until the feed is usable. Before the day starts the
 * tracker carries forty-two devices with placeholder names, so the
 * service drops them and answers `ready: false`, and this returns null —
 * the page keeps the tracker link it has always had and looks exactly as
 * it did. A section that appears empty, or full of dots called ".",
 * would be worse than no section.
 *
 * Positions are deliberately not drawn on the map. The feed gives a
 * point per tracking device and the devices sit with the mandals, so at
 * the map's zoom they would pile onto the corridor as a smear of marks
 * a reader cannot separate — and it would compete with the checkpoints,
 * which answer "when does it reach my corner" rather better.
 */

const POLL_MS = 60_000;

const LABEL: Record<ProcessionStatus, string> = {
  moving: 'On the move',
  waiting: 'Yet to start',
  finished: 'Finished',
};

const DOT: Record<ProcessionStatus, string> = {
  moving: 'var(--zendu)',
  waiting: 'var(--faint)',
  finished: 'var(--pital)',
};

export function LiveProcession({ active }: { active: boolean }) {
  const [snap, setSnap] = useState<TrackingSnapshot | null>(null);

  useEffect(() => {
    if (!active) return;
    let alive = true;

    const load = async () => {
      try {
        const res = await fetch('/api/visarjan-tracking');
        if (!res.ok) return;
        const data = (await res.json()) as TrackingSnapshot;
        if (alive) setSnap(data);
      } catch {
        // Keep whatever we last had; the link below still works.
      }
    };

    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [active]);

  if (!snap?.ready || snap.mandals.length === 0) return null;

  return (
    <section
      aria-label="Live procession status"
      className="mt-4 rounded-[var(--radius-card)] border border-[var(--zendu)]/40 bg-gradient-to-b from-[var(--zendu)]/[0.10] to-transparent p-4"
    >
      <h2 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.09em] text-[var(--zendu)]">
        <Radio className="h-3.5 w-3.5" aria-hidden="true" />
        Live from the police tracker
      </h2>

      <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--muted)]">
        {(['moving', 'waiting', 'finished'] as const)
          .filter((s) => snap.counts[s] > 0)
          .map((s) => `${snap.counts[s]} ${LABEL[s].toLowerCase()}`)
          .join(' · ')}
      </p>

      {snap.stale && (
        <p className="mt-2 text-[12px] leading-relaxed text-[var(--shendur)]">
          The feed has not moved in a while — treat these as last known
          rather than current.
        </p>
      )}

      <ul className="mt-3 space-y-1.5">
        {snap.mandals.map((m) => (
          <li key={`${m.name}-${m.lat}`} className="flex items-baseline gap-2.5">
            <span
              aria-hidden="true"
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: DOT[m.status] }}
            />
            <span className="min-w-0">
              <span className="text-[14px] font-semibold text-[var(--chandan)]">{m.name}</span>
              <span className="ml-1.5 text-[12px] text-[var(--faint)]">{LABEL[m.status]}</span>
              {m.address && (
                <span className="block text-[12.5px] leading-relaxed text-[var(--muted)]">
                  {m.address}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11.5px] leading-relaxed text-[var(--faint)]">
        Pune City Police, read live and cached for under a minute. Their
        tracker is the original and carries the map.
      </p>
    </section>
  );
}
