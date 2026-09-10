import 'server-only';

import { MODE_SPEED_MPS, type LatLng } from '@/lib/geo';
import type { TravelMode } from '@/types/ganpati';

/**
 * Road routing, server-side only.
 *
 * Two providers, both free:
 *
 *  - **OSRM** (default). No API key, no account. The public demo server at
 *    router.project-osrm.org is fine for development but is explicitly not
 *    for production use, so `ROUTING_OSRM_URL` points at your own instance
 *    when you have one.
 *  - **OpenRouteService** (optional). Set `OPENROUTESERVICE_API_KEY` for a
 *    hosted service with an actual quota and uptime commitment; it also has
 *    better two-wheeler modelling for India.
 *
 * If neither is reachable the caller falls back to local haversine estimates,
 * which are clearly labelled as estimates in the UI — a wrong number
 * presented as routed truth is worse than an honest approximation.
 */

const OSRM_URL = process.env.ROUTING_OSRM_URL ?? 'https://router.project-osrm.org';

/**
 * Whether the configured OSRM deployment actually serves per-mode profiles.
 *
 * The public demo server does NOT: it hosts only the car profile and ignores
 * the profile path segment entirely, returning identical distance AND
 * duration for /foot, /bike and /driving (verified: 7.6 m/s for all five
 * profile names). Its distances are real road distances and worth using, but
 * its walking durations are car durations — presenting one as a walking ETA
 * would tell someone a 2.5 km walk takes 5 minutes.
 *
 * So unless you self-host OSRM with real foot/bike profiles and set this,
 * we keep the routed distance and derive the duration from measured mode
 * speeds instead.
 */
const OSRM_HAS_PROFILES = process.env.ROUTING_OSRM_HAS_PROFILES === 'true';
const ORS_KEY = process.env.OPENROUTESERVICE_API_KEY;
const ORS_URL = 'https://api.openrouteservice.org/v2/directions';

/** Our travel modes → each provider's profile name. */
const OSRM_PROFILE: Record<TravelMode, string> = {
  walk: 'foot',
  two_wheeler: 'driving',   // OSRM's demo has no motorcycle profile
  metro: 'foot',            // The route between stations is walked
};

const ORS_PROFILE: Record<TravelMode, string> = {
  walk: 'foot-walking',
  two_wheeler: 'cycling-road',
  metro: 'foot-walking',
};

/**
 * Modes no router models properly; the UI must not imply otherwise.
 *
 * Empty now. This used to hold 'transit', because no free router models
 * bus and train timetables — but metro mode does not ask one to. It is a
 * walking route with a station at each end, and the routers do model
 * walking, so nothing here is an approximation any more.
 */
export const APPROXIMATED_MODES: TravelMode[] = [];

export interface RouteLeg {
  distanceM: number;
  durationS: number;
}

export interface ComputedRoute {
  distanceM: number;
  durationS: number;
  /** GeoJSON LineString coordinates ([lng, lat]) for drawing the route. */
  geometry: [number, number][] | null;
  legs: RouteLeg[];
  provider: 'osrm' | 'ors';
  /**
   * Where the time came from. 'provider' means the router modelled this
   * travel mode; 'derived' means only the distance is routed and the time
   * was computed from mode speed. The UI must label these differently.
   */
  durationSource: 'provider' | 'derived';
}

export type RoutesError =
  | { ok: false; reason: 'unavailable' }
  | { ok: false; reason: 'request-failed'; status: number; detail: string }
  | { ok: false; reason: 'no-route' };

export type RoutesResult<T> = { ok: true; data: T } | RoutesError;

const TIMEOUT_MS = 8000;

