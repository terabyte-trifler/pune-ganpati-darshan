'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ListPlus, Eye, DoorOpen, Clock, TrainFront } from 'lucide-react';
import { MiniMap } from '@/features/map/MiniMapLoader';
import { CrowdBadge } from '@/features/crowd/CrowdBadge';
import { StartRouteButton } from './StartRouteButton';
import { Button } from '@/components/ui/Button';
import { CategoryBadge } from '@/components/ui/Badge';
import { usePlan } from '@/hooks/useLocalCollection';
import { formatDuration, formatDistance } from '@/lib/geo';
import { stationForRoute, LINE_COLOR, LINE_NAME } from '@/lib/metro';
import { useLiveRouteTime } from '@/features/crowd/useLiveRouteTime';
import { trackEvent } from '@/services/analytics';
import { cn } from '@/lib/utils';
import type { CuratedRoute } from '@/types/ganpati';

/**
 * A curated route: the map and the stop list, kept in sync.
 *
 * Selecting a stop in the list moves the map, and tapping a numbered pin
 * highlights the stop — the map/list synchronisation the brief asks for (§23),
 * applied here at the route level.
 */
export function RouteDetailView({
  route, totals,
}: {
  route: CuratedRoute;
  totals: { stopCount: number; darshanS: number; travelS: number; totalS: number; distanceM: number; partialDarshan: boolean };
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const { replace } = usePlan();

  const mandals = route.stops.map((s) => s.ganpati);

  /**
   * Where to get off.
   *
   * Shown for every route, not only metro ones: on a walking route this is
   * how you reach the start, and on a metro route it is the start. Returns
   * null past 2.5 km, so the Chinchwad trip — twenty kilometres from the
   * nearest of these stations — shows nothing rather than a station it
   * would be absurd to walk from.
   */
  const anchor = stationForRoute(mandals);

  // One source for this number: the headline stat on this page uses the
  // same hook, and computing it twice is how they end up disagreeing.
  const live = useLiveRouteTime(mandals, totals.darshanS);
  const darshanS = live.darshanS;

  const useThisRoute = () => {
    replace(mandals.map((m) => m.slug));
    trackEvent('plan_created', { props: { source: 'curated', route: route.slug } });
  };

  return (
    <>
      <MiniMap
        mandals={mandals}
        ordered
        selectedSlug={selected}
        onSelect={setSelected}
        className="h-64 w-full sm:h-80"
      />
      <p className="mt-1.5 text-[12px] text-[var(--faint)]">
        Stops are shown in walking order. Tap a number to see which mandal it is.
      </p>

      {/* ---------------- Where to get off ---------------- */}
      {anchor && (
        <section className="mt-4 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] p-3">
          <h2 className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-[var(--faint)]">
            <TrainFront size={13} aria-hidden="true" />
            {route.mode === 'metro' ? 'Start from' : 'Nearest metro'}
          </h2>
          <p className="mt-1.5 flex items-center gap-1.5 text-[15px] font-semibold text-[var(--chandan)]">
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: LINE_COLOR[anchor.station.line] }}
            />
            {anchor.station.name}
            <span className="text-[12px] font-normal text-[var(--faint)]">
              {LINE_NAME[anchor.station.line]} · {formatDistance(anchor.distanceM)} to
              stop 1
            </span>
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">
            {anchor.station.exitNote}
          </p>
        </section>
      )}

      {/* ---------------- Navigate ---------------- */}
      <StartRouteButton stops={mandals} mode={route.mode} source={`route:${route.slug}`} />

      {/* ---------------- Or take it into your own plan ---------------- */}
      <Button
        asChild
        variant="secondary"
        size="md"
        full
        className="mt-3"
        onClick={useThisRoute}
      >
        <Link href="/plan">
          <ListPlus size={16} aria-hidden="true" />
          Add to my darshan
        </Link>
      </Button>
      <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--faint)]">
        Copies these {totals.stopCount} stops into your darshan, where you can
        reorder them or add your own.
      </p>

      {/* ---------------- Stops ---------------- */}
      <h2 className="mb-2 mt-7 text-[13px] font-bold uppercase tracking-wide text-[var(--faint)]">
        Stops on this route
      </h2>
      <ol className="space-y-2">
        {route.stops.map((stop, i) => {
          const minutes = stop.darshanMinutes ?? stop.ganpati.darshanMinutes;
          const style = stop.darshanStyle ?? stop.ganpati.darshanStyle;
          const isSelected = selected === stop.ganpati.slug;

          return (
            <li key={stop.ganpati.id}>
              <div
                className={cn(
                  'rounded-[var(--radius-card)] border bg-[var(--dhoop)] transition-colors',
                  isSelected
                    ? 'border-[var(--shendur)]/60'
                    : 'border-[var(--line)]'
                )}
              >
                <button
                  type="button"
                  onClick={() => setSelected(isSelected ? null : stop.ganpati.slug)}
                  aria-expanded={isSelected}
                  className="flex w-full items-start gap-3 p-3 text-left"
                >
                  <span
                    aria-hidden="true"
                    className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--shendur)] text-[13px] font-bold text-[#1a0e04]"
                  >
                    {i + 1}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold leading-tight text-[var(--chandan)]">
                      {stop.ganpati.name}
                    </span>
                    {/* The most useful thing on this page mid-route: which
                        of these five stops is currently heaving. */}
                    <CrowdBadge mandalId={stop.ganpati.id} className="mt-1" />
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--faint)]">
                      <span>{stop.ganpati.area.name}</span>
                      {minutes != null && (
                        <span className="inline-flex items-center gap-1 text-[var(--zendu)]">
                          <Clock size={11} aria-hidden="true" />
                          about {minutes} min
                        </span>
                      )}
                      {style === 'outside' && (
                        <span className="inline-flex items-center gap-1">
                          <Eye size={11} aria-hidden="true" />
                          from outside
                        </span>
                      )}
                      {style === 'inside' && (
                        <span className="inline-flex items-center gap-1">
                          <DoorOpen size={11} aria-hidden="true" />
                          queue to go in
                        </span>
                      )}
                    </span>
                  </span>
                </button>

                {isSelected && (
                  <div className="border-t border-[var(--line)] px-3 py-2.5">
                    {stop.note && (
                      <p className="text-[13px] leading-relaxed text-[var(--muted)]">
                        {stop.note}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <CategoryBadge
                        category={stop.ganpati.category}
                        rank={stop.ganpati.manacheRank}
                      />
                      <Link
                        href={`/ganpati/${stop.ganpati.slug}`}
                        className="ml-auto inline-flex items-center gap-0.5 text-[13px] font-semibold text-[var(--shendur)]"
                      >
                        View mandal
                        <ChevronRight size={14} aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-5 text-[12px] leading-relaxed text-[var(--faint)]">
        Times are estimates: {formatDuration(darshanS)} queuing and
        darshan, plus about {formatDuration(totals.travelS)} walking between
        stops. Queues vary a lot by time of day
        {totals.partialDarshan && ', and some stops have no published estimate'}.
        {live.adjusted && ' Queuing reflects what devotees are reporting right now.'}
      </p>
    </>
  );
}
