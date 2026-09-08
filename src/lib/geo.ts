/**
 * Pure geo helpers. No dependencies, no network — these run on the server,
 * in the browser and offline, and are unit-tested.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export const PUNE_CENTER: LatLng = { lat: 18.5204, lng: 73.8567 };

/** Bounding box of the walkable old-peth core, used for default map framing. */
export const PETH_BOUNDS = { south: 18.5, west: 73.84, north: 18.526, east: 73.865 };

const EARTH_RADIUS_M = 6371008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Straight-line distance understates real travel. This factor approximates
 * street-network distance for *sorting and rough estimates only* — it is
 * never presented as a routed distance.
 *
 * Calibrated against real pedestrian routing over 22 mandal pairs in the
 * peth core (tools/calibrate-detour.mjs): median ×1.71, mean ×1.80, range
 * ×1.26–×2.83. The previous value of 1.3 was a guess and understated real
 * walks by roughly 30%.
 *
 * The residual error is not random: short hops detour proportionally more
 * (×2.4–2.8 under 400 m) because the peth grid rarely lets you walk
 * directly. A distance-dependent curve would fit better, but 22 samples is
 * too few to justify one — and any estimate is replaced by a real routed
 * value as soon as the router is reachable.
 */
export const DETOUR_FACTOR = 1.71;

/** Metres per second by mode, tuned for festival-period congestion. */
export const MODE_SPEED_MPS = {
  walk: 1.1,
  two_wheeler: 3.6,
  drive: 3.1,
  transit: 3.0,
} as const;

export type TravelMode = keyof typeof MODE_SPEED_MPS;

/** Rough duration estimate used before Routes API is called. */
export function estimateDurationSeconds(distanceM: number, mode: TravelMode): number {
  return (distanceM * DETOUR_FACTOR) / MODE_SPEED_MPS[mode];
}

/** "450 m" / "1.2 km" — Indian-English conventions, no trailing zeros. */
export function formatDistance(metres: number): string {
  if (!Number.isFinite(metres) || metres < 0) return '—';
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`;
  const km = metres / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

/** "6 min" / "1 hr 42 min" */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const mins = Math.round(seconds / 60);
  if (mins < 1) return '<1 min';
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem === 0 ? `${hrs} hr` : `${hrs} hr ${rem} min`;
}

/** Bounding box covering all points, with padding in degrees. */
export function boundsOf(points: LatLng[], padding = 0.002) {
  if (points.length === 0) return PETH_BOUNDS;
  let south = Infinity, west = Infinity, north = -Infinity, east = -Infinity;
  for (const p of points) {
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
    west = Math.min(west, p.lng);
    east = Math.max(east, p.lng);
  }
  return {
    south: south - padding,
    west: west - padding,
    north: north + padding,
    east: east + padding,
  };
}
