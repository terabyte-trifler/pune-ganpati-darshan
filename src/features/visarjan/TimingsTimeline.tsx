'use client';

import { Fragment, useRef } from 'react';
import Link from 'next/link';
import type { TimingRow } from '@/lib/visarjan-timings';
import { useIstMinutes, formatIst } from './useIstClock';

/**
 * The day's published times, in one list, with the clock on it.
 *
 * ---------------------------------------------------------------------
 * Why this is a client component at all.
 *
 * The page is ISR at revalidate = 3600, so a "now" line rendered on the
 * server would be up to an hour wrong — which on this page is not a
 * cosmetic error. It would tell someone the procession had not reached a
 * chowk it passed forty minutes ago. The clock therefore runs in the
 * browser, and the server renders the list without a marker.
 *
 * The marker only appears on the day itself. On any other day a "now"
 * line is noise at best, and on the 20th it would sit at the top of the
 * list implying the procession is about to start.
 *
 * Nothing auto-scrolls. The map and the tracker link sit above this list
 * and are the first things a reader wants; yanking the page down to the
 * current hour on load would take those away from them. "Now" is a chip
 * they can press instead.
 */

/** The marker's id, so the "Now" chip can find it wherever it lands. */
const NOW_ID = 'visarjan-now';

export function TimingsTimeline({
  rows,
  mandals,
  /** Visarjan day or its eve — decided on the server, from the config. */
  isToday,
}: {
  rows: TimingRow[];
  mandals: { name: string; slug?: string }[];
  isToday: boolean;
}) {
  const listRef = useRef<HTMLOListElement>(null);

  // null on the server and on any day but this one.
  const nowMinutes = useIstMinutes(isToday);

  const scrollTo = (el: Element | null) => {
    // Smooth scrolling is driven by the compositor, so it silently does
    // nothing where animation frames do not run — a background tab, and
    // anyone who has asked for reduced motion. Jumping is the honest
    // fallback: the reader still arrives at the row they pressed for.
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
  };

  const jump = (slug?: string, name?: string) => {
    const target = listRef.current?.querySelector(
      `[data-mandal="${CSS.escape(name ?? slug ?? '')}"]`
    );
    scrollTo(target ?? null);
  };

  // Found by id rather than held in a ref. The marker moves between two
  // render branches as the day passes, and a ref through a child
  // component came back null; the id is in the DOM either way.
  const jumpToNow = () => scrollTo(document.getElementById(NOW_ID));

  // The first row at or after now — the marker goes immediately before it.
  const nextIndex =
    nowMinutes === null ? -1 : rows.findIndex((r) => r.minutes >= nowMinutes);
  const markerBefore = nextIndex === -1 ? rows.length : nextIndex;
  const showMarker = nowMinutes !== null;

  return (
    <div>
      {/* Chips scroll the list rather than filtering it: filtering would
          take away the one view that answers "what is passing soon". */}
      <nav
        aria-label="Jump to a mandal"
        className="-mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4 pb-1"
      >
        {showMarker && (
          <button
            type="button"
            onClick={jumpToNow}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[var(--radius-chip)] border border-[var(--zendu)]/50 bg-[var(--zendu)]/[0.12] px-3 text-[13px] font-semibold text-[var(--zendu)]"
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-[var(--zendu)]"
              style={{ boxShadow: 'var(--glow-zendu)' }}
            />
            Now
          </button>
        )}
        {mandals.map((m) => (
          <button
            key={m.name}
            type="button"
            onClick={() => jump(m.slug, m.name)}
            className="inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-chip)] border border-[var(--line-strong)] px-3 text-[13px] text-[var(--muted)]"
          >
            {m.name}
          </button>
        ))}
      </nav>

      <ol ref={listRef} className="mt-3 border-l border-[var(--line-strong)] pl-4">
        {/* The marker is a sibling of the rows, not a child of one: it
            renders an <li> itself, and an <li> inside an <li> is invalid. */}
        {rows.map((r, i) => (
          <Fragment key={`${r.time}-${r.mandal ?? 'city'}-${r.what.slice(0, 20)}`}>
            {showMarker && i === markerBefore && <NowLine minutes={nowMinutes} />}
            <li>
              <Row row={r} />
            </li>
          </Fragment>
        ))}
        {/* The whole day is behind us: the marker belongs at the end. */}
        {showMarker && markerBefore === rows.length && <NowLine minutes={nowMinutes} />}
      </ol>
    </div>
  );
}

function NowLine({ minutes }: { minutes: number }) {
  return (
    <li id={NOW_ID} className="relative -ml-4 flex items-center gap-2 py-2.5 pl-4" aria-current="time">
      <span
        aria-hidden="true"
        className="absolute -left-[5px] h-2 w-2 rounded-full bg-[var(--zendu)]"
        style={{ boxShadow: 'var(--glow-zendu)' }}
      />
      <span className="font-display text-[13px] font-bold uppercase tracking-[0.08em] text-[var(--zendu)]">
        Now · {formatIst(minutes)}
      </span>
      <span aria-hidden="true" className="h-px flex-1 bg-[var(--zendu)]/35" />
    </li>
  );
}

function Row({ row }: { row: TimingRow }) {
  const body = (
    <>
      <span className="font-display w-[74px] shrink-0 text-[15px] font-bold text-[var(--zendu)] tabular-nums">
        {row.time.split('–')[0].trim()}
      </span>
      <span className="min-w-0">
        {row.mandal && (
          <span className="block text-[14.5px] font-semibold text-[var(--chandan)]">
            {row.mandal}
          </span>
        )}
        <span className="block text-[13.5px] leading-relaxed text-[var(--muted)]">
          {row.what}
          {row.whatMr && (
            <span lang="mr" className="ml-1.5 text-[var(--faint)]">
              {row.whatMr}
            </span>
          )}
        </span>
        {/* The full range, where the source gave one — the row's own time
            column shows only its start so the column stays scannable. */}
        {row.time.includes('–') && (
          <span className="block text-[11.5px] text-[var(--faint)]">until {row.time.split('–')[1].trim()}</span>
        )}
      </span>
    </>
  );

  return (
    <div
      data-mandal={row.mandal ?? ''}
      className="relative flex items-baseline gap-3 py-2"
    >
      <span
        aria-hidden="true"
        className={[
          'absolute -left-[21px] top-[15px] h-1.5 w-1.5 rounded-full',
          row.source === 'police' ? 'bg-[var(--faint)]' : 'bg-[var(--zendu)]',
        ].join(' ')}
      />
      {row.slug ? (
        <Link href={`/ganpati/${row.slug}`} className="flex flex-1 items-baseline gap-3">
          {body}
        </Link>
      ) : (
        body
      )}
    </div>
  );
}
