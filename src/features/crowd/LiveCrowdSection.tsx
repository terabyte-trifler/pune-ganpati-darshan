'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useCrowdState, useClockMs } from './useCrowd';
import { useCrowdDisplays } from './useCrowdDisplay';
import { rankTrackerRows, type Rankable } from './tracker-rows';
import { useGeolocation } from '@/hooks/useGeolocation';
import { haversine, formatDistance } from '@/lib/geo';
import { CROWD_COLOR, CrowdDot } from './CrowdBadge';
import { QueueTime } from './QueueTime';
import { NearbyReportPrompt } from './NearbyReportPrompt';
import type { Ganpati } from '@/types/ganpati';
import type { CrowdLevel } from '@/types/crowd';

/**
 * "Live crowd tracker" — the first thing on the homepage.
 *
 * This exists because live queue reporting is the one thing the app does
 * that a list of mandals cannot, and it was buried below the fold behind a
 * routes rail. It answers the question a devotee actually has mid-festival:
 * not "which mandals exist" but "where can I get darshan without standing
 * for forty minutes".
 *
 * It shows the SHORT queues, not the long ones. People want somewhere to
 * go; the heavy mandals are a single summary line rather than a list,
 * because a ranked table of places to avoid is not a plan.
 *
 * The empty state is the point of the whole component, not an afterthought.
 * Reports expire after 90 minutes, so before the festival — and on any
 * quiet morning — there is genuinely nothing to show. A top section that
 * could only say "no data" would make the app look broken to a first-time
 * visitor at exactly the wrong moment, so when there is nothing to report
 * it becomes the invitation to report instead. It never renders an empty
 * shelf, and it never dresses an absence up as a calm queue (§32, §33).
 */

/**
 * What the three colours mean, and that the map speaks the same language.
 *
 * The pins carry the queue now — a whole pin is green, amber or red — so
 * the tracker has to say what those colours are, or the map is a code with
 * no key. Placed at the end of the section rather than the top: someone
 * who has just read three live rows already has the idea, and this
 * confirms it and points at where else it applies.
 *
 * Level is carried by shape as well as colour, matching CrowdBadge, so it
 * still reads in greyscale and to a colour-blind visitor (§37).
 */
function Legend() {
  return (
    <div className="mt-3 border-t border-[var(--line)] pt-3">
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {LEGEND.map(({ level, label, hint }) => (
          <li key={level} className="flex items-center gap-1.5">
            <CrowdDot level={level} size={9} />
            <span
              className="text-[13px] font-semibold"
              style={{ color: CROWD_COLOR[level] }}
            >
              {label}
            </span>
            <span className="text-[12px] text-[var(--faint)]">{hint}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] leading-relaxed text-[var(--muted)]">
        Every mandal on the map is drawn in its queue&rsquo;s colour. A{' '}
        <strong className="font-semibold">filled</strong> pin is what people
        reported; a <strong className="font-semibold">half-filled</strong> one is
        what phones nearby were seen doing; a{' '}
        <strong className="font-semibold">hollow</strong> one is an estimate from
        the hour of day. Grey means none of the three has anything to say — not
        that the mandal is quiet.
      </p>
    </div>
  );
}

/** The same three the report buttons offer, in the same words. */
const LEGEND: { level: CrowdLevel; label: string; hint: string }[] = [
  { level: 'short', label: 'Short', hint: 'straight in' },
  { level: 'moving', label: 'Moving', hint: 'queue, but moving' },
  { level: 'long', label: '30+ min', hint: 'heavy' },
];

const MAX_ROWS = 3;

/**
 * A row, and everything the ordering needs from it.
 *
 * The list used to stop at 'moving' — heavy mandals were summarised in a
 * line and never given a row, on the grounds that a ranked table of
 * places to avoid is not a plan. That held while every row was a report.
 * It stopped holding the moment the prior started filling rows, because
 * it meant a mandal somebody is standing outside, reporting a heavy
 * queue, could be pushed off the list by a mandal a model merely has an
 * opinion about. See tracker-rows for the rule that replaced it.
 */
interface Ranked extends Rankable {
  g: Ganpati;
  label: string;
  /** How long the queue is, and whether that is measured or worked out. */
  wait: { minutes: number; source: 'reported' | 'observed' | 'modelled' | 'override' } | null;
  /** When this mandal was last reported — NOT when the snapshot was built. */
  lastUpdated: string | null;
}

/** "2 min ago" — minute resolution, matching CrowdPanel. */
function agoText(ms: number | null): string | null {
  if (ms === null) return null;
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="surface mx-4 mt-6 rounded-[var(--radius-card)] border border-[var(--line)] p-4"
      aria-labelledby="live-crowd-heading"
    >
      {children}
    </section>
  );
}

function Heading({ suffix }: { suffix?: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2
        id="live-crowd-heading"
        className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-[var(--faint)]"
      >
        <span
          aria-hidden="true"
          className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--shendur)]"
        />
        Live crowd tracker
      </h2>
      {suffix && (
        <span className="shrink-0 text-[12px] text-[var(--faint)]">{suffix}</span>
      )}
    </div>
  );
}

