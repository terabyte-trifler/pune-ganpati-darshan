import 'server-only';

import { getSupabasePublicClient } from '@/lib/supabase/server';
import { localRoutes, getLocalRoute, toGanpati } from '@/services/catalogue';
import { getAllGanpatis } from '@/services/ganpati';
import { estimateDurationSeconds, haversine, type TravelMode } from '@/lib/geo';
import { toTravelMode } from '@/db/database.types';
import type { CuratedRoute, TimeOfDay } from '@/types/ganpati';

/**
 * Curated routes.
 *
 * Same contract as the mandal service: try Supabase, fall back to the
 * generated snapshot when it is unconfigured or the query fails.
 */

const ROUTE_SELECT = `
  id, slug, title, title_mr, summary, description, mode, time_of_day, themes,
  total_distance_m, total_walk_s, total_darshan_s, featured, published, sort_order,
  route_stops (
    position, darshan_minutes, darshan_style, note,
    ganpatis!inner (
      id, slug, name, name_mr, description, visitor_tip, category,
      address, latitude, longitude, google_place_id, manache_rank, prominence,
      established_year, timing_open, timing_close, timing_note,
      darshan_minutes, peak_darshan_minutes, darshan_style,
      tags, confidence, featured, verified, published,
      areas!inner ( slug, name, name_mr, is_core )
    )
  )
`;

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapRoute(row: any): CuratedRoute {
  const stops = (row.route_stops ?? [])
    .map((s: any) => {
      const raw = Array.isArray(s.ganpatis) ? s.ganpatis[0] : s.ganpatis;
      if (!raw) return null;
      const area = Array.isArray(raw.areas) ? raw.areas[0] : raw.areas;
      return {
        ganpati: toGanpati({
          ...raw,
          area_slug: area?.slug ?? '',
          area_name: area?.name ?? '',
          area_name_mr: area?.name_mr ?? null,
          area_is_core: area?.is_core ?? false,
          images: [],
        }),
        position: s.position,
        darshanMinutes: s.darshan_minutes,
        darshanStyle: s.darshan_style,
        note: s.note,
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.position - b.position);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    titleMr: row.title_mr,
    summary: row.summary,
    description: row.description,
    mode: toTravelMode(row.mode),
    timeOfDay: (row.time_of_day ?? 'any') as TimeOfDay,
    themes: row.themes ?? [],
    totalDarshanS: row.total_darshan_s,
    featured: row.featured,
    stops,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function getRoutes(): Promise<CuratedRoute[]> {
  const supabase = getSupabasePublicClient();
  if (!supabase) return localRoutes;

  const { data, error } = await supabase
    .from('routes')
    .select(ROUTE_SELECT)
    .eq('published', true)
    .order('sort_order');

  if (error || !data) return localRoutes;
  return data.map(mapRoute);
}

export async function getRouteBySlug(slug: string): Promise<CuratedRoute | null> {
  const supabase = getSupabasePublicClient();
  if (!supabase) return getLocalRoute(slug);

  const { data, error } = await supabase
    .from('routes')
    .select(ROUTE_SELECT)
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();

  if (error) return getLocalRoute(slug);
  return data ? mapRoute(data) : null;
}

/**
 * Route totals.
 *
 * Walking time is a local estimate (haversine × the measured peth detour
 * factor), not a routed value — computing real routes for every card on an
 * index page would be wasteful and slow. The route detail page can upgrade
 * to a routed line on demand. Darshan time is the dominant term anyway: on
 * the Dagdusheth route the queues outweigh the walking several times over.
 */
export interface RouteTotals {
  stopCount: number;
  darshanS: number;
  travelS: number;
  totalS: number;
  distanceM: number;
  /** True when at least one stop has no dwell estimate. */
  partialDarshan: boolean;
}

export function computeRouteTotals(route: CuratedRoute): RouteTotals {
  const mode: TravelMode = route.mode;

  let distanceM = 0;
  let travelS = 0;
  for (let i = 0; i < route.stops.length - 1; i++) {
    const a = route.stops[i].ganpati.location;
    const b = route.stops[i + 1].ganpati.location;
    const d = haversine({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });
    distanceM += d;
    travelS += estimateDurationSeconds(d, mode);
  }

  let darshanS = 0;
  let partialDarshan = false;
  for (const stop of route.stops) {
    const minutes = stop.darshanMinutes ?? stop.ganpati.darshanMinutes;
    if (minutes == null) partialDarshan = true;
    else darshanS += minutes * 60;
  }

  return {
    stopCount: route.stops.length,
    darshanS,
    travelS: Math.round(travelS),
    totalS: Math.round(darshanS + travelS),
    distanceM: Math.round(distanceM),
    partialDarshan,
  };
}

/** Routes suited to the current time of day, for "good for right now". */
export function routesForNow(routes: CuratedRoute[], now = new Date()): CuratedRoute[] {
  // Pune local time; the festival day is local, not UTC.
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata',
    }).format(now)
  );

  const slot: TimeOfDay =
    hour < 11 ? 'morning' : hour < 16 ? 'afternoon' : hour < 20 ? 'evening' : 'night';

  const matching = routes.filter((r) => r.timeOfDay === slot);
  return matching.length > 0 ? matching : routes.filter((r) => r.timeOfDay === 'any');
}

export async function getRoutesWithMandals() {
  const [routes] = await Promise.all([getRoutes(), getAllGanpatis()]);
  return routes;
}
