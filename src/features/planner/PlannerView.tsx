'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Footprints, Bike, TrainFront, X, GripVertical,
  Sparkles, Trash2, Loader2,
} from 'lucide-react';
import { Reorder, useDragControls } from 'motion/react';
import { usePlan } from '@/hooks/useLocalCollection';
import { useGeolocation, useResolveLocation } from '@/hooks/useGeolocation';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { GanpatiImage } from '@/components/ui/GanpatiImage';
import { SavePlanShare } from './SavePlanShare';
import { StartWizard } from './StartWizard';
import { useTravelMode } from './travel-mode-store';
import { StartRouteButton } from './StartRouteButton';
import { MiniMap } from '@/features/map/MiniMapLoader';
import { CrowdBadgeWithWait } from '@/features/crowd/CrowdBadge';
import { useCrowdState } from '@/features/crowd/useCrowd';
import { dwellMinutes, type DarshanPace } from '@/services/itinerary';
import {
  PUNE_CENTER, haversine, formatDistance, formatDuration,
  estimateDurationSeconds, DETOUR_FACTOR, type LatLng,
} from '@/lib/geo';
import { MetroStationPicker } from './MetroStationPicker';
import { MetroJourneyCard } from './MetroJourneyCard';
import { ParkingRideCard } from './ParkingRideCard';
import { chooseParking } from '@/services/parking-plan';
import { legModeFor } from '@/services/itinerary';
import { optimizeLocally } from '@/services/route-optimizer';
import { flowsOnRoute } from '@/services/pedestrian-flow';
import { returnWalk } from '@/services/metro-return';

/** Named, because "routed" without a source is a claim with no author. */
const PROVIDER_NAME: Record<string, string> = {
  ors: 'OpenRouteService',
  valhalla: 'Valhalla',
  osrm: 'OSRM',
};
import { stationForRoute, returnStation, stationById, PRIMARY_STATIONS } from '@/lib/metro';
import { trackEvent } from '@/services/analytics';
import type { Ganpati, TravelMode } from '@/types/ganpati';

/**
 * Darshan planner.
 *
 * Stops live in localStorage so a plan survives a reload and needs no
 * account (§29). Ordering is computed server-side via /api/routes, which
 * uses the Routes matrix when a key is present and a local estimate
 * otherwise — the result is labelled either way so an estimate is never
 * passed off as a routed time (§61).
 */

/**
 * Car and the vaguer "Transit" both went. The peths are shut to vehicles
 * through Ganeshotsav, and "Transit" named a thing no free router models —
 * where Metro names the one that actually gets you in, and sets the
 * route's starting point rather than its speed.
 */
/**
 * Pace changes how long the stops take, not which stops they are — the
 * plan is yours. It decides whether you queue at Dagdusheth or take
 * darshan from the road, which is most of the difference in an evening.
 */
const PACES: Array<{ key: DarshanPace; label: string }> = [
  { key: 'thorough', label: 'Queue at every stop' },
  { key: 'balanced', label: 'A bit of both' },
  { key: 'quick', label: 'Mostly from outside' },
];

const MODES: Array<{ key: TravelMode; label: string; icon: typeof Footprints }> = [
  // Metro first, deliberately. It is the one way in that does not add a
  // vehicle to the peths, it is what the city is asking people to use,
  // and it changes where a route STARTS rather than how fast it moves —
  // so it is the choice worth making before the others are considered.
  { key: 'metro', label: 'Metro', icon: TrainFront },
  { key: 'walk', label: 'Walk', icon: Footprints },
  { key: 'two_wheeler', label: 'Two-wheeler', icon: Bike },
];

interface RouteResult {
  order: number[];
  estimated: boolean;
  optimizedBy: 'routes-matrix' | 'local-estimate' | 'none';
  distanceM: number | null;
  durationS: number;
  geometry: [number, number][] | null;
  provider: 'osrm' | 'ors' | null;
  durationSource: 'provider' | 'derived';
  legs: Array<{ distanceM: number; durationS: number }>;
}