export function LiveCrowdSection({ ganpatis }: { ganpatis: Ganpati[] }) {
  const { unavailable, loading, stale, computedAt } = useCrowdState();
  const displays = useCrowdDisplays(ganpatis);
  const { state } = useGeolocation();
  const nowMs = useClockMs();

  const position = state.status === 'ready' ? state.position : null;

  const { rows, heavyElsewhere, anyEstimated, anyObserved, anyMeasured, allGood } =
    useMemo(() => {
    const all = ganpatis
      .map((g) => {
        const display = displays[g.id];
        if (!display) return null;
        return {
          g,
          level: display.level,
          label: display.label,
          source: display.source,
          wait:
            display.estimatedWaitMinutes != null && display.waitSource
              ? { minutes: display.estimatedWaitMinutes, source: display.waitSource }
              : null,
          distanceM: position
            ? haversine(position, { lat: g.location.lat, lng: g.location.lng })
            : null,
          prominence: g.prominence,
          lastUpdated: display.lastUpdated,
        } satisfies Ranked;
      })
      .filter((r): r is Ranked => r !== null);

    // Provenance first, level second. Every reading somebody's phone
    // produced — a queue report, a wait time, a dwell-tipped colour — is
    // listed ahead of every estimate, green amber or red, and the model
    // fills only what is left.
    const shown = rankTrackerRows(all, MAX_ROWS);
    const shownIds = new Set(shown.map((r) => r.g.id));

    return {
      rows: shown,
      // Only the heavy ones that did not get a row, so the summary adds
      // something rather than repeating what is directly above it. Counted
      // from reports alone: "3 mandals are heavy right now" is a claim
      // about now, and the model is not entitled to make it.
      heavyElsewhere: all.filter(
        (r) => r.source === 'reported' && r.level === 'long' && !shownIds.has(r.g.id)
      ).length,
      anyEstimated: shown.some((r) => r.source === 'estimated'),
      anyObserved: shown.some((r) => r.source === 'observed'),
      anyMeasured: all.some((r) => r.source === 'reported'),
      allGood: shown.every((r) => r.level !== 'long'),
    };
  }, [ganpatis, displays, position]);

  const ageMs =
    nowMs !== null && computedAt ? Math.max(0, nowMs - Date.parse(computedAt)) : null;
  const ago = agoText(Number.isFinite(ageMs) ? ageMs : null);

  /* ---------------- Unavailable ---------------- */

  // Only when there is nothing at all to put here. The estimates are
  // computed on the device from static catalogue data and the clock, so
  // they survive exactly the situation this branch describes — and that
  // situation, a saturated cell in a peth at 9pm, is the one the model
  // was written for. Falling through means the section still answers the
  // question when the network cannot.
  if (unavailable && rows.length === 0) {
    return (
      <Shell>
        <Heading />
        <p className="mt-2.5 text-[14px] leading-relaxed text-[var(--muted)]">
          Crowd reports are temporarily unavailable. Everything else on this page
          still works.
        </p>
      </Shell>
    );
  }

  /* ---------------- First load ---------------- */

  if (loading && rows.length === 0) {
    /**
     * A skeleton the same shape and height as the loaded section.
     *
     * This used to be two short bars, 112px against the 341px the live
     * section occupies — so when the readings arrived the block grew by
     * 229px and shoved the whole page down. That single jump was most of a
     * 0.23 CLS on the busiest screen in the app, and it landed at ~200ms,
     * exactly when someone is reaching for what they can see.
     *
     * Reserving the space is the fix; making it the right shape is what
     * stops it looking like a bug while it waits.
     */
    return (
      <Shell>
        <Heading />
        <div className="mt-2.5" aria-hidden="true">
          <div className="h-4 w-28 animate-pulse rounded bg-[var(--line-strong)]" />
          <ul className="mt-1.5 divide-y divide-[var(--line)]">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-2.5 py-[13px]">
                <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-[var(--line-strong)]" />
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span
                    className="h-3.5 animate-pulse rounded bg-[var(--line-strong)]"
                    style={{ width: `${72 - i * 12}%` }}
                  />
                  <span className="h-3 w-24 animate-pulse rounded bg-[var(--line)]" />
                </span>
                <span className="h-3.5 w-12 shrink-0 animate-pulse rounded bg-[var(--line)]" />
              </li>
            ))}
          </ul>
          <div className="mt-2.5 h-4 w-44 animate-pulse rounded bg-[var(--line)]" />
          <div className="mt-3 h-11 w-52 animate-pulse rounded bg-[var(--line)]" />
          <div className="mt-3 border-t border-[var(--line)] pt-3">
            <div className="h-4 w-full animate-pulse rounded bg-[var(--line)]" />
            <div className="mt-2 h-9 w-full animate-pulse rounded bg-[var(--line)]" />
          </div>
        </div>
      </Shell>
    );
  }

  /* ---------------- Nobody has reported ---------------- */

  // Every level is listable now, so an empty list means nothing at all:
  // no reports anywhere and nothing the prior is willing to say.
  if (rows.length === 0) {
    return (
      <>
        <Shell>
          <Heading />
          <p className="mt-2.5 text-[15px] font-semibold text-[var(--chandan)]">
            No queues reported yet
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">
            Nobody has reported a queue in the last 90 minutes. If you are out
            there, you would be the first — it takes one tap.
          </p>
        </Shell>
        <NearbyReportPrompt ganpatis={ganpatis} />
      </>
    );
  }

  /* ---------------- Live ---------------- */

  return (
    <>
      <Shell>
        {/* The header no longer claims a freshness. `computedAt` is when the
            snapshot was BUILT, not when anyone reported, so "updated just
            now" sat above readings that could be eighty minutes old. Each
            row carries its own time instead; the header speaks only when the
            whole snapshot is known to be stale, which is a different fact
            and worth saying. */}
        <Heading suffix={stale && ago ? `last known · ${ago}` : null} />

        <p className="mt-2.5 text-[13px] font-semibold text-[var(--chandan)]">
          {!anyMeasured
            ? 'Expected to be quietest'
            : allGood
              ? 'Shortest queues'
              : 'Reported right now'}
        </p>
            <ul className="mt-1.5 divide-y divide-[var(--line)]">
              {rows.map(({ g, level, label, source, wait, distanceM, lastUpdated }) => {
                // Each mandal's OWN freshness. A reading can be 80 minutes
                // old inside a snapshot computed a second ago, so this is
                // the only honest place to put a time.
                const rowAge =
                  nowMs !== null && lastUpdated
                    ? Math.max(0, nowMs - Date.parse(lastUpdated))
                    : null;
                const rowAgo = agoText(Number.isFinite(rowAge) ? rowAge : null);
                const subtitle = [
                  distanceM !== null ? formatDistance(distanceM) : null,
                  // An override reads as a report here, by the owner's
                  // decision: a person went and looked, which is what the
                  // word means to a visitor. Dwell says "observed",
                  // because no person was involved in it at all — and
                  // that one word is the whole of what a visitor needs to
                  // know about where the reading came from.
                  !rowAgo
                    ? null
                    : source === 'observed'
                      ? `seen ${rowAgo}`
                      : source === 'estimated'
                        ? null
                        : `reported ${rowAgo}`,
                ]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <li key={g.id}>
                    <Link
                      href={`/ganpati/${g.slug}`}
                      prefetch={false}
                      className="flex min-h-11 items-center justify-between gap-3 py-2.5"
                    >
                      <span className="flex min-w-0 items-start gap-2.5">
                        <span className="mt-[5px] flex shrink-0">
                          <CrowdDot
                            level={level}
                            size={10}
                            fill={
                              source === 'observed'
                                ? 'half'
                                : source === 'estimated'
                                  ? 'hollow'
                                  : 'filled'
                            }
                          />
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-[14px] text-[var(--chandan)]">
                            {g.name}
                          </span>
                          {/* An estimate has no report time, and it does not
                              get a substitute one. The label already says
                              "Estimated"; a second line restating that in
                              other words only makes the row longer. With no
                              position to show either, the line is dropped
                              rather than rendered empty. */}
                          {subtitle && (
                            <span className="mt-0.5 truncate text-[12px] text-[var(--faint)]">
                              {subtitle}
                            </span>
                          )}
                        </span>
                      </span>
                      {/* The level answers "should I go"; the wait answers
                          "how long will I stand there", which is the one
                          that decides whether it fits the evening. Both in
                          the level's colour, so the row reads as one
                          judgement rather than two. */}
                      <span className="flex shrink-0 flex-col items-end gap-0.5">
                        <span
                          className="text-[13px] font-semibold"
                          style={{ color: CROWD_COLOR[level] }}
                        >
                          {label}
                        </span>
                        <QueueTime level={level} wait={wait} size="sm" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>

        {(anyObserved || anyEstimated) && (
          <p className="mt-2 text-[12px] leading-relaxed text-[var(--muted)]">
            {anyObserved && (
              <>
                Rows marked <strong className="font-semibold">observed</strong>{' '}
                come from phones near the mandal rather than from a person.{' '}
              </>
            )}
            {anyEstimated && (
              <>
                <strong className="font-semibold">Estimated</strong> rows are
                worked out from the hour and this mandal&rsquo;s usual queue.{' '}
              </>
            )}
            Nobody has reported those, and they only ever fill rows a report
            could not.
          </p>
        )}

        {/* The heavy mandals that did not fit. "more" only when one of
            them is already in the list above — otherwise there is nothing
            for it to be more than. */}
        {heavyElsewhere > 0 && (
          <p className="mt-2.5 flex items-center gap-2 text-[13px] text-[var(--muted)]">
            <CrowdDot level="long" size={9} />
            {heavyElsewhere === 1
              ? `1${allGood ? '' : ' more'} mandal is heavy right now`
              : `${heavyElsewhere}${allGood ? '' : ' more'} mandals are heavy right now`}
          </p>
        )}

        <Link
          href="/map"
          prefetch={false}
          className="mt-3 inline-flex min-h-11 items-center gap-1 text-[13px] font-semibold text-[var(--shendur)]"
        >
          See every mandal on the map
          <ChevronRight size={15} aria-hidden="true" />
        </Link>

        <Legend />
      </Shell>

      <NearbyReportPrompt ganpatis={ganpatis} />
    </>
  );
}
