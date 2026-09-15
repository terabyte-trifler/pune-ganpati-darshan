import 'server-only';

import { MODE_SPEED_MPS, type LatLng } from '@/lib/geo';
import type { TravelMode } from '@/types/ganpati';

/**
 * Road routing, server-side only.
 *
 * Three providers, all free, tried in that order:
 *
 *  - **OpenRouteService** (optional, best). Set `OPENROUTESERVICE_API_KEY`
 *    for a hosted service with an actual quota and uptime commitment; it
 *    also has better two-wheeler modelling for India.
 *  - **Valhalla** (on foot). The only one of the three whose free public
 *    instance genuinely models walking, which matters more here than
 *    anywhere else: the orange line on the map IS the walking route, and
 *    OSRM's demo answers every foot request with a car route. Between
 *    Kasba and Bhausaheb Rangari that is 462 m of driving round the block
 *    against 368 m of walking — the car cannot use the lanes a person can.
 *  - **OSRM** (last). No API key, no account, and the public demo hosts
 *    only the car profile — see below. Still the right answer for a
 *    two-wheeler, and the backstop when the others are unreachable.
 *
 * If neither is reachable the caller falls back to local haversine estimates,
 * which are clearly labelled as estimates in the UI — a wrong number
 * presented as routed truth is worse than an honest approximation.
 */

const OSRM_URL = process.env.ROUTING_OSRM_URL ?? 'https://router.project-osrm.org';

/**
 * Valhalla, used for the modes that are walked.
 *
 * The default is OpenStreetMap's own public instance, which is offered for
 * light use — fine for a normal day, not something to point a festival
 * night at. `ROUTING_VALHALLA_URL` should point at your own instance, or
 * set an OpenRouteService key so this is never reached.
 */
const VALHALLA_URL =
  process.env.ROUTING_VALHALLA_URL ?? 'https://valhalla1.openstreetmap.de';

/** Modes Valhalla is asked about. A two-wheeler stays with the others. */
const VALHALLA_COSTING: Partial<Record<TravelMode, string>> = {
  walk: 'pedestrian',
  metro: 'pedestrian',
};

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
  provider: 'osrm' | 'ors' | 'valhalla';
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
  mode: TravelMode,
  /**
   * Areas the route must keep out of, as [lng, lat] rings.
   *
   * Used for the festival one-way lanes: a router cannot be told that a
   * lane runs one way for twelve days, but it can be told to stay out of
   * an area, and barring the lane in both directions is the right answer
   * for a walk that wanted to go up it — it has to go round, on streets
   * the router knows and we do not.
   *
   * OSRM has no equivalent, so a request that needs one skips it.
   */
  avoid: Array<Array<[number, number]>> = [],
  /**
   * Points the route must pass through on each leg, leg by leg.
   *
   * `viaByLeg[i]` belongs to the walk from stop i-1 to stop i, origin
   * counting as stop 0. Used for the festival lanes: a router that must
   * pass through a lane draws that lane, on the real streets it knows.
   *
   * Only Valhalla is given these, and only as "through" locations, which
   * it passes without stopping and WITHOUT starting a new leg — so the
   * legs it returns still line up one-to-one with the stops a visitor
   * chose. Handing the same points to a router that treats every location
   * as a stop would silently renumber every leg in the plan.
   */
  viaByLeg: LatLng[][] = []
): Promise<RoutesResult<ComputedRoute>> {
  if (stops.length === 0) return { ok: false, reason: 'no-route' };
  const points = [origin, ...stops];

  /**
   * Valhalla first on foot; OpenRouteService first for a rider.
   *
   * Not a quality judgement — a quota one. This key's own headers put ORS
   * directions at 200 a day, which is 200 taps of Optimise across every
   * visitor before it starts refusing. A festival night spends that in
   * minutes, and spending it on walking is the wrong place: Valhalla
   * models pedestrians too, is not on a per-key day count, and on the
   * Kasba to Bhausaheb Rangari leg returns 368 m against ORS's 427 m.
   *
   * ORS keeps the two-wheeler, where it is the only one of the three that
   * models the mode at all — OSRM's demo would answer with a car and
   * Valhalla is not asked. Rider requests are also much rarer, so 200 a
   * day goes further there.
   */
  if (VALHALLA_COSTING[mode]) {
    const result = await computeRouteValhalla(points, mode, avoid, viaByLeg);
    if (result.ok) return result;
  }
  {
    const result = await computeRouteOrs(points, mode, avoid);
    if (result.ok) return result;
    // Fall through rather than failing outright.
  }
  // OSRM cannot be told to avoid anything, so a request that depends on
  // an exclusion gives up rather than quietly returning the route the
  // exclusion existed to prevent.
  if (avoid.length > 0) return { ok: false, reason: 'no-route' };
  return computeRouteOsrm(points, mode);
}

