'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useCrowdState, useClockMs } from './useCrowd';
import { useGeolocation } from '@/hooks/useGeolocation';
import { haversine, formatDistance } from '@/lib/geo';
import { CROWD_COLOR, CrowdDot } from './CrowdBadge';
import { NearbyReportPrompt } from './NearbyReportPrompt';
import type { Ganpati } from '@/types/ganpati';
import type { CrowdLevel } from '@/types/crowd';

/**
 * "Right now" — the first thing on the homepage.
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

const MAX_ROWS = 3;

/** Short first, then moving. Long is summarised, never listed. */
const GOOD: CrowdLevel[] = ['short', 'moving'];

interface Ranked {
  g: Ganpati;
  level: CrowdLevel;
  label: string;
  distanceM: number | null;
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
        Right now
      </h2>
      {suffix && (
        <span className="shrink-0 text-[12px] text-[var(--faint)]">{suffix}</span>
      )}
    </div>
  );
}

export function LiveCrowdSection({ ganpatis }: { ganpatis: Ganpati[] }) {
  const { byMandalId, unavailable, loading, stale, computedAt } = useCrowdState();
  const { state } = useGeolocation();
  const nowMs = useClockMs();

  const position = state.status === 'ready' ? state.position : null;

  const { rows, heavyCount } = useMemo(() => {
    const withStatus = ganpatis
      .map((g) => {
        const status = byMandalId[g.id];
        if (!status?.status) return null;
        return {
          g,
          level: status.status,
          label: status.label,
          distanceM: position
            ? haversine(position, { lat: g.location.lat, lng: g.location.lng })
            : null,
        } satisfies Ranked;
      })
      .filter((r): r is Ranked => r !== null);

    const good = withStatus
      .filter((r) => GOOD.includes(r.level))
      .sort((a, b) => {
        // Short before moving, then nearest — or best known when we have no
        // position to sort by.
        const byLevel = GOOD.indexOf(a.level) - GOOD.indexOf(b.level);
        if (byLevel !== 0) return byLevel;
        if (a.distanceM !== null && b.distanceM !== null) {
          return a.distanceM - b.distanceM;
        }
        return b.g.prominence - a.g.prominence;
      });

    return {
      rows: good.slice(0, MAX_ROWS),
      heavyCount: withStatus.filter((r) => r.level === 'long').length,
    };
  }, [ganpatis, byMandalId, position]);

  const ageMs =
    nowMs !== null && computedAt ? Math.max(0, nowMs - Date.parse(computedAt)) : null;
  const ago = agoText(Number.isFinite(ageMs) ? ageMs : null);

  /* ---------------- Unavailable ---------------- */

  if (unavailable) {
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

  if (loading && rows.length === 0 && heavyCount === 0) {
    return (
      <Shell>
        <Heading />
        <div className="mt-3 space-y-2" aria-hidden="true">
          <div className="h-5 w-2/3 animate-pulse rounded bg-[var(--line-strong)]" />
          <div className="h-5 w-1/2 animate-pulse rounded bg-[var(--line-strong)]" />
        </div>
      </Shell>
    );
  }

  /* ---------------- Nobody has reported ---------------- */

  if (rows.length === 0 && heavyCount === 0) {
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
        <Heading suffix={ago ? (stale ? `last known · ${ago}` : `updated ${ago}`) : null} />

        {rows.length > 0 ? (
          <>
            <p className="mt-2.5 text-[13px] font-semibold text-[var(--chandan)]">
              Shortest queues
            </p>
            <ul className="mt-1.5 divide-y divide-[var(--line)]">
              {rows.map(({ g, level, label, distanceM }) => (
                <li key={g.id}>
                  <Link
                    href={`/ganpati/${g.slug}`}
                    prefetch={false}
                    className="flex min-h-11 items-center justify-between gap-3 py-2.5"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <CrowdDot level={level} size={10} />
                      <span className="truncate text-[14px] text-[var(--chandan)]">
                        {g.name}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2.5">
                      {distanceM !== null && (
                        <span className="text-[12px] text-[var(--faint)]">
                          {formatDistance(distanceM)}
                        </span>
                      )}
                      <span
                        className="text-[13px] font-semibold"
                        style={{ color: CROWD_COLOR[level] }}
                      >
                        {label}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          // Everything reported is heavy. Saying so is more useful than an
          // empty "shortest queues" list with nothing under it.
          <p className="mt-2.5 text-[14px] leading-relaxed text-[var(--muted)]">
            Every mandal reported in the last 90 minutes has a heavy queue.
          </p>
        )}

        {heavyCount > 0 && rows.length > 0 && (
          <p className="mt-2.5 flex items-center gap-2 text-[13px] text-[var(--muted)]">
            <CrowdDot level="long" size={9} />
            {heavyCount === 1
              ? '1 mandal is heavy right now'
              : `${heavyCount} mandals are heavy right now`}
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
      </Shell>

      <NearbyReportPrompt ganpatis={ganpatis} />
    </>
  );
}
