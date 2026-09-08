import 'server-only';

import { serverEnv } from '@/lib/env.server';
import type { LatLng } from '@/lib/geo';
import type { TravelMode } from '@/types/ganpati';

/**
 * Google Routes API (v2) wrapper. Server-only: the Routes key is IP-restricted
 * and must never reach the browser (§30).
 *
 * Cost control (§58):
 *  - Field masks request only the three fields we render. Routes bills by
 *    SKU tier and an unmasked request is both slower and more expensive.
 *  - `computeRouteMatrix` is called once per optimisation, not per candidate
 *    ordering — the solver runs against the returned matrix locally.
 *  - Callers cache results on the plan row (`route_computed_at`), so
 *    re-opening a shared plan costs nothing.
 */

const ROUTES_ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const MATRIX_ENDPOINT = 'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix';

/** Our travel modes → Routes API RouteTravelMode. */
const TRAVEL_MODE: Record<TravelMode, string> = {
  walk: 'WALK',
  two_wheeler: 'TWO_WHEELER',
  drive: 'DRIVE',
  transit: 'TRANSIT',
};

/**
 * Traffic-aware routing is only supported for DRIVE and TWO_WHEELER;
 * sending it for WALK/TRANSIT is rejected by the API.
 */
function routingPreference(mode: TravelMode) {
  return mode === 'drive' || mode === 'two_wheeler'
    ? 'TRAFFIC_AWARE'
    : undefined;
}

export interface RouteLeg {
  distanceM: number;
  durationS: number;
}

export interface ComputedRoute {
  distanceM: number;
  durationS: number;
  /** Encoded polyline for drawing the route on the map. */
  polyline: string | null;
  legs: RouteLeg[];
}

export type RoutesError =
  | { ok: false; reason: 'no-api-key' }
  | { ok: false; reason: 'request-failed'; status: number; detail: string }
  | { ok: false; reason: 'no-route' };

export type RoutesResult<T> = { ok: true; data: T } | RoutesError;

function waypoint(p: LatLng) {
  return { location: { latLng: { latitude: p.lat, longitude: p.lng } } };
}

function parseDuration(value: string | undefined): number {
  // Routes returns protobuf durations as e.g. "1234s".
  if (!value) return 0;
  return Number.parseFloat(value.replace(/s$/, '')) || 0;
}

/**
 * Compute a single multi-stop route in the given order.
 * `stops` must already be ordered; optimisation happens before this call.
 */
export async function computeRoute(
  origin: LatLng,
  stops: LatLng[],
  mode: TravelMode,
  signal?: AbortSignal
): Promise<RoutesResult<ComputedRoute>> {
  const { GOOGLE_MAPS_SERVER_API_KEY } = serverEnv();
  if (!GOOGLE_MAPS_SERVER_API_KEY) return { ok: false, reason: 'no-api-key' };
  if (stops.length === 0) return { ok: false, reason: 'no-route' };

  const destination = stops[stops.length - 1];
  const intermediates = stops.slice(0, -1);

  const body: Record<string, unknown> = {
    origin: waypoint(origin),
    destination: waypoint(destination),
    travelMode: TRAVEL_MODE[mode],
    polylineQuality: 'OVERVIEW',
    languageCode: 'en-IN',
    units: 'METRIC',
  };
  if (intermediates.length > 0) {
    body.intermediates = intermediates.map(waypoint);
  }
  const pref = routingPreference(mode);
  if (pref) body.routingPreference = pref;

  const response = await fetch(ROUTES_ENDPOINT, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_MAPS_SERVER_API_KEY,
      // Only what we render — this is the primary cost lever.
      'X-Goog-FieldMask': [
        'routes.distanceMeters',
        'routes.duration',
        'routes.polyline.encodedPolyline',
        'routes.legs.distanceMeters',
        'routes.legs.duration',
      ].join(','),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return {
      ok: false,
      reason: 'request-failed',
      status: response.status,
      detail: (await response.text()).slice(0, 400),
    };
  }

  const json = (await response.json()) as {
    routes?: Array<{
      distanceMeters?: number;
      duration?: string;
      polyline?: { encodedPolyline?: string };
      legs?: Array<{ distanceMeters?: number; duration?: string }>;
    }>;
  };

  const route = json.routes?.[0];
  if (!route) return { ok: false, reason: 'no-route' };

  return {
    ok: true,
    data: {
      distanceM: route.distanceMeters ?? 0,
      durationS: parseDuration(route.duration),
      polyline: route.polyline?.encodedPolyline ?? null,
      legs: (route.legs ?? []).map((leg) => ({
        distanceM: leg.distanceMeters ?? 0,
        durationS: parseDuration(leg.duration),
      })),
    },
  };
}

/**
 * Pairwise cost matrix over `points`, used by the optimiser.
 *
 * Billing note: this is an N×N request. We cap N to keep it in the cheap
 * tier and because a darshan route beyond ~10 stops is not a real journey.
 */
export const MAX_MATRIX_POINTS = 10;

export async function computeRouteMatrix(
  points: LatLng[],
  mode: TravelMode,
  signal?: AbortSignal
): Promise<RoutesResult<number[][]>> {
  const { GOOGLE_MAPS_SERVER_API_KEY } = serverEnv();
  if (!GOOGLE_MAPS_SERVER_API_KEY) return { ok: false, reason: 'no-api-key' };
  if (points.length > MAX_MATRIX_POINTS) {
    return {
      ok: false,
      reason: 'request-failed',
      status: 400,
      detail: `Matrix limited to ${MAX_MATRIX_POINTS} points`,
    };
  }

  const body: Record<string, unknown> = {
    origins: points.map((p) => ({ waypoint: waypoint(p) })),
    destinations: points.map((p) => ({ waypoint: waypoint(p) })),
    travelMode: TRAVEL_MODE[mode],
  };
  const pref = routingPreference(mode);
  if (pref) body.routingPreference = pref;

  const response = await fetch(MATRIX_ENDPOINT, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_MAPS_SERVER_API_KEY,
      'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,condition',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return {
      ok: false,
      reason: 'request-failed',
      status: response.status,
      detail: (await response.text()).slice(0, 400),
    };
  }

  const rows = (await response.json()) as Array<{
    originIndex: number;
    destinationIndex: number;
    duration?: string;
    condition?: string;
  }>;

  const n = points.length;
  const matrix: number[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => Number.POSITIVE_INFINITY)
  );
  for (const row of rows) {
    // ROUTE_NOT_FOUND leaves the pair at Infinity, which the solver treats
    // as impassable rather than silently costing zero.
    if (row.condition === 'ROUTE_EXISTS') {
      matrix[row.originIndex][row.destinationIndex] = parseDuration(row.duration);
    }
  }
  for (let i = 0; i < n; i++) matrix[i][i] = 0;

  return { ok: true, data: matrix };
}
