import { PARKING, type ParkingSpot } from '@/content/parking';
import { haversine, estimateDurationSeconds, metresToPath, type LatLng } from '@/lib/geo';
import { ROAD_CLOSURES } from '@/content/diversions';
import { optimizeLocally } from '@/services/route-optimizer';

/**
 * Where to leave the two-wheeler.
 *
 * ---------------------------------------------------------------------
 * Why two-wheeler mode needed this at all.
 *
 * It used to plan exactly like walking, only faster: every leg between
 * mandals costed at 3.6 m/s. That is wrong in the one way that matters —
 * the peth core is closed to traffic during the festival, so those legs
 * cannot be ridden at any speed. The plan quietly assumed a journey the
 * police have barricaded.
 *
 * What people actually do is ride to somewhere they can leave the vehicle
 * and walk the peths from there. So that is what this plans: one ride,
 * then a walk.
 *
 * ---------------------------------------------------------------------
 * What "best" means here, and why it is not "nearest".
 *
 * The nearest parking to the rider can be the wrong end of the peths from
 * everything they want to see, and the parking nearest the mandals can be
 * a long ride the wrong way. So every candidate is scored on the whole
 * journey — ride to it, plus the walking tour of the chosen mandals
 * starting from it — and the best total wins. A spot two minutes further
 * to ride that saves ten minutes of walking is the better answer, and
 * only a whole-journey score can see that.
 *
 * The walk is optimised per candidate with the same optimiser the rest of
 * the planner uses, so the comparison is like for like rather than a
 * straight-line proxy.
 */

/**
 * After this hour, in IST, the police closures are in force.
 *
 * Their own layer is titled "Road Closures after 17:00", so the hour is
 * theirs and not an assumption made here.
 */
export const CLOSURE_FROM_HOUR_IST = 17;

/**
 * How close a parking has to be to a closed stretch for its own approach
 * to be treated as closed.
 *
 * 60 m is about a block: close enough that the last bit of road in is
 * almost certainly the closed stretch itself.
 *
 * Being on a closed road does NOT remove a parking from consideration.
 * The police close a road; they do not remove the parking beside it, and
 * riders reach such places every evening by coming round another way. So
 * this costs the ride a detour instead — see CLOSURE_DETOUR_FACTOR.
 */
export const CLOSED_APPROACH_M = 60;

/**
 * What a closure adds to a ride that has to go round it.
 *
 * A guess, and labelled as one. The app has no router that knows the
 * closures, so it cannot trace the actual diversion; what it can do is
 * stop pretending the ride is unaffected. A quarter more riding is the
 * scale of going round one closed stretch to the next parallel road in
 * the peth grid.
 *
 * It is applied to the whole ride rather than to a segment because the
 * diversion's position is unknown — and erring high is the safe
 * direction, since it only ever moves the choice toward a parking the
 * closures do not touch.
 */
export const CLOSURE_DETOUR_FACTOR = 1.25;

/** IST hour, as a number, for a moment. */
function istHour(at: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata',
    }).format(at)
  );
}

/** True when the police closures are in force at this moment. */
export function closuresInForce(at: Date = new Date()): boolean {
  const hour = istHour(at);
  // Until the small hours: the plan is an evening one, and a ride at 01:00
  // is the same evening's traffic as one at 23:00.
  return hour >= CLOSURE_FROM_HOUR_IST || hour < 5;
}

/** Parking whose own approach is a road the police close in the evening. */
export function isOnClosedRoad(spot: ParkingSpot): boolean {
  return ROAD_CLOSURES.some(
    (c) => metresToPath({ lat: spot.lat, lng: spot.lng }, c.path) <= CLOSED_APPROACH_M
  );
}

/**
 * How far from the direct line a closure still counts as "on the way".
 *
 * The real ride follows roads this app cannot see, so the straight line
 * between rider and parking is a proxy for it. Generous, because the
 * useful claim is soft — "expect diversions on the way in" — and a
 * warning that fires slightly too often costs nothing, while one that
 * misses the closure the rider actually meets is worse than silence.
 */
export const APPROACH_CORRIDOR_M = 150;

/** Points along a line, for testing a corridor rather than an end point. */
function sampleLine(a: LatLng, b: LatLng, steps = 24): LatLng[] {
  const out: LatLng[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    out.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });
  }
  return out;
}

