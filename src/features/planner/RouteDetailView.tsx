'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ListPlus, Eye, DoorOpen, Clock } from 'lucide-react';
import { MiniMap } from '@/features/map/MiniMapLoader';
import { CrowdBadge } from '@/features/crowd/CrowdBadge';
import { StartRouteButton } from './StartRouteButton';
import { Button } from '@/components/ui/Button';
import { CategoryBadge } from '@/components/ui/Badge';
import { usePlan } from '@/hooks/useLocalCollection';
import { formatDuration } from '@/lib/geo';
import { stationForRoute, returnStation } from '@/lib/metro';
import { MetroJourneyCard } from './MetroJourneyCard';
import { useLiveRouteTime } from '@/features/crowd/useLiveRouteTime';
import { trackEvent } from '@/services/analytics';
import { cn } from '@/lib/utils';
import type { CuratedRoute } from '@/types/ganpati';
import type { RouteTotals } from '@/services/routes';

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
  totals: RouteTotals;
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
  // Where the train home leaves from. Usually a different station from the
  // one you arrived at, and during the festival often one you could not
  // have arrived at.
  const home = returnStation(mandals);

  // One source for this number: the headline stat on this page uses the
  // same hook, and computing it twice is how they end up disagreeing.
  const live = useLiveRouteTime(mandals, totals.darshanS);
  const darshanS = live.darshanS;

  /**
   * The routed walking line for a curated route.
   *
   * Without this the map drew straight connectors between the stops and
   * nothing else — the planner fetched a real path and a curated route
   * never did, so every one of these pages was joining dots. It shows
   * worst on the metro route, where the stops are far enough apart that a
   * straight line crosses whole blocks.
   *
   * optimize is false on purpose: a curated route's order is set by hand
   * and is not ours to change. This asks only for the path through it.
   */
  const [geometry, setGeometry] = useState<[number, number][] | null>(null);
  const asked = useRef<string | null>(null);

  useEffect(() => {
    if (mandals.length < 2) return;
    const key = `${route.slug}|${route.mode}`;
    if (asked.current === key) return;
    asked.current = key;

    const points = mandals.map((m) => ({ lat: m.location.lat, lng: m.location.lng }));
    let live = true;
    fetch('/api/routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin: points[0],
        stops: points.slice(1),
        mode: route.mode,
        optimize: false,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (live && data?.geometry) setGeometry(data.geometry);
      })
      .catch(() => {
        // The dashed connectors stay. A curated route still reads without
        // its line, and a failed fetch is not worth an error beside it.
      });

    return () => {
      live = false;
    };
    // Keyed on the route, not on `mandals`: that array is rebuilt every
    // render, so listing it re-ran this effect, and the cleanup then
    // cancelled the fetch it had just started — the guard above stopped a
    // second attempt, so the line never arrived at all.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.slug, route.mode]);

  const useThisRoute = () => {
    replace(mandals.map((m) => m.slug));
    trackEvent('plan_created', { props: { source: 'curated', route: route.slug } });
  };

  return (
    <>
      <MiniMap
        mandals={mandals}
        ordered
        routeGeometry={geometry}
        selectedSlug={selected}
        onSelect={setSelected}
        className="h-64 w-full sm:h-80"
      />
      <p className="mt-1.5 text-[12px] text-[var(--faint)]">
        {geometry
          ? 'The line is the walking path, along the lanes where the crowd is sent one way.'
          : 'Stops are shown in walking order. Tap a number to see which mandal it is.'}
      </p>

      {/* The crowd's own direction. A curated route's order is fixed by
          hand, so unlike a plan the app cannot re-order it around these —
          which makes saying so before somebody sets off the whole of what
          it can do here. */}
      {totals.oneWays.length > 0 && (
        <div className="surface mt-3 rounded-[var(--radius-card)] border border-[var(--line-strong)] p-3">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--zendu)]">
            One way on foot
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {totals.oneWays.map((w) => (
              <li key={w.name} className="text-[13px] leading-snug text-[var(--muted)]">
                <span className="font-semibold text-[var(--chandan)]">
                  Walk {w.heading} <span aria-hidden="true">→</span> {w.towards}
                </span>
                <span className="mt-0.5 block text-[var(--faint)]">{w.name}</span>
                <span className="mt-0.5 block">{w.note}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-[var(--faint)]">
            This route walks these stretches the way the crowd does. On the map
            they are the blue lines, and the arrows point the way you walk.
          </p>
        </div>
      )}

      {/* ---------------- Where to get off ---------------- */}
      {anchor && (
        <div className="mt-4">
          <MetroJourneyCard
            alight={anchor.station}
            walkToFirstM={anchor.distanceM}
            firstStop={
              mandals[0]
                ? { lat: mandals[0].location.lat, lng: mandals[0].location.lng }
                : undefined
            }
            home={home}
          />
        </div>
      )}

      {/* ---------------- Navigate ---------------- */}
      <StartRouteButton
        stops={mandals}
        mode={route.mode}
        source={`route:${route.slug}`}
        preserveOrder
      />

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
                    <CrowdBadge
                      mandalId={stop.ganpati.id}
                      prior={stop.ganpati}
                      className="mt-1"
                    />
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
