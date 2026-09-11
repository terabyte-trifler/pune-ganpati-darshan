'use client';

import { useMemo, useState } from 'react';
import { Navigation, LocateFixed, Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useGeolocation } from '@/hooks/useGeolocation';
import { haversine, formatDistance, type LatLng } from '@/lib/geo';
import { trackEvent } from '@/services/analytics';
import type { Ganpati, TravelMode } from '@/types/ganpati';

/**
 * Hands a set of stops to Google Maps for turn-by-turn navigation, starting
 * from where the visitor actually is.
 *
 * Shared by curated routes, the planner and shared plans, so all three get
 * the same waypoint handling. The planner previously built its own maps URL
 * and passed every stop straight through, which silently exceeded Google's
 * limit on any plan past ten stops.
 *
 * Navigation is deliberately not reimplemented: during Ganeshotsav many peth
 * roads are closed to vehicles and pedestrianised, and Google has that live
 * where this app does not. The universal `dir/?api=1` URL opens the installed
 * app when there is one and the web otherwise.
 *
 * Location is requested only on tap, and the coordinates go into the maps URL
 * — they are never sent to this app's servers.
 */

/**
 * Google Maps accepts at most 9 intermediate waypoints, so 11 points in
 * total. Longer routes are split rather than silently truncated: dropping
 * stops from a 12-stop circuit without saying so would send someone off with
 * a route quietly missing its end.
 */
const MAX_WAYPOINTS = 9;
const MAX_POINTS_PER_LEG = MAX_WAYPOINTS + 2;

function mapsUrl(origin: LatLng | null, stops: Ganpati[], mode: TravelMode) {
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');

  if (origin) url.searchParams.set('origin', `${origin.lat},${origin.lng}`);
  else {
    const first = stops[0];
    url.searchParams.set('origin', `${first.location.lat},${first.location.lng}`);
  }

  const destination = stops[stops.length - 1];
  url.searchParams.set('destination', `${destination.location.lat},${destination.location.lng}`);
  url.searchParams.set('destination_place_id', destination.location.googlePlaceId ?? '');
  if (!destination.location.googlePlaceId) url.searchParams.delete('destination_place_id');

  const intermediate = origin ? stops.slice(0, -1) : stops.slice(1, -1);
  if (intermediate.length > 0) {
    url.searchParams.set(
      'waypoints',
      intermediate.map((s) => `${s.location.lat},${s.location.lng}`).join('|')
    );
  }

  // Metro routes are walked between stops — the train got you to the
  // station, and Google's transit directions between two mandals 400 m
  // apart would offer a bus nobody takes.
  url.searchParams.set('travelmode', mode === 'two_wheeler' ? 'driving' : 'walking');
  return url.toString();
}

/** Splits a long route into legs Google Maps can actually take. */
function splitIntoLegs(stops: Ganpati[], hasOrigin: boolean): Ganpati[][] {
  const capacity = hasOrigin ? MAX_POINTS_PER_LEG - 1 : MAX_POINTS_PER_LEG;
  if (stops.length <= capacity) return [stops];

  const legs: Ganpati[][] = [];
  let index = 0;
  while (index < stops.length) {
    const leg = stops.slice(index, index + capacity);
    legs.push(leg);
    // Each following leg begins where the previous one ended, so the join is
    // continuous rather than a gap.
    index += capacity - 1;
    if (legs.length > 5) break;
  }
  return legs;
}

/**
 * How close you must be for "the nearest stop" to mean anything.
 *
 * Every mandal in the catalogue sits inside about three kilometres of
 * every other, so from far enough away one of them is always marginally
 * nearest and the difference is noise. Someone in Hinjewadi is fifteen
 * kilometres out: rotating their route to stop 13 because it happens to
 * be a few hundred metres closer than stop 1 is arithmetically true and
 * practically absurd.
 *
 * Worse, it contradicted the advice directly above it. The metro card
 * says "get off at Kasba Peth"; the route then began at Kesariwada in
 * Narayan Peth, 1.2 km from that station, with twelve mandals walked
 * past on the way. That is the exact visitor this feature exists for.
 *
 * Inside this radius you are standing in the peths and joining the route
 * where you are is the sensible thing. Outside it you are travelling to
 * the route, and it should start at its beginning.
 */
const JOIN_ROUTE_RADIUS_M = 1_500;