export function PlannerView({ ganpatis }: { ganpatis: Ganpati[] }) {
  const { items: planSlugs, replace, remove, hydrated } = usePlan();
  const searchParams = useSearchParams();
  const router = useRouter();

  /**
   * A shared plan arrives as ?stops=slug,slug. It is shown read-only rather
   * than written straight into the visitor's own darshan: someone opening a
   * friend's link should not silently lose the plan they already built.
   * Previously this parameter was ignored entirely, so every shared link
   * opened to an empty planner — the Share button produced a dead URL.
   */
  const sharedSlugs = useMemo(() => {
    const raw = searchParams.get('stops');
    if (!raw) return null;
    const valid = new Set(ganpatis.map((g) => g.slug));
    const slugs = raw.split(',').map((s) => s.trim()).filter((s) => valid.has(s));
    return slugs.length > 0 ? slugs : null;
  }, [searchParams, ganpatis]);
  const { state: geo, request: requestLocation } = useGeolocation();
  /**
   * Use a permission already granted.
   *
   * The position lives in a module store that a fresh page load starts
   * empty, and only the home page auto-resolves it. So opening /plan
   * directly — a bookmark, a shared link, a reload — planned the route
   * from "Pune city centre" while the browser had a fix all along, and
   * silently ordered the stops from the wrong point. This never opens a
   * dialog; it only picks up a permission the visitor has already given.
   */
  useResolveLocation();
  // Shared with the wizard, so a route built for the metro is not then
  // described as a walk. See travel-mode-store.
  const [mode, setMode] = useTravelMode();
  const [result, setResult] = useState<RouteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  /**
   * The route builder lives on this page rather than on one of its own.
   *
   * Building a route and then managing it were two pages and a navigation,
   * and they are one task: you build, look at it, and start reordering. The
   * handoff also meant the wizard's result screen and the planner showed the
   * same route in two different layouts with two different sets of numbers.
   *
   * Open by default when there is nothing to show, because an empty planner
   * has no other job. `?build=1` opens it over an existing plan — that is
   * what /start redirects to, so "Build my route" still means build even
   * for someone who already has stops saved.
   */
  const [buildRequested, setBuildRequested] = useState(false);

  /**
   * How thoroughly you intend to do it.
   *
   * This lived on the wizard's result screen, where it decided how many
   * mandals fitted the budget. Here it does the honest thing instead: the
   * stops are yours and it does not add or drop any, it changes how long
   * they are expected to take — queuing at Dagdusheth or looking from the
   * road is most of the difference in an evening.
   */
  const [pace, setPace] = useState<DarshanPace>('balanced');

  /** What the last build produced, so the planner can explain the result. */
  const [buildNote, setBuildNote] = useState<{ skipped: number; budgetMinutes: number } | null>(null);

  const bySlug = useMemo(
    () => new Map(ganpatis.map((g) => [g.slug, g])),
    [ganpatis]
  );

  const activeSlugs = sharedSlugs ?? planSlugs;

  const stops = useMemo(
    () => activeSlugs.map((s) => bySlug.get(s)).filter((g): g is Ganpati => Boolean(g)),
    [activeSlugs, bySlug]
  );

  /**
   * The station to start from in metro mode.
   *
   * Defaults to whichever station is nearest the first stop rather than to
   * a fixed one: a plan that begins in Shaniwar Peth should open on PMC,
   * not on Kasba Peth a kilometre south. Falls back to Kasba Peth when the
   * plan is empty or nowhere near the line — it is the nearest arrival
   * station to the densest part of the festival now that Mandai is
   * boarding-only.
   */
  const suggestedStation = useMemo(
    () => stationForRoute(stops)?.station ?? stationById('kasba-peth') ?? PRIMARY_STATIONS[0],
    [stops]
  );
  const [stationId, setStationId] = useState<string | null>(null);

  /**
   * The walk back to a station at the end of the night.
   *
   * Metro plans ended where the last mandal is. Getting there was routed
   * and drawn; getting home was a straight-line distance in a footnote,
   * which is the one leg of the evening where the lanes matter most —
   * they run one way, towards the mandals, and the walk back is the
   * direction they exist to prevent.
   *
   * So it is routed like every other leg, through the same /api/routes
   * that knows the lanes and the ways round them, and drawn on the map
   * with the rest of the plan.
   */
  const [returnLeg, setReturnLeg] = useState<{
    station: { id: string; name: string; lat: number; lng: number };
    distanceM: number;
    durationS: number;
    geometry: [number, number][] | null;
    nearerButHarder: { name: string; distanceM: number } | null;
  } | null>(null);
  const station = (stationId ? stationById(stationId) : null) ?? suggestedStation;


  const wantsBuild = searchParams.get('build') === '1';
  const showWizard =
    !sharedSlugs && (buildRequested || wantsBuild || (hydrated && stops.length === 0));

  const closeWizard = () => {
    setBuildRequested(false);
    // Drops ?build=1 so a refresh does not reopen the builder over the
    // route it has just produced.
    if (wantsBuild) router.replace('/plan');
  };

  /**
   * Two-wheeler plans start with a ride to parking.
   *
   * The peths are closed to traffic in the evening, so the stops cannot be
   * ridden between — the journey is one ride and then a walk, and
   * everything below treats the parking as the origin of that walk. Needs
   * a real position: guessing the rider is at the city centre would send
   * them to a parking chosen for somebody else.
   */
  /**
   * Anchored to a coarse grid, not to the exact fix.
   *
   * The position publishes again every time the rider moves twelve metres,
   * and this used to depend on the whole geolocation object — so choosing
   * the parking, the most expensive thing on this screen, ran again for
   * every one of them. Twelve metres cannot change which of twenty-three
   * car parks across the city is the right one: it moves the ride estimate
   * by about two seconds.
   *
   * Roughly a hundred metres, which is about half a minute of riding and
   * well inside the accuracy of a straight-line ride estimate. The choice
   * still follows the rider in, just once per block rather than once per
   * doorway.
   */
  const anchor = useMemo(() => {
    if (geo.status !== 'ready') return null;
    const grid = 0.001; // ~111 m of latitude
    return {
      lat: Math.round(geo.position.lat / grid) * grid,
      lng: Math.round(geo.position.lng / grid) * grid,
    };
  }, [geo]);

  /**
   * Deferred, so choosing the parking can never sit in front of a tap.
   *
   * It is down to 185 ms at twenty-five stops from 694, and it runs once
   * per block rather than once per fix — but it still runs during render,
   * and a rider who taps a mandal while it is working would wait for it.
   * Deferring lets React keep the interaction responsive and recompute the
   * parking behind it; the card is a few frames late, which nobody can
   * see, instead of the whole screen being a few hundred milliseconds
   * late, which everybody can.
   */
  const deferred = useDeferredValue(anchor);
  const anchorLat = deferred?.lat ?? null;
  const anchorLng = deferred?.lng ?? null;

  const parking = useMemo(() => {
    if (mode !== 'two_wheeler' || anchorLat === null || anchorLng === null || stops.length === 0) {
      return null;
    }
    return chooseParking({ lat: anchorLat, lng: anchorLng }, stops);
    // Deliberately the rounded pair rather than `anchor`, whose identity
    // changes with every fix even when the numbers do not.
  }, [mode, anchorLat, anchorLng, stops]);

  const origin: LatLng = useMemo(
    () =>
      mode === 'metro'
        ? { lat: station.lat, lng: station.lng }
        : parking
          ? { lat: parking.spot.lat, lng: parking.spot.lng }
          : geo.status === 'ready'
            ? geo.position
            : PUNE_CENTER,
    [mode, station, geo, parking]
  );

  /**
   * The mode the legs between stops are actually travelled in.
   *
   * On a two-wheeler that is walking, once the vehicle is parked. Using
   * the riding speed here is what made the old plans claim journeys
   * through barricaded lanes.
   */
  const legMode: TravelMode = legModeFor(mode);
  const originLabel =
    mode === 'metro'
      ? `${station.name} metro`
      : parking
        ? `${parking.spot.name} parking`
        : geo.status === 'ready'
          ? 'Your location'
          : 'Pune city centre';

  /**
   * Local estimate shown before (and instead of) any API call. Clearly an
   * estimate: straight-line distance × a detour factor.
   */
  const estimate = useMemo(() => {
    if (stops.length === 0) return null;
    let distance = 0;
    let previous = origin;
    for (const stop of stops) {
      distance += haversine(previous, { lat: stop.location.lat, lng: stop.location.lng });
      previous = { lat: stop.location.lat, lng: stop.location.lng };
    }
    const roadDistance = distance * DETOUR_FACTOR;
    return {
      distanceM: roadDistance,
      // Walking only. The ride is added once below, so it survives the
      // switch to routed numbers — it used to be folded in here and then
      // vanish the moment someone tapped Optimise, because the routed
      // duration covers the walk alone.
      durationS: estimateDurationSeconds(distance, legMode),
    };
  }, [stops, origin, legMode]);

  /**
   * Queuing time, which this view did not count at all.
   *
   * It showed travel only, so a five-mandal plan reported the walk and
   * nothing else — thirty-five minutes for an evening that realistically
   * takes three hours. Curated routes have always counted queuing; a plan
   * someone built themselves did not, which is the plan they are most
   * likely to trust.
   *
   * Live crowd decides which end of each mandal's own estimate applies, so
   * the number moves with the tracker instead of being fixed at build time.
   */
  const crowdState = useCrowdState();
  const darshanS = useMemo(
    () =>
      stops.reduce(
        (sum, g) =>
          sum + dwellMinutes(g, pace, crowdState.byMandalId[g.id]?.status ?? null) * 60,
        0
      ),
    [stops, crowdState, pace]
  );

  /**
   * One-way stretches this walk goes down.
   *
   * Computed from the plan's own order, not from the map view: the police
   * make the crowd one-directional through the narrowest lanes, no router
   * knows it, and the ordering above has already been priced against it.
   * All that is left is to say so — a visitor who walks down past
   * Dagdusheth and expects to come back up the same way cannot.
   */
  const oneWays = useMemo(
    () =>
      legMode === 'walk' && stops.length > 0
        ? flowsOnRoute([
            origin,
            ...stops.map((g) => ({ lat: g.location.lat, lng: g.location.lng })),
          ])
        : [],
    [legMode, origin, stops]
  );

  /**
   * Order a newly changed plan without waiting for Optimise.
   *
   * Until this, the stops sat in whatever order they were tapped in, and
   * the line drawn through them followed the lanes only where that
   * accidental order happened to agree with the crowd. Tapping Optimise
   * fixed it — but nobody should have to press a button to be told the
   * way they are allowed to walk.
   *
   * It runs on the SET of stops, not their order. Adding or removing a
   * mandal re-orders the plan; dragging the list to reorder it by hand
   * does not, because the set has not changed — otherwise this would undo
   * the drag on the next render, which is a worse bug than the one it
   * fixes.
   *
   * Local and lane-aware: optimizeLocally goes through optimizeOrder, so
   * the one-way rules apply. No network, and 2 ms for the whole
   * catalogue, so there is nothing to defer. Tapping Optimise still
   * upgrades the line to real routed geometry.
   */
  const lastOrderedSet = useRef<string | null>(null);
  useEffect(() => {
    // A shared plan keeps the order it was shared in. Somebody sent this
    // sequence deliberately, and re-ordering it on open would quietly
    // hand the recipient a different walk from the one they were given.
    if (sharedSlugs || !hydrated || stops.length < 2) return;

    const key = [...stops.map((g) => g.slug)].sort().join('|');
    if (lastOrderedSet.current === key) return;
    lastOrderedSet.current = key;

    const { order } = optimizeLocally(
      origin,
      stops.map((g) => ({ lat: g.location.lat, lng: g.location.lng })),
      legMode
    );
    const next = order.map((i) => stops[i].slug);
    if (next.some((slug, i) => slug !== stops[i].slug)) {
      startTransition(() => replace(next));
    }
  }, [sharedSlugs, hydrated, stops, origin, legMode, replace]);

  /**
   * Route the walk back, once the order is settled.
   *
   * Its own request rather than an extra stop on the plan's: the return
   * is not a stop somebody chose and must not be reordered into the
   * middle of the evening. optimize is false for the same reason — the
   * order of this one leg is not in question, only its line.
   *
   * Silent on failure. A plan that arrived is worth more than an error
   * about the way home, and the card simply does not show the leg.
   */
  const fetchReturnLeg = async (ordered: typeof stops) => {
    const last = ordered[ordered.length - 1];
    if (mode !== 'metro' || !last) { setReturnLeg(null); return; }
    const back = returnWalk({ lat: last.location.lat, lng: last.location.lng });
    if (!back) { setReturnLeg(null); return; }

    const to = { lat: back.station.lat, lng: back.station.lng };
    try {
      const response = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { lat: last.location.lat, lng: last.location.lng },
          // The way round comes first where there is one, so the walk
          // home does not go back up a lane the crowd is coming down.
          stops: [...back.via, to],
          mode: 'walk',
          optimize: false,
        }),
      });
      if (!response.ok) { setReturnLeg(null); return; }
      const data = (await response.json()) as RouteResult;
      setReturnLeg({
        station: { id: back.station.id, name: back.station.name, ...to },
        // The routed distance, not the straight line the card used to show.
        distanceM: data.distanceM ?? back.distanceM,
        durationS: data.durationS,
        geometry: data.geometry,
        nearerButHarder: back.nearerButHarder
          ? {
              name: back.nearerButHarder.station.name,
              distanceM: back.nearerButHarder.distanceM,
            }
          : null,
      });
    } catch {
      setReturnLeg(null);
    }
  };

  const optimize = async () => {
    if (stops.length < 2) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // `origin` is already the parking on a two-wheeler, and the legs
          // are walked from it — so the router is asked for the walk, not
          // for a ride through closed lanes.
          origin,
          stops: stops.map((s) => ({ lat: s.location.lat, lng: s.location.lng })),
          mode: legMode,
          optimize: true,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error ?? 'We couldn’t calculate this route.');
        return;
      }

      const data = (await response.json()) as RouteResult;
      setResult(data);

      // Apply the optimised ordering to the stored plan.
      const reordered = data.order.map((i) => stops[i].slug);
      startTransition(() => replace(reordered));
      void fetchReturnLeg(data.order.map((i) => stops[i]));
      trackEvent('plan_optimized', {
        props: { stops: stops.length, mode, by: data.optimizedBy },
      });
    } catch {
      setError('We couldn’t reach the routing service. Your stops are unchanged.');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Fetch the real routed line as soon as the plan settles.
   *
   * Every change to a plan clears the last result, and with no routed
   * geometry the map falls back to our own: lane paths where a lane
   * applies, and a STRAIGHT LINE everywhere else. Most legs have no lane —
   * only five of the sixteen mandals round the peths stand on one — so
   * the usual sight was a plan drawn as darts between mandals until
   * somebody pressed Optimise.
   *
   * Keyed on the SET of stops, the mode and the origin, deliberately the
   * same shape of key as the local ordering above. The request itself
   * re-orders the plan, which changes the stop ORDER — so keying on the
   * ordered list would refetch forever.
   *
   * Optimise is still there and still does something: it is how you ask
   * again after the answer has been thrown away, and it shows the work.
   */
  // Held in a ref, and updated in an effect rather than during render, so
  // the fetch below can call the latest closure without listing it as a
  // dependency — optimize is rebuilt every render and would refire this.
  const optimizeRef = useRef(optimize);
  useEffect(() => {
    optimizeRef.current = optimize;
  });

  const lastRoutedSet = useRef<string | null>(null);
  useEffect(() => {
    if (sharedSlugs || !hydrated || stops.length < 2) return;

    const key = [
      [...stops.map((g) => g.slug)].sort().join(','),
      legMode,
      origin.lat.toFixed(4),
      origin.lng.toFixed(4),
    ].join('|');
    if (lastRoutedSet.current === key) return;
    lastRoutedSet.current = key;

    void optimizeRef.current();
  }, [sharedSlugs, hydrated, stops, legMode, origin]);

  const adoptShared = () => {
    if (!sharedSlugs) return;
    replace(sharedSlugs);
    trackEvent('plan_created', { props: { source: 'shared-link', stops: sharedSlugs.length } });
    router.push('/plan');
  };

  if (!hydrated && !sharedSlugs) {
    return (
      <div className="px-4 py-10 text-center text-[14px] text-[var(--muted)]">
        Loading your darshan…
      </div>
    );
  }

  /* ---------------- Nothing planned yet: build one ---------------- */
  if (stops.length === 0 && !sharedSlugs) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="font-display text-[28px] font-extrabold tracking-tight text-[var(--chandan)]">
          Plan your darshan
        </h1>
        <p lang="mr" className="mt-1 text-[14px] text-[var(--muted)]">
          आज कुठे जावे?
        </p>

        {/* The builder, not a dead end telling you to go somewhere else. */}
        <div className="mt-5">
          <StartWizard
            mandals={ganpatis}
            embedded
            onDone={(built) => { setBuildNote(built); closeWizard(); }}
          />
        </div>
      </div>
    );
  }

  const totalDistance = result?.distanceM ?? estimate?.distanceM ?? null;
  const walkS = result?.durationS ?? estimate?.durationS ?? null;
  /**
   * The ride to the parking, added to whichever walking figure is in use.
   *
   * Both paths need it and only one had it: the local estimate folded the
   * ride in, the routed result did not, so optimising a two-wheeler plan
   * quietly cut the best part of an hour off the total.
   */
  const rideS = parking ? parking.rideMinutes * 60 : 0;
  const travelS = walkS === null ? null : walkS + rideS;
  const totalDuration = travelS === null ? null : travelS + darshanS;
  const isEstimate = !result || result.estimated;
  const crowdAdjusted = stops.some((g) => crowdState.byMandalId[g.id]?.status);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-bold text-[var(--chandan)]">
            {sharedSlugs ? 'A shared darshan' : 'Your darshan'}
          </h1>
          <p className="text-[13px] text-[var(--muted)]">
            {stops.length} {stops.length === 1 ? 'stop' : 'stops'}
            {!sharedSlugs && <> · from {originLabel}</>}
          </p>
        </div>
        {!sharedSlugs && (
          <SavePlanShare slugs={planSlugs} mode={mode} />
        )}
      </div>

      {sharedSlugs && (
        <div className="mt-4 rounded-[var(--radius-card)] border border-[var(--zendu)]/30 bg-[var(--zendu)]/[0.07] p-4">
          <p className="text-[14px] font-semibold text-[var(--chandan)]">
            Someone shared this route with you
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">
            It won&rsquo;t replace your own darshan unless you choose to use it.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={adoptShared}>Use this route</Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/plan">
                {planSlugs.length > 0 ? `Keep my ${planSlugs.length} stops` : 'Build my own'}
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* ---------------- Build a different route ---------------- */}
      {showWizard ? (
        <section className="mt-5 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--dhoop)] p-4">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-[12px] font-bold uppercase tracking-wide text-[var(--faint)]">
              Build a different route
            </h2>
            <button
              type="button"
              onClick={closeWizard}
              className="min-h-11 text-[13px] text-[var(--muted)] underline"
            >
              Cancel
            </button>
          </div>
          <p className="mb-4 text-[12px] leading-relaxed text-[var(--muted)]">
            Taking a new route replaces the {stops.length}{' '}
            {stops.length === 1 ? 'stop' : 'stops'} below.
          </p>
          <StartWizard
            mandals={ganpatis}
            embedded
            onDone={(built) => { setBuildNote(built); closeWizard(); }}
          />
        </section>
      ) : (
        !sharedSlugs && (
          <button
            type="button"
            onClick={() => setBuildRequested(true)}
            className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-[var(--shendur)]"
          >
            <Sparkles size={14} aria-hidden="true" />
            Build a different route
          </button>
        )
      )}

      {/* ---------------- What the last build left out ---------------- */}
      {buildNote && buildNote.skipped > 0 && (
        <p className="mt-4 rounded-[var(--radius-field)] border border-[var(--line)] bg-[var(--dhoop)] px-3 py-2.5 text-[12px] leading-relaxed text-[var(--muted)]">
          {buildNote.skipped} more {buildNote.skipped === 1 ? 'mandal' : 'mandals'} matched
          what you picked but wouldn&rsquo;t fit in{' '}
          {formatDuration(buildNote.budgetMinutes * 60)} — allow more time, or add
          them yourself.
        </p>
      )}

      {/* ---------------- Pace ---------------- */}
      {!sharedSlugs && (
        <div className="mt-4">
          <h2 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[var(--faint)]">
            How you&rsquo;ll do it
          </h2>
          <div className="scroll-x flex gap-2">
            {PACES.map((p) => (
              <Chip
                key={p.key}
                selected={pace === p.key}
                onClick={() => setPace(p.key)}
                className="whitespace-nowrap"
              >
                {p.label}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- Travel mode ---------------- */}
      <div className="scroll-x mt-4 flex gap-2">
        {MODES.map(({ key, label, icon: Icon }) => (
          <Chip
            key={key}
            selected={mode === key}
            onClick={() => { setMode(key); setResult(null); }}
            className="inline-flex items-center gap-1.5"
          >
            <Icon size={14} aria-hidden="true" />
            {label}
          </Chip>
        ))}
      </div>

      {/* ---------------- Origin ---------------- */}
      {mode === 'metro' && (
        <div className="mt-4 flex flex-col gap-4">
          <MetroJourneyCard
            alight={station}
            walkToFirstM={
              stops[0]
                ? haversine(
                    { lat: station.lat, lng: station.lng },
                    { lat: stops[0].location.lat, lng: stops[0].location.lng }
                  )
                : null
            }
            firstStop={
              stops[0]
                ? { lat: stops[0].location.lat, lng: stops[0].location.lng }
                : undefined
            }
            home={
              returnLeg
                ? {
                    station: returnLeg.station as never,
                    // Routed, so the number is the walk rather than the
                    // distance a bird would cover.
                    distanceM: returnLeg.distanceM,
                  }
                : returnStation(stops)
            }
            homeIsRouted={returnLeg != null}
            homeNearerButHarder={returnLeg?.nearerButHarder ?? null}
          />
          <MetroStationPicker
            value={station}
            onChange={(s) => { setStationId(s.id); setResult(null); }}
            userLocation={geo.status === 'ready' ? geo.position : null}
          />
        </div>
      )}

      {/*
        Two-wheeler mode waits for a position, and used to show nothing
        while it waited.

        Walking renders the moment the page does, because it falls back to
        the city centre for an origin. Two-wheeler cannot: which of
        twenty-three car parks is right depends on where the rider is, and
        a guess sends them to somebody else's parking. So the card simply
        was not there until a fix arrived — which is why picking
        two-wheeler from the start feels slow while switching to it from
        walking feels instant. It is the same wait; by the time you have
        been looking at a walking plan, the fix has already landed.

        The wait is now visible and explained rather than blank, which is
        the only honest thing to show: the answer genuinely is not known
        yet, and pretending otherwise would put a rider on the wrong side
        of the city.
      */}
      {mode === 'two_wheeler' && !parking && stops.length > 0 && geo.status !== 'denied' && (
        <div
          className="surface mt-4 rounded-[var(--radius-card)] border border-[var(--line)] p-4"
          aria-live="polite"
        >
          <p className="text-[13px] text-[var(--muted)]">
            {geo.status === 'ready'
              ? 'Working out where to leave the vehicle…'
              : 'Finding you, to work out where to leave the vehicle. The ride and the walk appear here.'}
          </p>
        </div>
      )}

      {/* The ride to the parking, which is the first leg of the plan. */}
      {parking && (
        <div className="mt-4">
          <ParkingRideCard
            choice={parking}
            walkToFirstM={
              stops[0]
                ? haversine(
                    { lat: parking.spot.lat, lng: parking.spot.lng },
                    { lat: stops[0].location.lat, lng: stops[0].location.lng }
                  )
                : null
            }
          />
        </div>
      )}

      {mode !== 'metro' && geo.status !== 'ready' && (
        <button
          type="button"
          onClick={requestLocation}
          className="mt-3 w-full rounded-[var(--radius-field)] border border-dashed border-[var(--line-strong)] px-3 py-2.5 text-left text-[13px] text-[var(--muted)]"
        >
          Starting from <span className="text-[var(--chandan)]">Pune city centre</span>.
          <span className="ml-1 font-semibold text-[var(--shendur)]">Use my location →</span>
        </button>
      )}

      {/* ---------------- Route map ---------------- */}
      <MiniMap
        mandals={stops}
        ordered
        routeGeometry={
          /* The walk back is part of the evening, so it is part of the
             line. Appended rather than merged into the plan's own legs:
             it belongs after the last stop and nowhere else. */
          result?.geometry
            ? returnLeg?.geometry
              ? [...result.geometry, ...returnLeg.geometry]
              : result.geometry
            : null
        }
        className="mt-4 h-64 w-full"
      />
      {!result?.geometry && stops.length > 1 && (
        <p className="mt-1.5 text-[12px] text-[var(--faint)]">
          Stops are connected in order. Tap Optimise to draw the actual walking
          path along the lanes.
        </p>
      )}

      {/* The crowd's own direction. Stated once per warning, in the order
          the walk meets them, and only when the walk actually goes down
          one — a notice shown to everybody is a notice nobody reads. */}
      {oneWays.length > 0 && (
        <div className="surface mt-3 rounded-[var(--radius-card)] border border-[var(--line-strong)] p-3">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--zendu)]">
            One way on foot
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {oneWays.map((w) => (
              <li key={w.name} className="text-[13px] leading-snug text-[var(--muted)]">
                {/* The instruction first, in the words someone standing on
                    the road can act on. The lane's name is how the map
                    labels it; it is not what they need to do. */}
                <span className="font-semibold text-[var(--chandan)]">
                  Walk {w.heading} <span aria-hidden="true">→</span> {w.towards}
                </span>
                <span className="mt-0.5 block text-[var(--faint)]">{w.name}</span>
                <span className="mt-0.5 block">{w.note}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-[var(--faint)]">
            Your stops are already ordered to walk with the crowd, not against
            it. On the map these are the blue lines — the arrows along them
            point the way you walk.
          </p>
        </div>
      )}

      {/* ---------------- Summary ---------------- */}
      <div className="mt-4 surface-raised rounded-[var(--radius-card)] border border-[var(--line-strong)] p-4">
        <div className="flex items-baseline gap-4">
          <div>
            <p className="text-[22px] font-bold leading-none text-[var(--chandan)]">
              {totalDistance !== null ? formatDistance(totalDistance) : '—'}
            </p>
            <p className="mt-1 text-[12px] text-[var(--faint)]">
              {parking ? 'on foot' : 'distance'}
            </p>
          </div>
          <div>
            <p className="text-[22px] font-bold leading-none text-[var(--chandan)]">
              {totalDuration !== null ? formatDuration(totalDuration) : '—'}
            </p>
            <p className="mt-1 text-[12px] text-[var(--faint)]">
              {parking ? 'ride + walk + darshan' : 'walk + darshan'}
            </p>
            {/* The provenance label stays exactly one of three known values.
                It is the page's statement about where this number came
                from, and appending anything to it makes that claim fuzzy —
                which is also why a test asserts on it anchored. The crowd
                note is a separate line. */}
            <p className="mt-0.5 text-[11px] text-[var(--faint)]">
              {isEstimate
                ? 'estimated'
                : result?.durationSource === 'provider'
                  ? `routed · ${PROVIDER_NAME[result.provider ?? ''] ?? 'router'}`
                  : 'from routed distance'}
            </p>
            {crowdAdjusted && (
              <p className="mt-0.5 text-[11px] text-[var(--zendu)]">
                queues from live reports
              </p>
            )}
          </div>
        </div>

        {isEstimate ? (
          <p className="mt-2.5 text-[12px] leading-relaxed text-[var(--faint)]">
            Estimated from straight-line distance (×1.71, measured against real
            walks in the peths). Tap Optimise for a distance that follows the
            actual lanes.
          </p>
        ) : result?.durationSource === 'derived' ? (
          <p className="mt-2.5 text-[12px] leading-relaxed text-[var(--faint)]">
            Distance follows real streets. The time is worked out from that
            distance at walking pace, because the routing service does not
            model {MODES.find((m) => m.key === mode)?.label.toLowerCase()} speed.
          </p>
        ) : null}

        {error && (
          <p role="alert" className="mt-2.5 text-[12px] text-[#ef8f88]">{error}</p>
        )}

        <Button
          onClick={optimize}
          variant="secondary"
          size="sm"
          disabled={stops.length < 2 || busy}
          full
          className="mt-3"
        >
          {busy ? (
            <><Loader2 size={15} className="animate-spin" aria-hidden="true" />Optimising…</>
          ) : (
            <><Sparkles size={15} aria-hidden="true" />Optimise order</>
          )}
        </Button>
      </div>

      {!sharedSlugs && (
        <StartRouteButton
          stops={stops}
          mode={mode}
          source="planner"
          label="Start my darshan"
          // The walk begins where the vehicle is left, not where the rider
          // is standing when they tap.
          startFrom={
            parking
              ? {
                  point: { lat: parking.spot.lat, lng: parking.spot.lng },
                  label: 'parking',
                }
              : null
          }
        />
      )}

      {/* ---------------- Stops ---------------- */}
      <h2 className="mb-2 mt-6 text-[13px] font-bold uppercase tracking-wide text-[var(--faint)]">
        Route order
      </h2>

      {sharedSlugs ? (
        <ol className="space-y-2">
          {stops.map((stop, index) => (
            <li
              key={stop.slug}
              className="flex items-center gap-3 surface rounded-[var(--radius-card)] border border-[var(--line)] p-2.5"
            >
              <span
                aria-hidden="true"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[var(--shendur)]/40 text-[12px] font-bold text-[var(--shendur)]"
              >
                {index + 1}
              </span>
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                <GanpatiImage ganpati={stop} sizes="48px" />
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/ganpati/${stop.slug}`}
                  className="block truncate text-[14px] font-semibold text-[var(--chandan)]"
                >
                  {stop.name}
                </Link>
                <p className="truncate text-[12px] text-[var(--faint)]">{stop.area.name}</p>
                <CrowdBadgeWithWait mandalId={stop.id} prior={stop} className="mt-1" />
              </div>
            </li>
          ))}
        </ol>
      ) : (
      <Reorder.Group
        axis="y"
        values={planSlugs}
        onReorder={(next) => { replace(next as string[]); setResult(null); }}
        className="space-y-2"
      >
        {stops.map((stop, index) => (
          <StopRow
            key={stop.slug}
            stop={stop}
            index={index}
            legDurationS={result?.legs[index]?.durationS ?? null}
            onRemove={() => { remove(stop.slug); setResult(null); }}
          />
        ))}
      </Reorder.Group>
      )}

      {!sharedSlugs && (
        <button
          type="button"
          onClick={() => { replace([]); setResult(null); }}
          className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-[var(--faint)]"
        >
          <Trash2 size={14} aria-hidden="true" />
          Clear darshan
        </button>
      )}
    </div>
  );
}

/* ---------------- Stop row ---------------- */

function StopRow({
  stop, index, legDurationS, onRemove,
}: {
  stop: Ganpati;
  index: number;
  legDurationS: number | null;
  onRemove: () => void;
}) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={stop.slug}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-3 surface rounded-[var(--radius-card)] border border-[var(--line)] p-2.5"
    >
      <span
        aria-hidden="true"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[var(--shendur)]/40 text-[12px] font-bold text-[var(--shendur)]"
      >
        {index + 1}
      </span>

      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
        <GanpatiImage ganpati={stop} sizes="48px" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-[var(--chandan)]">{stop.name}</p>
        <p className="truncate text-[12px] text-[var(--faint)]">
          {stop.area.name}
          {legDurationS !== null && (
            <> · <span className="text-[var(--zendu)]">{formatDuration(legDurationS)} leg</span></>
          )}
        </p>
        <CrowdBadgeWithWait mandalId={stop.id} prior={stop} className="mt-1" />
      </div>

      <button
        type="button"
        onPointerDown={(e) => controls.start(e)}
        aria-label={`Reorder ${stop.name}`}
        className="grid h-11 w-8 shrink-0 cursor-grab touch-none place-items-center text-[var(--faint)]"
      >
        <GripVertical size={16} aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${stop.name} from darshan`}
        className="grid h-11 w-8 shrink-0 place-items-center text-[var(--faint)]"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </Reorder.Item>
  );
}
