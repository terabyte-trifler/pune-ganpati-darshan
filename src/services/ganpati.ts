import 'server-only';

import { getSupabasePublicClient } from '@/lib/supabase/server';
import {
  localGanpatis,
  localAreas,
  localCategories,
  localFestival,
  getLocalGanpati,
  toGanpati,
} from '@/services/catalogue';
import type {
  Area, Category, FestivalConfig, Ganpati, GanpatiCategory,
} from '@/types/ganpati';

/**
 * Read model for mandal data.
 *
 * Uses the cookieless public client: this is world-readable content, the
 * same for every visitor, and it must be fetchable from
 * `generateStaticParams` where no request context exists.
 *
 * Every function follows the same contract: try Supabase, and fall back to
 * the generated snapshot if Supabase is unconfigured OR the query fails.
 * A festival visitor on a congested network still gets the catalogue (§35).
 */

const GANPATI_SELECT = `
  id, slug, name, name_mr, description, visitor_tip, category,
  address, latitude, longitude, google_place_id, manache_rank, prominence,
  established_year, timing_open, timing_close, timing_note, tags,
  confidence, featured, verified, published, coordinate_source, osm_id,
  areas!inner ( slug, name, name_mr, is_core ),
  ganpati_images ( id, url, alt, credit, width, height, blur_data_url, sort_order, is_primary )
`;

/** Supabase returns the joined area nested; flatten it into the raw shape. */
/* eslint-disable @typescript-eslint/no-explicit-any */
function flatten(row: any) {
  const area = Array.isArray(row.areas) ? row.areas[0] : row.areas;
  return {
    ...row,
    area_slug: area?.slug ?? '',
    area_name: area?.name ?? '',
    area_name_mr: area?.name_mr ?? null,
    area_is_core: area?.is_core ?? false,
    images: row.ganpati_images ?? [],
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function getAllGanpatis(): Promise<Ganpati[]> {
  const supabase = getSupabasePublicClient();
  if (!supabase) return localGanpatis;

  const { data, error } = await supabase
    .from('ganpatis')
    .select(GANPATI_SELECT)
    .eq('published', true)
    .order('prominence', { ascending: false });

  if (error || !data) return localGanpatis;
  return data.map((row) => toGanpati(flatten(row)));
}

export async function getGanpatiBySlug(slug: string): Promise<Ganpati | null> {
  const supabase = getSupabasePublicClient();
  if (!supabase) return getLocalGanpati(slug);

  const { data, error } = await supabase
    .from('ganpatis')
    .select(GANPATI_SELECT)
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();

  if (error) return getLocalGanpati(slug);
  return data ? toGanpati(flatten(data)) : null;
}

export async function getAreas(): Promise<Area[]> {
  const supabase = getSupabasePublicClient();
  if (!supabase) return localAreas;

  const { data, error } = await supabase
    .from('areas')
    .select('*')
    .order('sort_order');

  if (error || !data) return localAreas;
  return data.map((a) => ({
    id: a.id,
    slug: a.slug,
    name: a.name,
    nameMr: a.name_mr,
    city: a.city,
    isCore: a.is_core,
    centroid:
      a.centroid_lat !== null && a.centroid_lng !== null
        ? { lat: a.centroid_lat, lng: a.centroid_lng }
        : null,
    sortOrder: a.sort_order,
  }));
}

export async function getCategories(): Promise<Category[]> {
  const supabase = getSupabasePublicClient();
  if (!supabase) return localCategories;

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order');

  if (error || !data) return localCategories;
  return data.map((c) => ({
    id: c.id,
    key: c.key,
    name: c.name,
    nameMr: c.name_mr,
    description: c.description,
    sortOrder: c.sort_order,
  }));
}

export async function getFestivalConfig(): Promise<FestivalConfig> {
  const supabase = getSupabasePublicClient();
  if (!supabase) return localFestival;

  const { data, error } = await supabase
    .from('festival_config')
    .select('*')
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return localFestival;
  return {
    year: data.year,
    startDate: data.start_date,
    endDate: data.end_date,
    visarjanDate: data.visarjan_date,
    greetingEn: data.greeting_en,
    greetingMr: data.greeting_mr,
    tagline: data.tagline,
  };
}

export async function getGanpatisByArea(areaSlug: string): Promise<Ganpati[]> {
  const all = await getAllGanpatis();
  return all.filter((g) => g.area.slug === areaSlug);
}

export async function getGanpatisByCategory(
  category: GanpatiCategory
): Promise<Ganpati[]> {
  const all = await getAllGanpatis();
  const filtered = all.filter((g) => g.category === category);
  // Manache Paach are ordered by ceremonial precedence, never by footfall.
  return category === 'maanache'
    ? filtered.sort((a, b) => (a.manacheRank ?? 99) - (b.manacheRank ?? 99))
    : filtered;
}

export async function getManachePaach(): Promise<Ganpati[]> {
  return getGanpatisByCategory('maanache');
}

export async function getFeatured(limit = 6): Promise<Ganpati[]> {
  const all = await getAllGanpatis();
  return all.filter((g) => g.featured).slice(0, limit);
}
