'use client';

import { useState } from 'react';
import { Info, X } from 'lucide-react';
import { MapLegend } from './MapLegend';

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
 * The contents live in MapLegend, shared with the always-visible key under
 * the embedded map on /parking. This file is only the sheet around them.
 */

export function MapKey() {
  const [open, setOpen] = useState(false);

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
      className="absolute inset-x-3 z-40 max-h-[52dvh] overflow-y-auto rounded-[var(--radius-card)] border border-[var(--line-strong)] bg-[var(--raat)]/96 p-4 shadow-[var(--shadow-float)] backdrop-blur-xl"
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

      <div className="mt-3">
        <MapLegend />
      </div>
    </div>
  );
}