/**
 * Does the way in run into a road that closes in the evening?
 *
 * Deliberately phrased as a question about the direct line, because that
 * is all this can honestly answer — the app has no router that knows the
 * closures, so it cannot say the ride is blocked, only that closed roads
 * lie across the way and a diversion is likely.
 */
export function approachMeetsClosure(origin: LatLng, spot: ParkingSpot): boolean {
  const line = sampleLine(origin, { lat: spot.lat, lng: spot.lng });
  return ROAD_CLOSURES.some((c) =>
    line.some((p) => metresToPath(p, c.path) <= APPROACH_CORRIDOR_M)
  );
}

export interface ParkingChoice {
  spot: ParkingSpot;
  /** Riding from where the person is now to the parking. */
  rideMinutes: number;
  /** Walking the whole mandal circuit from that parking. */
  walkMinutes: number;
  /** Ride plus walk. Darshan time is added by the caller. */
  travelMinutes: number;
  /** The mandal order that walk assumes, as indices into the input. */
  order: number[];
  /**
   * True when the ride to this parking was costed with a diversion,
   * because closed roads lie on the way. Surfaced so the rider expects
   * the diversion instead of meeting it as a surprise.
   */
  detouredForClosures: boolean;
  /** True when the closures were in force for this plan at all. */
  closuresInForce: boolean;
}

/**
 * Straight-line ride distance is multiplied by DETOUR_FACTOR inside
 * estimateDurationSeconds, which is tuned for the peth grid. A ride in
 * from outside the city follows bigger roads and detours less, but
 * over-estimating the ride is the safe direction: it costs the plan a
 * mandal rather than stranding someone.
 */
function rideSeconds(from: LatLng, to: LatLng): number {
  return estimateDurationSeconds(haversine(from, to), 'two_wheeler');
}

/**
 * The best parking for this ride and these mandals, or null if there is
 * nothing to plan.
 *
 * `candidates` defaults to the published police list. It is a parameter so
 * tests can pin behaviour against a small fixture rather than 23 real
 * coordinates that may be re-captured later.
 */
export function chooseParking(
  origin: LatLng,
  mandals: { location: LatLng }[],
  candidates: ParkingSpot[] = PARKING,
  /** When the ride happens. Decides whether the closures are in force. */
  at: Date = new Date()
): ParkingChoice | null {
  if (mandals.length === 0 || candidates.length === 0) return null;

  /**
   * Closures change the cost of a ride, not whether a parking exists.
   *
   * An earlier version dropped any parking on a closed road. That was
   * wrong twice: the police close roads rather than parking, and riders
   * reach those places every evening by coming round another way — and it
   * would have thrown away good parking for a diversion of a few minutes.
   * So a closed approach is priced as a longer ride and the spot stays in
   * the running, which is what "reroute" actually means.
   */
  const inForce = closuresInForce(at);

  const points = mandals.map((m) => ({ lat: m.location.lat, lng: m.location.lng }));

  let best: ParkingChoice | null = null;

  for (const spot of candidates) {
    const point: LatLng = { lat: spot.lat, lng: spot.lng };

    // Priced, not excluded: a closed road on the way means a longer ride,
    // and the whole-journey score decides whether it is still the best
    // place to leave the vehicle.
    const detoured =
      inForce && (isOnClosedRoad(spot) || approachMeetsClosure(origin, spot));
    const ride = rideSeconds(origin, point) * (detoured ? CLOSURE_DETOUR_FACTOR : 1);

    // The walk is planned from the parking, not from the person: that is
    // the whole point of the mode.
    const walk = optimizeLocally(point, points, 'walk');
    // `totalCost` is null when a leg is impassable. A parking whose walk
    // cannot be costed is not a parking we can recommend, so it is skipped
    // rather than scored as though the walk were free.
    if (walk.totalCost === null) continue;

    const travelMinutes = Math.round((ride + walk.totalCost) / 60);
    if (best && travelMinutes >= best.travelMinutes) continue;

    best = {
      spot,
      rideMinutes: Math.round(ride / 60),
      walkMinutes: Math.round(walk.totalCost / 60),
      travelMinutes,
      order: walk.order,
      detouredForClosures: detoured,
      closuresInForce: inForce,
    };
  }

  return best;
}
