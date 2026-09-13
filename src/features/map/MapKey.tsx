'use client';

import { useState } from 'react';
import { ExternalLink, Info, X } from 'lucide-react';
import { PARKING, PARKING_SOURCE } from '@/content/parking';
import { ROAD_CLOSURES, CLOSURE_JUNCTIONS } from '@/content/diversions';

/**
 * What everything on the map means.
 *
 * The map now carries four kinds of thing from three different sources —
 * mandals and their live queue colours, metro stations, and the Traffic
 * Police's parking and closures — and a symbol nobody can decode is worse
 * than one that is absent. This is the only surface that says which is
 * which, and the only place on the map itself that credits the police and
 * links to their original.
 *
 * Collapsed by default and behind a small button, because the map's job is
 * the pins: a permanent legend would eat the screen someone is trying to
 * read. It opens as a sheet rather than a tooltip so it is legible outdoors
 * at arm's length.
 *
 * The date matters as much as the symbols. Parking and closures are a plan
 * captured on a day, not a live feed, and the panel says so where someone
 * is actually looking at the lines.
 */

const CROWD = [
  { color: 'var(--crowd-short)', label: 'Short queue' },
  { color: 'var(--crowd-moving)', label: 'Moving' },
  { color: 'var(--crowd-long)', label: 'Heavy' },
  { color: 'var(--faint)', label: 'Not reported yet' },
];

export function MapKey() {
  const [open, setOpen] = useState(false);

  const captured = new Date(PARKING_SOURCE.captured).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="What the symbols mean"
        className="absolute right-3 z-20 grid h-11 w-11 place-items-center rounded-full border border-[var(--line-strong)] bg-[var(--raat)]/92 shadow-[var(--shadow-float)] backdrop-blur-xl"
        style={{ bottom: 'calc(50dvh + 68px)' }}
      >
        <Info size={18} aria-hidden="true" className="text-[var(--chandan)]" />
      </button>
    );
  }

  return (
    <div
      className="absolute inset-x-3 z-40 rounded-[var(--radius-card)] border border-[var(--line-strong)] bg-[var(--raat)]/96 p-4 shadow-[var(--shadow-float)] backdrop-blur-xl"
      style={{ bottom: 'calc(50dvh + 12px)' }}
      role="dialog"
      aria-label="Map key"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.09em] text-[var(--faint)]">
          What the map shows
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="-mr-1 -mt-1 grid h-7 w-7 place-items-center rounded-full text-[var(--faint)]"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      {/* ---- Mandals ---- */}
      <p className="mt-3 text-[13px] font-semibold text-[var(--chandan)]">
        Mandals — the pin colour is the queue
      </p>
      <ul className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
        {CROWD.map((c) => (
          <li key={c.label} className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: c.color }}
            />
            {c.label}
          </li>
        ))}
      </ul>

      {/* ---- Metro ---- */}
      <p className="mt-3.5 text-[13px] font-semibold text-[var(--chandan)]">Metro</p>
      <ul className="mt-1.5 flex flex-col gap-1">
        <li className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: '#8C6BB1' }}
          />
          Station you can get off at
        </li>
        <li className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full border-[1.5px]"
            style={{ borderColor: '#8C6BB1' }}
          />
          Hollow — boarding only, marked &ldquo;exit only&rdquo;
        </li>
      </ul>

      {/* ---- Police plan ---- */}
      <p className="mt-3.5 text-[13px] font-semibold text-[var(--chandan)]">
        Traffic Police plan
      </p>
      <ul className="mt-1.5 flex flex-col gap-1">
        <li className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
          <span
            aria-hidden="true"
            className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full text-[8px] font-bold text-[#0E1724]"
            style={{ background: '#6C8AB0' }}
          >
            P
          </span>
          Parking — {PARKING.length} places
        </li>
        <li className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
          <span
            aria-hidden="true"
            className="h-0 w-5 shrink-0 border-t-[2px] border-dashed"
            style={{ borderColor: '#C8BCA8' }}
          />
          Closed after 17:00 — {ROAD_CLOSURES.length} stretches
        </li>
        <li className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full border-[1.5px]"
            style={{ borderColor: '#C8BCA8' }}
          />
          Junction on the closure plan — {CLOSURE_JUNCTIONS.length} of them
        </li>
      </ul>

      <p className="prose-measure mt-3 border-t border-[var(--line)] pt-2.5 text-[11.5px] leading-relaxed text-[var(--faint)]">
        Parking and closures are {PARKING_SOURCE.authority}&rsquo;s own plan,
        captured {captured}. A plan, not a live view — follow the barricades in
        front of you.
      </p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <a
          href={PARKING_SOURCE.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 text-[12.5px] font-semibold text-[var(--shendur)]"
        >
          Open the police map
          <ExternalLink size={12} aria-hidden="true" />
        </a>
        <a
          href="/parking"
          className="inline-flex min-h-11 items-center text-[12.5px] font-semibold text-[var(--shendur)]"
        >
          Parking &amp; closures list
        </a>
      </div>
    </div>
  );
}
