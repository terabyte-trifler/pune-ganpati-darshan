import { PARKING, type ParkingSpot } from '@/content/parking';
import { haversine, estimateDurationSeconds, type LatLng } from '@/lib/geo';
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
  candidates: ParkingSpot[] = PARKING
): ParkingChoice | null {
  if (mandals.length === 0 || candidates.length === 0) return null;

  const points = mandals.map((m) => ({ lat: m.location.lat, lng: m.location.lng }));

  let best: ParkingChoice | null = null;

  for (const spot of candidates) {
    const at: LatLng = { lat: spot.lat, lng: spot.lng };
    const ride = rideSeconds(origin, at);

    // The walk is planned from the parking, not from the person: that is
    // the whole point of the mode.
    const walk = optimizeLocally(at, points, 'walk');
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
    };
  }

  return best;
}