/**
 * When ORS said it was out of quota, and when it says it will be back.
 *
 * Without this, every request after the day's two-hundredth pays a full
 * round trip to be told no before falling through — on the one night the
 * latency matters most. The reset comes from the provider's own header
 * rather than from a guess about the window, and the whole thing is
 * per-instance and in memory: losing it on a deploy costs one wasted
 * call, which is not worth a store.
 */
let orsBlockedUntil = 0;

function noteOrsRateLimit(response: Response): void {
  if (response.status !== 429) return;
  const reset = Number(response.headers.get('x-ratelimit-reset'));
  orsBlockedUntil = Number.isFinite(reset) && reset > 0
    ? reset * 1000
    : Date.now() + 60 * 60 * 1000;
}

/**
 * Valhalla's encoded polyline, which is the Google algorithm at 1e6.
 *
 * Precision six, not the five almost every decoder assumes — at five the
 * line comes out a hundred times too small and lands off the coast of
 * Africa, which is at least a failure you notice immediately.
 */
function decodePolyline6(encoded: string): [number, number][] {
  const out: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    for (const axis of ['lat', 'lng'] as const) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 'lat') lat += delta;
      else lng += delta;
    }
    out.push([lng / 1e6, lat / 1e6]);
  }
  return out;
}

async function computeRouteValhalla(
  points: LatLng[],
  mode: TravelMode,
  avoid: Array<Array<[number, number]>> = [],
  /**
   * Points the route must pass through on each leg, leg by leg.
   *
   * `viaByLeg[i]` belongs to the walk from stop i-1 to stop i, origin
   * counting as stop 0. Used for the festival lanes: a router that must
   * pass through a lane draws that lane, on the real streets it knows.
   *
   * Only Valhalla is given these, and only as "through" locations, which
   * it passes without stopping and WITHOUT starting a new leg — so the
   * legs it returns still line up one-to-one with the stops a visitor
   * chose. Handing the same points to a router that treats every location
   * as a stop would silently renumber every leg in the plan.
   */
  viaByLeg: LatLng[][] = []
): Promise<RoutesResult<ComputedRoute>> {
  const costing = VALHALLA_COSTING[mode];
  if (!costing) return { ok: false, reason: 'unavailable' };

  /**
   * Asked as a GET, not the POST the docs lead with.
   *
   * Next's Data Cache does not cache POST, and an uncached router call is
   * the thing ROUTER_CACHE_SECONDS exists to prevent: during the festival
   * thousands of people build routes around the same handful of mandals,
   * and almost every request re-asks a question already answered. As a
   * POST this would have gone to OpenStreetMap's public instance every
   * single time somebody tapped Optimise.
   *
   * Coordinates are rounded into the query the same way the OSRM URLs are,
   * so two people planning the same walk share one cache entry.
   */
  /**
   * Valhalla takes at most this many locations in one route request.
   *
   * The public instance enforces it, and a request over the line is
   * refused outright rather than trimmed: "Exceeded max locations: 10".
   * Four stops with eight lane points threaded between them is twelve, so
   * every route the lanes actually applied to fell through to OSRM — which
   * answers a walking request with a car route. The lanes were switching
   * off the pedestrian router at exactly the places they matter.
   */
  const MAX_LOCATIONS = 10;

  /**
   * Enough lane points to pin the route onto the lane, and no more.
   *
   * A through-point's whole job is to make the router pass along the lane;
   * the router draws the street between them itself. Two per leg does that
   * as well as eight, and leaves room for the stops.
   */
  const MAX_VIA_PER_LEG = 2;

  const thinned = viaByLeg.map((via) => {
    if (via.length <= MAX_VIA_PER_LEG) return via;
    const step = (via.length - 1) / (MAX_VIA_PER_LEG - 1);
    return Array.from({ length: MAX_VIA_PER_LEG }, (_, i) => via[Math.round(i * step)]);
  });

  // Still too many: give up the via points rather than the request. An
  // ordering that respects the lanes with a plain line beats no pedestrian
  // route at all.
  let budget = MAX_LOCATIONS - points.length;
  const fitted = thinned.map((via) => {
    const take = Math.max(0, Math.min(via.length, budget));
    budget -= take;
    return via.slice(0, take);
  });

  /**
   * Stops are rounded to about eleven metres; through-points are not.
   *
   * Four decimals on a stop is deliberate — it buckets a moving visitor's
   * position so the same walk asked twice is one cached request rather
   * than two, and a mandal does not move by eleven metres.
   *
   * A through-point is a different kind of thing. It is not a place the
   * visitor is going, it is the instruction that keeps the walk out of a
   * one-way lane, and eleven metres is enough to land it on the wrong side
   * of one. Hutatma Babu Genu back into Tulshibaug is the case that showed
   * it: routed through the waypoints as measured it is 666 m and wholly
   * legal, and through the same waypoints rounded it is 1289 m with 191 m
   * walked against the crowd. These come from our own data and are already
   * exact, so they are sent as they are.
   */
  const round = (p: LatLng, through = false) =>
    through
      ? { lat: p.lat, lon: p.lng, type: 'through' as const }
      : { lat: Number(p.lat.toFixed(4)), lon: Number(p.lng.toFixed(4)) };

  const locations: Array<ReturnType<typeof round>> = [];
  points.forEach((p, i) => {
    // The lane points for the leg ARRIVING at this stop go in first.
    for (const via of fitted[i] ?? []) locations.push(round(via, true));
    locations.push(round(p));
  });

  /**
   * Split a long route into requests Valhalla will accept, then stitch.
   *
   * The limit is ten locations, and a route over it is refused outright —
   * so an eleven-stop walk fell through to OSRM and came back as a car
   * route. great-peth-circuit was 7765 m of driving against roughly 5 km
   * of walking, which was most of the inflation across the curated set.
   *
   * Chunks are cut at STOPS, never at a lane through-point, and share the
   * stop they meet at: that stop is the end of one request and the start
   * of the next, so the legs concatenate one-to-one with the stops a
   * visitor chose and the shapes join without a gap.
   */
  const chunks: Array<typeof locations> = [];
  if (locations.length <= MAX_LOCATIONS) {
    chunks.push(locations);
  } else {
    let start = 0;
    while (start < locations.length - 1) {
      let end = Math.min(start + MAX_LOCATIONS - 1, locations.length - 1);
      // Walk back to a stop: a through-point cannot end a request.
      while (end > start + 1 && locations[end].type === 'through') end--;
      chunks.push(locations.slice(start, end + 1));
      start = end;
    }
  }

  const geometry: [number, number][] = [];
  const legs: RouteLeg[] = [];
  let distanceM = 0;
  let durationS = 0;

  for (const chunk of chunks) {
    const query = JSON.stringify({
      locations: chunk,
      costing,
      directions_options: { units: 'kilometers' },
      ...(avoid.length > 0 ? { exclude_polygons: avoid } : {}),
    });

    let response: Response;
    try {
      response = await fetchJson(
        `${VALHALLA_URL}/route?json=${encodeURIComponent(query)}`,
        { next: { revalidate: ROUTER_CACHE_SECONDS } }
      );
    } catch {
      return { ok: false, reason: 'unavailable' };
    }
    if (!response.ok) return { ok: false, reason: 'unavailable' };

    const body = (await response.json().catch(() => null)) as {
      trip?: {
        legs?: Array<{ summary?: { length?: number; time?: number }; shape?: string }>;
        summary?: { length?: number; time?: number };
      };
    } | null;

    const trip = body?.trip;
    if (!trip?.legs?.length) return { ok: false, reason: 'no-route' };

    distanceM += Math.round((trip.summary?.length ?? 0) * 1000);
    durationS += Math.round(trip.summary?.time ?? 0);

    for (const leg of trip.legs) {
      for (const point of decodePolyline6(leg.shape ?? '')) {
        const last = geometry[geometry.length - 1];
        if (!last || last[0] !== point[0] || last[1] !== point[1]) geometry.push(point);
      }
      legs.push({
        distanceM: Math.round((leg.summary?.length ?? 0) * 1000),
        durationS: Math.round(leg.summary?.time ?? 0),
      });
    }
  }

  return {
    ok: true,
    data: {
      distanceM,
      durationS,
      geometry: geometry.length > 1 ? geometry : null,
      legs,
      provider: 'valhalla',
      // Unlike OSRM's demo, this one really did model walking.
      durationSource: 'provider',
    },
  };
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
  mode: TravelMode,
  // No lane through-points: ORS treats every coordinate as a stop, so
  // they would renumber the legs. The geometry pass in /api/routes still
  // puts the lanes into whatever line it returns.
  avoid: Array<Array<[number, number]>> = []
): Promise<RoutesResult<ComputedRoute>> {
  // No key, or it already told us it is out for the day.
  if (!ORS_KEY || Date.now() < orsBlockedUntil) {
    return { ok: false, reason: 'unavailable' };
  }

  let response: Response;
  try {
    response = await fetchJson(`${ORS_URL}/${ORS_PROFILE[mode]}/geojson`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: ORS_KEY! },
      body: JSON.stringify({
        coordinates: points.map((p) => [p.lng, p.lat]),
        ...(avoid.length > 0
          ? {
              options: {
                avoid_polygons: {
                  type: 'MultiPolygon',
                  coordinates: avoid.map((ring) => [ring]),
                },
              },
            }
          : {}),
      }),
    });
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
  if (!response.ok) {
    noteOrsRateLimit(response);
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

/**
 * Valhalla's pedestrian matrix, for the modes that are walked.
 *
 * The table below it asks OSRM for /table/v1/driving, because the public
 * demo has no foot profile — so the order of a WALK was being decided by
 * car distances. Around these one-ways that is not a small difference: a
 * car must go round where a person may not, and may go where a person is
 * sent the other way.
 *
 * Its own limit is 100 PAIRS rather than 100 locations, which is ten
 * points square — the same cap MAX_MATRIX_POINTS already imposes, so
 * nothing new is refused. Asked as a GET so the answer caches, like the
 * route request.
 */
async function computeMatrixValhalla(
  points: LatLng[],
  mode: TravelMode
): Promise<RoutesResult<number[][]>> {
  const costing = VALHALLA_COSTING[mode];
  if (!costing) return { ok: false, reason: 'unavailable' };

  const locations = points.map((p) => ({
    lat: Number(p.lat.toFixed(3)),
    lon: Number(p.lng.toFixed(3)),
  }));
  const query = JSON.stringify({
    sources: locations,
    targets: locations,
    costing,
    units: 'kilometers',
  });

  let response: Response;
  try {
    response = await fetchJson(
      `${VALHALLA_URL}/sources_to_targets?json=${encodeURIComponent(query)}`,
      { next: { revalidate: ROUTER_CACHE_SECONDS } }
    );
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
  if (!response.ok) return { ok: false, reason: 'unavailable' };

  const body = (await response.json().catch(() => null)) as {
    sources_to_targets?: Array<Array<{ time?: number | null }>>;
  } | null;

  const rows = body?.sources_to_targets;
  if (!rows?.length) return { ok: false, reason: 'no-route' };

  // A null time means the pair is unreachable on foot. Infinity makes the
  // solver treat it as impassable rather than silently costing it zero.
  const matrix = rows.map((row) =>
    row.map((cell) =>
      cell?.time === null || cell?.time === undefined
        ? Number.POSITIVE_INFINITY
        : cell.time
    )
  );
  return { ok: true, data: matrix };
}

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

  // On foot, ask something that walks. OSRM below is the backstop, and it
  // answers a foot request with a car.
  if (VALHALLA_COSTING[mode]) {
    const walked = await computeMatrixValhalla(points, mode);
    if (walked.ok) return walked;
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
