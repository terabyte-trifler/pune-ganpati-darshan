'use client';

import Link from 'next/link';
import { Clock } from 'lucide-react';
import type { TimingRow } from '@/lib/visarjan-timings';
import { useIstMinutes, formatIst } from './useIstClock';

/**
 * What is about to happen, at the top of the page.
 *
 * ---------------------------------------------------------------------
 * Why this exists.
 *
 * The page is nearly seven screens long on a desktop and more on a phone.
 * Everything a reader needs on the day is in it, and on the day they are
 * standing in a crowd, one-handed, on a cell that is carrying half of
 * Pune. Scrolling to find the current hour in a list of nineteen rows is
 * the wrong thing to ask of them.
 *
 * So the question the page is most often opened with — "what happens
 * next?" — is answered before anything else, from the same merged rows
 * the timeline below draws. It never invents: when the day's published
 * times are behind us it says so rather than reaching for something to
 * fill the space.
 *
 * The eve is its own case, and getting it wrong is how this component
 * first shipped: at nine in the evening on the 24th every row was behind
 * the clock, so it announced that the day was over — about a procession
 * that had not started. The times belong to tomorrow, and on the eve it
 * says so and shows the first of them instead of counting down to none.
 *
 * It renders nothing at all on other days. A countdown to events that
 * already happened, or have not got close, is clutter.
 */

/** How many upcoming rows to name. Two fits a phone without scrolling. */
const UP_NEXT = 2;

export function UpNext({
  rows,
  isVisarjanDay,
  isEve,
}: {
  rows: TimingRow[];
  /** Visarjan itself, including the night it runs into. */
  isVisarjanDay: boolean;
  /** The day before — the times below are tomorrow's. */
  isEve: boolean;
}) {
  const now = useIstMinutes(isVisarjanDay || isEve);
  if (now === null) return null;

  // On the eve nothing has "passed": the clock and the rows are on
  // different days, so comparing them would be meaningless.
  const upcoming = isEve
    ? rows.slice(0, UP_NEXT)
    : rows.filter((r) => r.minutes >= now).slice(0, UP_NEXT);
  const done = upcoming.length === 0;

  return (
    <section
      aria-label="What happens next"
      className="mt-4 rounded-[var(--radius-card)] border border-[var(--zendu)]/40 bg-gradient-to-b from-[var(--zendu)]/[0.10] to-transparent p-4"
    >
      <h2 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.09em] text-[var(--zendu)]">
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        {isEve ? 'Tomorrow starts with' : `Now · ${formatIst(now)}`}
      </h2>

      {done ? (
        <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--muted)]">
          Every time the mandals published for today has passed. The
          procession runs into the morning from here, so where it has
          actually reached is a question only the{' '}
          <Link href="#timings" className="text-[var(--shendur)]">
            tracker
          </Link>{' '}
          can answer.
        </p>
      ) : (
        <ol className="mt-2.5 space-y-2">
          {upcoming.map((r, i) => (
            <li
              key={`${r.time}-${r.what.slice(0, 18)}`}
              className="flex items-baseline gap-3"
            >
              <span
                className={[
                  'font-display shrink-0 text-[15px] font-bold tabular-nums',
                  // The next one is the answer; the one after is context.
                  i === 0 ? 'text-[var(--zendu)]' : 'text-[var(--faint)]',
                ].join(' ')}
              >
                {r.time.split('–')[0].trim()}
              </span>
              <span
                className={[
                  'min-w-0 text-[13.5px] leading-relaxed',
                  i === 0 ? 'text-[var(--chandan)]' : 'text-[var(--muted)]',
                ].join(' ')}
              >
                {r.mandal && <strong className="font-semibold">{r.mandal}: </strong>}
                {r.what}
                {!isEve && (
                  <span className="ml-1.5 whitespace-nowrap text-[11.5px] text-[var(--faint)]">
                    in {formatGap(r.minutes - now)}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}

      <Link
        href="#timings"
        className="mt-3 inline-flex min-h-11 items-center text-[13px] font-semibold text-[var(--shendur)]"
      >
        All timings for the day →
      </Link>
    </section>
  );
}

/** "in 25 min", "in 2 h 10 min" — never "in 0 min". */
function formatGap(minutes: number): string {
  if (minutes < 1) return 'under a minute';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