async function fetchJson(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * How long a router answer stays good for.
 *
 * A day, because the answer cannot change faster than the streets do. Every
 * one of these queries asks the same question — how far apart are two fixed
 * points on foot — and the mandals do not move. Caching it is not a
 * freshness trade, it is declining to ask twice.
 *
 * This matters because the default deployment talks to the public OSRM demo
 * server, which is rate-limited and explicitly not for production use. Every
 * "Optimise" tap previously sent two uncached requests there. During a
 * festival, thousands of people build routes around the same handful of
 * popular mandals, so almost all of those requests are re-asking a question
 * already answered. Vercel's Data Cache is shared across instances, so one
 * answer serves every instance until it expires.
 */
const ROUTER_CACHE_SECONDS = 86_400;

/**
 * Coordinates rounded before they become part of a cache key.
 *
 * Full float precision makes every request unique, which is the same as
 * having no cache at all: two people standing a metre apart would each pay
 * for their own router call. The precision is chosen per use, because the
 * two calls have different tolerances:
 *
 *   3 dp (~110m) for the MATRIX. Its only job is to order stops that are
 *   hundreds of metres apart, so 110m cannot change the answer, and it lets
 *   everyone in the same lane share one cached table.
 *
 *   4 dp (~11m) for the GEOMETRY, which is drawn on the map. 11m is a few
 *   pixels at street zoom — invisible — while still collapsing repeat taps
 *   and back-navigation onto one entry.
 */
function cacheableCoords(points: LatLng[], dp: number): string {
  return points.map((p) => `${p.lng.toFixed(dp)},${p.lat.toFixed(dp)}`).join(';');
}

/* ---------------------------------------------------------------------
   Single multi-stop route, in the given order.
   ------------------------------------------------------------------- */
export async function computeRoute(
  origin: LatLng,
  stops: LatLng[],
  mode: TravelMode
): Promise<RoutesResult<ComputedRoute>> {
  if (stops.length === 0) return { ok: false, reason: 'no-route' };
  const points = [origin, ...stops];

  if (ORS_KEY) {
    const result = await computeRouteOrs(points, mode);
    if (result.ok) return result;
    // Fall through to OSRM rather than failing outright.
  }
  return computeRouteOsrm(points, mode);
}

async function computeRouteOsrm(
  points: LatLng[],
  mode: TravelMode
): Promise<RoutesResult<ComputedRoute>> {
  const coords = cacheableCoords(points, 4);
  const url = `${OSRM_URL}/route/v1/${OSRM_PROFILE[mode]}/${coords}?overview=full&geometries=geojson&steps=false`;

  let response: Response;
  try {
    response = await fetchJson(url, { next: { revalidate: ROUTER_CACHE_SECONDS } });
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
  if (!response.ok) {
    return {
      ok: false, reason: 'request-failed', status: response.status,
      detail: (await response.text()).slice(0, 200),
    };
  }

  const json = (await response.json()) as {
    code?: string;
    routes?: Array<{
      distance?: number; duration?: number;
      geometry?: { coordinates?: [number, number][] };
      legs?: Array<{ distance?: number; duration?: number }>;
    }>;
  };
  const route = json.routes?.[0];
  if (json.code !== 'Ok' || !route) return { ok: false, reason: 'no-route' };

  // Trust the provider's timing only when it genuinely models this mode.
  // Nothing we offer is a car mode any more, so on a demo deployment that
  // serves only the car profile there is no mode whose duration is usable.
  const trustDuration = OSRM_HAS_PROFILES;
  const speed = MODE_SPEED_MPS[mode];
  const timeFor = (metres: number, provided: number | undefined) =>
    trustDuration ? Math.round(provided ?? 0) : Math.round(metres / speed);

  const distanceM = Math.round(route.distance ?? 0);

  return {
    ok: true,
    data: {
      distanceM,
      durationS: timeFor(distanceM, route.duration),
      geometry: route.geometry?.coordinates ?? null,
      legs: (route.legs ?? []).map((l) => {
        const legDistance = Math.round(l.distance ?? 0);
        return { distanceM: legDistance, durationS: timeFor(legDistance, l.duration) };
      }),
      provider: 'osrm',
      durationSource: trustDuration ? 'provider' : 'derived',
    },
  };
}

async function computeRouteOrs(
  points: LatLng[],
  mode: TravelMode
): Promise<RoutesResult<ComputedRoute>> {
  let response: Response;
  try {
    response = await fetchJson(`${ORS_URL}/${ORS_PROFILE[mode]}/geojson`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: ORS_KEY! },
      body: JSON.stringify({ coordinates: points.map((p) => [p.lng, p.lat]) }),
    });
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
  if (!response.ok) {
    return {
      ok: false, reason: 'request-failed', status: response.status,
      detail: (await response.text()).slice(0, 200),
    };
  }

  const json = (await response.json()) as {
    features?: Array<{
      geometry?: { coordinates?: [number, number][] };
      properties?: {
        summary?: { distance?: number; duration?: number };
        segments?: Array<{ distance?: number; duration?: number }>;
      };
    }>;
  };
  const feature = json.features?.[0];
  if (!feature) return { ok: false, reason: 'no-route' };

  return {
    ok: true,
    data: {
      distanceM: Math.round(feature.properties?.summary?.distance ?? 0),
      durationS: Math.round(feature.properties?.summary?.duration ?? 0),
      geometry: feature.geometry?.coordinates ?? null,
      legs: (feature.properties?.segments ?? []).map((s) => ({
        distanceM: Math.round(s.distance ?? 0),
        durationS: Math.round(s.duration ?? 0),
      })),
      provider: 'ors',
      // OpenRouteService has genuine per-mode profiles.
      durationSource: 'provider',
    },
  };
}

/* ---------------------------------------------------------------------
   Pairwise duration matrix, used by the optimiser.
   ------------------------------------------------------------------- */

/**
 * A darshan route beyond ~10 stops is not a real journey, and the cap keeps
 * the matrix small enough to stay inside every provider's free limits.
 */
export const MAX_MATRIX_POINTS = 10;

export async function computeRouteMatrix(
  points: LatLng[],
  mode: TravelMode
): Promise<RoutesResult<number[][]>> {
  if (points.length > MAX_MATRIX_POINTS) {
    return {
      ok: false, reason: 'request-failed', status: 400,
      detail: `Matrix limited to ${MAX_MATRIX_POINTS} points`,
    };
  }

  const coords = cacheableCoords(points, 3);
  // Request distances too: when the deployment has no real profile for this
  // mode its durations are car times, and ordering stops by car time gives a
  // different (wrong) walking route.
  const annotations = OSRM_HAS_PROFILES ? 'duration' : 'duration,distance';
  const url = `${OSRM_URL}/table/v1/${OSRM_PROFILE[mode]}/${coords}?annotations=${annotations}`;

  let response: Response;
  try {
    response = await fetchJson(url, { next: { revalidate: ROUTER_CACHE_SECONDS } });
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
  if (!response.ok) {
    return {
      ok: false, reason: 'request-failed', status: response.status,
      detail: (await response.text()).slice(0, 200),
    };
  }

  const json = (await response.json()) as {
    code?: string;
    durations?: (number | null)[][];
    distances?: (number | null)[][];
  };
  if (json.code !== 'Ok' || !json.durations) return { ok: false, reason: 'no-route' };

  // A null entry means the pair is unreachable. Infinity makes the solver
  // treat it as impassable rather than silently costing it zero.
  const trustDuration = OSRM_HAS_PROFILES;
  const speed = MODE_SPEED_MPS[mode];
  const source = trustDuration ? json.durations : (json.distances ?? json.durations);

  const matrix = source.map((row) =>
    row.map((v) => {
      if (v === null) return Number.POSITIVE_INFINITY;
      return trustDuration ? v : v / speed;
    })
  );
  return { ok: true, data: matrix };
}
