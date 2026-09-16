import { METRO_STATIONS, type MetroStation, type NearestStation } from '@/lib/metro';
import { legCostFactor } from '@/services/pedestrian-flow';
import { haversine, type LatLng } from '@/lib/geo';

/**
 * Which station to walk to at the end of the night.
 *
 * Getting there and getting home are not the same problem, and the app
 * was solving them the same way. A station to alight at is chosen for a
 * route that has not started; a station to walk to afterwards is chosen
 * from where somebody is standing, at the hour the police lanes are in
 * force — and the lanes are the whole difficulty, because they are
 * one-directional. Going back the way you came is the one thing they
 * exist to stop.
 *
 * returnStation ranked by straight-line distance, which cannot see that.
 * The nearest station to a mandal is often the one you arrived from, and
 * the walk back to it runs up a lane the crowd is coming down.
 *
 * So candidates are priced by what the walk actually costs rather than by
 * how far away they look. legCostFactor is the same rule the planner
 * orders stops with: a leg that has to come round costs what coming round
 * costs, and a leg with no legal line at all is priced as one you cannot
 * walk.
 */

/** Beyond this, walking to a station is not the answer anyway. */
const RETURN_MAX_M = 2_500;

/**
 * A leg the lanes make materially dearer than it looks.
 *
 * Under this, the difference is rounding on a straight-line estimate and
 * not worth preferring one station over another for.
 */
const MATERIAL_FACTOR = 1.25;

/**
 * Ways round, for a walk to a station that cannot be made legal directly.
 *
 * The detour chains in content/lane-detours run between mandals, because
 * that is what could be searched for exhaustively. A station is neither
 * end of one, so the walk to it gets whatever the per-leg repair can
 * manage — which is almost always enough: of the twenty-eight mandals
 * near a lane, twenty-seven reach their station without touching one the
 * wrong way.
 *
 * The exception is Tulshibaug, which can only be left south, west or east
 * and sits just north of the lane running down to Gotiram Bhaiya chowk.
 * Measured: straight to Mandai is 450 m with 35 m walked against the
 * crowd; out to Mandai chowk first is 473 m and clean. Twenty-three metres
 * to obey the lane.
 *
 * Keyed by how close the walk starts to the mandal, for the same reason
 * the other tables are: the planner passes a point, not a name.
 */
const RETURN_DETOURS: {
  fromAt: LatLng;
  stationId: string;
  via: LatLng[];
  note: string;
}[] = [
  {
    // Tulshibaug Ganpati -> Mandai
    fromAt: { lat: 18.514268, lng: 73.855306 },
    stationId: 'mandai',
    via: [{ lat: 18.513445, lng: 73.855866 }],
    note: 'out to Mandai chowk, rather than down the lane the crowd comes up',
  },
];

/** How close a walk has to start to count as starting at that mandal. */
const FROM_MATCH_M = 25;

export interface ReturnWalk {
  station: MetroStation;
  /** Straight-line metres, which is what the card has always shown. */
  distanceM: number;
  /** What the walk costs once the lanes are priced in. */
  effectiveM: number;
  /** Waypoints that keep the walk out of a one-way lane. Usually empty. */
  via: LatLng[];
  /**
   * The station that is nearer on paper but dearer on foot, if the lanes
   * changed the answer. Exists so the card can say why, rather than
   * quietly sending somebody past a station they can see.
   */
  nearerButHarder: NearestStation | null;
}

export function returnWalk(
  from: LatLng,
  stations: MetroStation[] = METRO_STATIONS,
  maxDistanceM = RETURN_MAX_M
): ReturnWalk | null {
  const priced = stations
    .map((station) => {
      const to = { lat: station.lat, lng: station.lng };
      const distanceM = haversine(from, to);
      return {
        station,
        distanceM,
        effectiveM: distanceM * legCostFactor(from, to, 'walk'),
      };
    })
    .filter((c) => c.distanceM <= maxDistanceM);

  if (priced.length === 0) return null;

  const best = priced.reduce((a, b) => (b.effectiveM < a.effectiveM ? b : a));
  const nearest = priced.reduce((a, b) => (b.distanceM < a.distanceM ? b : a));

  /**
   * Only mention the nearer station when the lanes are the reason.
   *
   * If it lost by a few metres of rounding, naming it explains nothing and
   * reads as the app second-guessing itself.
   */
  const lanesDecided =
    nearest.station.id !== best.station.id &&
    nearest.effectiveM > nearest.distanceM * MATERIAL_FACTOR;

  const detour = RETURN_DETOURS.find(
    (d) =>
      d.stationId === best.station.id && haversine(from, d.fromAt) <= FROM_MATCH_M
  );

  return {
    station: best.station,
    via: detour?.via ?? [],
    distanceM: Math.round(best.distanceM),
    effectiveM: Math.round(best.effectiveM),
    nearerButHarder: lanesDecided
      ? { station: nearest.station, distanceM: Math.round(nearest.distanceM) }
      : null,
  };
}
