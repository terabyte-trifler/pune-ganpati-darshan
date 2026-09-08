import 'server-only';

import { getSupabasePublicClient } from '@/lib/supabase/server';
import { toGanpati } from '@/services/catalogue';
import type { DarshanPlan } from '@/types/ganpati';

/**
 * Reads a shared darshan plan by its share id.
 *
 * Uses the public (anon) client, so RLS decides visibility: a plan is
 * readable only when `is_public` or it belongs to the caller. The share id is
 * the capability — unguessable, and revocable by clearing `is_public`.
 */
export async function getPlanByShareId(shareId: string): Promise<DarshanPlan | null> {
  const supabase = getSupabasePublicClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('darshan_plans')
    .select(`
      id, share_id, title, mode, origin_lat, origin_lng, origin_label,
      total_distance_m, total_duration_s, created_at,
      darshan_plan_stops (
        position, leg_distance_m, leg_duration_s,
        ganpatis!inner (
          id, slug, name, name_mr, description, visitor_tip, category,
          address, latitude, longitude, google_place_id, manache_rank,
          prominence, established_year, timing_open, timing_close, timing_note,
          darshan_minutes, peak_darshan_minutes, darshan_style,
          tags, confidence, featured, verified, published,
          areas!inner ( slug, name, name_mr, is_core ),
          ganpati_images ( id, url, alt, credit, width, height, blur_data_url, sort_order, is_primary )
        )
      )
    `)
    .eq('share_id', shareId)
    .maybeSingle();

  if (error || !data) return null;

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const stops = ((data as any).darshan_plan_stops ?? [])
    .map((s: any) => {
      const raw = Array.isArray(s.ganpatis) ? s.ganpatis[0] : s.ganpatis;
      if (!raw) return null;
      const area = Array.isArray(raw.areas) ? raw.areas[0] : raw.areas;
      const g = toGanpati({
        ...raw,
        area_slug: area?.slug ?? '',
        area_name: area?.name ?? '',
        area_name_mr: area?.name_mr ?? null,
        area_is_core: area?.is_core ?? false,
        images: raw.ganpati_images ?? [],
      });
      return {
        ganpatiId: g.id, slug: g.slug, name: g.name, nameMr: g.nameMr,
        lat: g.location.lat, lng: g.location.lng,
        position: s.position,
        legDistanceM: s.leg_distance_m,
        legDurationS: s.leg_duration_s,
        ganpati: g,
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.position - b.position);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (stops.length === 0) return null;

  return {
    id: data.id,
    shareId: data.share_id,
    title: data.title,
    mode: data.mode,
    origin: data.origin_lat !== null && data.origin_lng !== null
      ? { lat: data.origin_lat, lng: data.origin_lng, label: data.origin_label }
      : null,
    totalDistanceM: data.total_distance_m,
    totalDurationS: data.total_duration_s,
    stops,
    createdAt: data.created_at,
  };
}
