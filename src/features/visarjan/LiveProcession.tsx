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
 * It renders NOTHING unless the police positions are current. Freshness
 * is the gate, not names: on visarjan morning the feed never filled a
 * single name in, and at 10:15 — the procession an hour under way — its
 * newest row was stamped 04:44. Names missing is their data entry;
 * positions hours old would have put the miravnuk behind itself, and
 * that is the one thing this panel must never do.
 *
 * So an unnamed vehicle that is genuinely moving still counts, and a
 * named one that stopped reporting before dawn does not.
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
  finished: 'Completed',
};

/**
 * The police tracker's own three colours: green completed, bhagwa on
 * the move, red yet to start.
 *
 * Matched rather than chosen. People read their tracker and this list
 * side by side on the day, and two colour schemes for the same fifteen
 * mandals is a translation nobody should have to do standing on Laxmi
 * Road.
 */
const DOT: Record<ProcessionStatus, string> = {
  moving: '#FF9933',
  finished: '#5FB872',
  waiting: '#E5544B',
};

const TEXT: Record<ProcessionStatus, string> = {
  moving: 'text-[#FF9933]',
  finished: 'text-[#5FB872]',
  waiting: 'text-[#E5544B]',
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
        {(['moving', 'finished', 'waiting'] as const)
          .filter((s) => snap.counts[s] > 0)
          .map((s, i) => (
            <span key={s}>
              {i > 0 && <span className="text-[var(--faint)]"> · </span>}
              <span className={`font-semibold ${TEXT[s]}`}>
                {snap.counts[s]} {LABEL[s].toLowerCase()}
              </span>
            </span>
          ))}
      </p>

      <ul className="mt-3 space-y-1.5">
        {snap.mandals.map((m) => (
          <li key={`${m.name}-${m.lat}`} className="flex items-baseline gap-2.5">
            <span
              aria-hidden="true"
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: DOT[m.status] }}
            />
            <span className="min-w-0">
              <span lang="mr" className="text-[14px] font-semibold text-[var(--chandan)]">
                {m.name}
              </span>
              <span className={`ml-1.5 text-[12px] font-semibold ${TEXT[m.status]}`}>
                {LABEL[m.status]}
              </span>
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
        Pune City Police, read live and cached for under a minute, and
        shown only while their positions are current — a reading from
        hours ago would put the procession behind itself. Their tracker
        is the original and carries the map.
      </p>
    </section>
  );
}
