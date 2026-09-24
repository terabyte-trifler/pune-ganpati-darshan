'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Expand, X } from 'lucide-react';

/**
 * Full screen for the visarjan map.
 *
 * ---------------------------------------------------------------------
 * Why this one map needs it.
 *
 * The map now carries eight kinds of mark — a corridor, a ring road,
 * seven closures, ten checkpoints with times on them, route stops,
 * diversion rings, twelve parking discs and thirty mandals. In a 380px
 * frame on a phone that is legible only by pinching around it, and the
 * labels that matter most, the hours on the checkpoints, do not appear
 * until zoom 13. A reader standing on a corner should not have to fight
 * the page to see which chowk they are near.
 *
 * The map instance is NOT remounted when it opens. The same element
 * moves between a sized box and a fixed overlay, so MapLibre keeps its
 * position, zoom and every layer; its own ResizeObserver refits the
 * canvas. Remounting would drop the reader back at the default frame,
 * which is precisely what they opened this to get away from.
 */

export function MapFullscreen({
  children,
  className,
}: {
  children: ReactNode;
  /** Applied when inline. Ignored while full screen. */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    // Escape closes it, like every other overlay on the web.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);

    // The page must not scroll behind a full-screen map: on a phone a
    // drag meant for the map that lands a pixel outside it would
    // otherwise scroll the article underneath.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    closeRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <div
      className={
        open
          ? 'fixed inset-0 z-[60] bg-[var(--raat)]'
          : `relative ${className ?? ''}`
      }
      {...(open ? { role: 'dialog', 'aria-modal': true, 'aria-label': 'Visarjan map, full screen' } : {})}
    >
      {children}

      <button
        ref={closeRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close full screen map' : 'Open the map full screen'}
        className={[
          'absolute z-10 inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-chip)]',
          'border border-[var(--line-strong)] bg-[var(--raat)]/90 px-3 text-[13px]',
          'font-semibold text-[var(--chandan)] backdrop-blur',
          // Clear of the notch and of MapLibre's own zoom controls, which
          // sit top-right.
          open ? 'left-4 top-[calc(var(--safe-top)+12px)]' : 'left-3 top-3',
        ].join(' ')}
      >
        {open ? (
          <>
            <X size={15} aria-hidden="true" />
            Close
          </>
        ) : (
          <>
            <Expand size={15} aria-hidden="true" />
            Full screen
          </>
        )}
      </button>
    </div>
  );
}