export function StartRouteButton({
  stops, mode, source, label, preserveOrder = false,
}: {
  stops: Ganpati[];
  mode: TravelMode;
  /** Where this was launched from — recorded in analytics only. */
  source: string;
  /** Wording for the located primary action. */
  label?: string;
  /**
   * The stop order was chosen deliberately and must not be rotated by
   * default.
   *
   * A curated route's order is an argument, not a convenience: "Every
   * mandal, from Kasba" puts Dagdusheth ninth precisely so its queue is
   * forty-five minutes rather than two hours, and starting at whichever
   * stop happens to be nearest throws that away silently. A plan the
   * visitor built themselves has no such claim on its order, so there the
   * default stays as it was.
   *
   * The checkbox is still offered either way — someone already standing
   * mid-route may genuinely want to join it there.
   */
  preserveOrder?: boolean;
}) {
  const { state, request } = useGeolocation();
  const [reorderFromMe, setReorderFromMe] = useState(!preserveOrder);
  const origin = state.status === 'ready' ? state.position : null;

  /** Distance from the visitor to where the route begins. */
  const distanceToStart = useMemo(() => {
    if (!origin || stops.length === 0) return null;
    const first = stops[0];
    return haversine(origin, { lat: first.location.lat, lng: first.location.lng });
  }, [origin, stops]);

  /** The nearest stop, so a visitor already inside the route can join it. */
  /**
   * The nearest stop — but only when "nearest" is a real choice.
   *
   * Returns 0 (the route's own first stop) whenever the visitor is
   * further from the whole route than JOIN_ROUTE_RADIUS_M, which also
   * hides the reorder checkbox, because there is nothing useful to
   * offer someone who is not there yet.
   */
  const nearestIndex = useMemo(() => {
    if (!origin) return 0;
    let best = 0;
    let bestDistance = Infinity;
    stops.forEach((s, i) => {
      const d = haversine(origin, { lat: s.location.lat, lng: s.location.lng });
      if (d < bestDistance) { bestDistance = d; best = i; }
    });
    return bestDistance <= JOIN_ROUTE_RADIUS_M ? best : 0;
  }, [origin, stops]);

  const ordered = useMemo(() => {
    if (!origin || !reorderFromMe || nearestIndex === 0) return stops;
    // Start at whichever stop is closest, then continue in the route's order
    // and pick up the earlier stops at the end.
    return [...stops.slice(nearestIndex), ...stops.slice(0, nearestIndex)];
  }, [stops, origin, reorderFromMe, nearestIndex]);

  const legs = useMemo(
    () => splitIntoLegs(ordered, Boolean(origin)),
    [ordered, origin]
  );

  const open = (leg: Ganpati[], index: number) => {
    trackEvent('plan_started', {
      props: { source, leg: index, located: Boolean(origin) },
    });
    window.open(mapsUrl(index === 0 ? origin : null, leg, mode), '_blank', 'noopener');
  };

  return (
    <div className="mt-4">
      {!origin ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => { trackEvent('location_enabled'); request(); }}
              size="md"
              className="flex-1"
              disabled={state.status === 'locating'}
            >
              {state.status === 'locating' ? (
                <><Loader2 size={16} className="animate-spin" aria-hidden="true" />Finding you…</>
              ) : (
                <><LocateFixed size={16} aria-hidden="true" />Start from my location</>
              )}
            </Button>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--faint)]">
            {state.status === 'denied'
              ? 'Location is off in your browser.'
              : state.status === 'unavailable'
                ? 'We couldn’t get your location.'
                : 'Used to start navigation from where you are. It goes straight to Google Maps, not to us.'}
          </p>
          {state.status !== 'idle' && state.status !== 'locating' && (
            <Button
              onClick={() => open(legs[0], 0)}
              variant="secondary"
              size="md"
              full
              className="mt-2"
            >
              <Navigation size={16} aria-hidden="true" />
              Open the route in Google Maps anyway
            </Button>
          )}
        </>
      ) : (
        <>
          <p className="mb-2 flex items-center gap-1.5 text-[13px] text-[var(--muted)]">
            <MapPin size={13} aria-hidden="true" className="text-[var(--tulsi)]" />
            {/* Says where the route will actually begin, which is not
                always the nearest stop — a curated order is kept unless
                the visitor asks for it to be rotated. */}
            {reorderFromMe && nearestIndex > 0 ? (
              <>
                Starting at stop {nearestIndex + 1},{' '}
                {stops[nearestIndex].name.replace(/^(Shri|Shrimant)\s+/i, '')} —
                the closest to you.
              </>
            ) : distanceToStart !== null ? (
              <>
                Starts at {stops[0].name.replace(/^(Shri|Shrimant)\s+/i, '')},{' '}
                {formatDistance(distanceToStart)} from you.
              </>
            ) : (
              <>Starts at {stops[0].name.replace(/^(Shri|Shrimant)\s+/i, '')}.</>
            )}
          </p>

          {nearestIndex > 0 && (
            <label className="mb-3 flex items-center gap-2 text-[13px] text-[var(--muted)]">
              <input
                type="checkbox"
                checked={reorderFromMe}
                onChange={(e) => setReorderFromMe(e.target.checked)}
                className="h-4 w-4 accent-[var(--shendur)]"
              />
              Begin at the nearest stop instead of the first
            </label>
          )}

          {legs.map((leg, i) => (
            <Button
              key={i}
              onClick={() => open(leg, i)}
              size="md"
              full
              variant={i === 0 ? 'primary' : 'secondary'}
              className={i > 0 ? 'mt-2' : ''}
            >
              <Navigation size={16} aria-hidden="true" />
              {legs.length === 1
                ? (label ?? 'Start in Google Maps')
                : `Open part ${i + 1} of ${legs.length} (${leg.length} stops)`}
            </Button>
          ))}

          {legs.length > 1 && (
            <p className="mt-2 text-[12px] leading-relaxed text-[var(--faint)]">
              Google Maps takes up to {MAX_WAYPOINTS} stops between start and
              finish, so this route opens in {legs.length} parts. Each part
              begins where the last one ended — no stop is skipped.
            </p>
          )}
        </>
      )}
    </div>
  );
}
