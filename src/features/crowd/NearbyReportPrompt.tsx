'use client';

import { useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import { useAutoLocate, useGeolocation } from '@/hooks/useGeolocation';
import { haversine, formatDistance } from '@/lib/geo';
import { CrowdReportButtons } from './CrowdReportButtons';
import { REPORT_MAX_DISTANCE_M } from './report-eligibility';
import { cn } from '@/lib/utils';
import type { Ganpati } from '@/types/ganpati';

/**
 * Report the queue without naming the mandal first.
 *
 * Reporting used to require a search: type a name, open the page, then
 * vote. That is a bad ask of the only person whose report is worth
 * anything — someone standing in a crowd at night, holding a phone in one
 * hand. This closes the gap by using the position the user has already
 * shared to work out which mandal they mean.
 *
 * Two modes, because two different claims are being made:
 *
 *   at   — "You're at Dagdusheth". A claim about where someone IS, so it
 *          is made only when the fix is accurate enough to support it.
 *   near — "Seen any of these?". No claim at all, just a shortlist, so a
 *          coarse fix is fine.
 *
 * Renders nothing until a position is known. Location is acquired on open
 * (see `useAutoLocate`), so for anyone who has granted it before this
 * appears without a tap. The nearby rail further down still owns the only
 * visible "locate me" button, for the first-time visitor who declines.
 *
 * Rendered by <LiveCrowdSection>, directly beneath it, so the page carries
 * one crowd block that both shows the live picture and collects it — rather
 * than two unrelated crowd cards in different places.
 */

/** Inside this, someone is standing at the mandal rather than near it. */
const AT_RADIUS_M = 120;

/**
 * Beyond this the shortlist stops being "things you might have walked
 * past" and starts being a list of mandals across town.
 *
 * The same radius the report controls themselves enforce, taken from the
 * one place that defines it — a shortlist offering a mandal whose buttons
 * then refuse to appear would be the worst of both.
 */
const NEAR_RADIUS_M = REPORT_MAX_DISTANCE_M;

/**
 * A fix coarser than this cannot tell two peth mandals apart, and naming
 * the wrong one invites a confidently wrong report. Above it the component
 * falls back to the shortlist and lets the person choose.
 */
const MAX_ACCURACY_M = 150;

const NEAR_LIMIT = 3;

interface Ranked {
  g: Ganpati;
  distanceM: number;
}

export function NearbyReportPrompt({ ganpatis }: { ganpatis: Ganpati[] }) {
  // Acquires the position on open. Mounted here because this component is
  // always present on the home page, whether or not it renders anything.
  useAutoLocate();
  const { state } = useGeolocation();
  const [pickedId, setPickedId] = useState<string | null>(null);

  const located = state.status === 'ready';
  const position = located ? state.position : null;
  const accuracyM = located ? state.accuracyM : null;

  const ranked: Ranked[] = useMemo(() => {
    if (!position) return [];
    return ganpatis
      .filter((g) => g.crowdReportingEnabled)
      .map((g) => ({
        g,
        distanceM: haversine(position, { lat: g.location.lat, lng: g.location.lng }),
      }))
      .sort((a, b) => a.distanceM - b.distanceM);
  }, [ganpatis, position]);

  if (!located || ranked.length === 0) return null;

  const atOnes = ranked.filter((r) => r.distanceM <= AT_RADIUS_M);
  const canClaimAt = accuracyM !== null && accuracyM <= MAX_ACCURACY_M && atOnes.length > 0;

  /* ---------------- "You're at X" ---------------- */

  if (canClaimAt) {
    // Keyed by id, not index: a position update reorders the list, and an
    // index would silently switch which mandal the buttons report on.
    const active = atOnes.find((r) => r.g.id === pickedId) ?? atOnes[0];

    return (
      <section
        className="surface mx-4 mt-3 rounded-[var(--radius-card)] border border-[var(--pital)]/35 p-4"
        aria-labelledby="at-mandal-heading"
      >
        <p
          id="at-mandal-heading"
          className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-[var(--faint)]"
        >
          <MapPin size={13} aria-hidden="true" />
          You&rsquo;re here
        </p>

        <p className="mt-1.5 text-[17px] font-bold leading-tight text-[var(--chandan)]">
          {active.g.name}
        </p>

        {/* More than one mandal inside the radius is normal in the peths,
            where they sit within metres of each other. Only the
            ALTERNATIVES are listed — rendering the active one as a
            selected chip too repeated its name directly under the heading,
            which read as a rendering bug rather than a choice. */}
        {atOnes.length > 1 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] text-[var(--faint)]">Not here?</span>
            {atOnes
              .filter((r) => r.g.id !== active.g.id)
              .map((r) => (
                <button
                  key={r.g.id}
                  type="button"
                  onClick={() => setPickedId(r.g.id)}
                  className={cn(
                    'min-h-9 rounded-full border border-[var(--line)] px-3',
                    'text-[12px] font-semibold text-[var(--muted)] transition-colors',
                    'active:scale-[0.97]'
                  )}
                >
                  {r.g.name}
                </button>
              ))}
          </div>
        )}

        <div className="mt-3">
          {/* Keyed so switching mandal resets the row rather than carrying
              the previous one's thank-you or error across. */}
          <CrowdReportButtons
            key={active.g.id}
            mandalId={active.g.id}
            location={active.g.location}
          />
        </div>
      </section>
    );
  }

  /* ---------------- "Seen any of these?" ---------------- */

  const nearOnes = ranked.filter((r) => r.distanceM <= NEAR_RADIUS_M).slice(0, NEAR_LIMIT);
  if (nearOnes.length === 0) return null;

  return (
    <section
      className="surface mx-4 mt-3 rounded-[var(--radius-card)] border border-[var(--line)] p-4"
      aria-labelledby="near-report-heading"
    >
      <p
        id="near-report-heading"
        className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-[var(--faint)]"
      >
        <MapPin size={13} aria-hidden="true" />
        Seen any of these?
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--muted)]">
        Rate the queue for a mandal you have walked past. It helps everyone
        deciding where to go next.
      </p>

      <ul className="mt-3 divide-y divide-[var(--line)]">
        {nearOnes.map((r) => (
          <li key={r.g.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[14px] font-semibold leading-tight text-[var(--chandan)]">
                {r.g.name}
              </p>
              <span className="shrink-0 text-[12px] text-[var(--faint)]">
                {formatDistance(r.distanceM)}
              </span>
            </div>
            <div className="mt-2">
              <CrowdReportButtons mandalId={r.g.id} location={r.g.location} compact />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
