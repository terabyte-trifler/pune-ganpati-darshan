import catalogue from '@/content/catalogue.json';
import type {
  Area,
  Category,
  Ganpati,
  GanpatiCategory,
  DataConfidence,
  DarshanStyle,
  FestivalConfig,
  GanpatiImage,
  CuratedRoute,
  TimeOfDay,
  TravelMode,
} from '@/types/ganpati';

/**
 * The offline catalogue.
 *
 * `catalogue.json` is generated from the SQL seed (scripts/export-catalogue.sh),
 * so it cannot drift from the database. It serves three jobs:
 *   1. the app runs fully before Supabase is configured,
 *   2. mandal data stays readable when the network drops mid-festival (§35),
 *   3. static pages can be pre-rendered without a database round-trip.
 *
 * When Supabase IS configured the DB is authoritative; this is the fallback.
 */

interface RawGanpati {
  id: string;
  slug: string;
  name: string;
  name_mr: string | null;
  description: string | null;
  visitor_tip: string | null;
  category: GanpatiCategory;
  address: string | null;
  latitude: number;
  longitude: number;
  google_place_id: string | null;
  manache_rank: number | null;
  prominence: number;
  established_year: number | null;
  timing_open: string | null;
  timing_close: string | null;
  timing_note: string | null;
  darshan_minutes: number | null;
  peak_darshan_minutes: number | null;
  darshan_style: 'inside' | 'outside' | 'either';
  tags: string[];
  confidence: DataConfidence;
  featured: boolean;
  verified: boolean;
  published: boolean;
  coordinate_source: string | null;
  osm_id: string | null;
  /** Optional: snapshots generated before the crowd feature lack it. */
  crowd_reporting_enabled?: boolean;
  area_slug: string;
  area_name: string;
  area_name_mr: string | null;
  area_is_core: boolean;
  images: Array<{
    id: string;
    url: string;
    alt: string | null;
    credit: string | null;
    width: number | null;
    height: number | null;
    blur_data_url: string | null;
    sort_order: number;
    is_primary: boolean;
  }>;
}

interface RawCatalogue {
  generatedAt: string;
  festival: {
    year: number;
    start_date: string;
    end_date: string;
    visarjan_date: string;
    greeting_en: string;
    greeting_mr: string;
    tagline: string | null;
  };
  areas: Array<{
    id: string; slug: string; name: string; name_mr: string | null;
    city: string; is_core: boolean;
    centroid_lat: number | null; centroid_lng: number | null; sort_order: number;
  }>;
  categories: Array<{
    id: string; key: GanpatiCategory; name: string;
    name_mr: string | null; description: string | null; sort_order: number;
  }>;
  ganpatis: RawGanpati[];
  routes?: RawRoute[];
}

interface RawRoute {
  id: string; slug: string; title: string; title_mr: string | null;
  summary: string | null; description: string | null;
  mode: TravelMode; time_of_day: string | null; themes: string[];
  total_distance_m: number | null; total_walk_s: number | null;
  total_darshan_s: number | null;
  featured: boolean; published: boolean; sort_order: number;
  stops: Array<{
    ganpati_slug: string; position: number;
    darshan_minutes: number | null;
    darshan_style: DarshanStyle | null; note: string | null;
  }>;
}

const raw = catalogue as unknown as RawCatalogue;

function toImage(i: RawGanpati['images'][number]): GanpatiImage {
  return {
    id: i.id,
    url: i.url,
    alt: i.alt,
    credit: i.credit,
    width: i.width,
    height: i.height,
    blurDataUrl: i.blur_data_url,
    isPrimary: i.is_primary,
    sortOrder: i.sort_order,
  };
}

/** Maps a DB/snapshot row into the domain shape used across the UI. */
export function toGanpati(r: RawGanpati): Ganpati {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    nameMr: r.name_mr,
    description: r.description,
    visitorTip: r.visitor_tip,
    category: r.category,
    area: {
      slug: r.area_slug,
      name: r.area_name,
      nameMr: r.area_name_mr,
      isCore: r.area_is_core,
    },
    location: {
      address: r.address,
      lat: r.latitude,
      lng: r.longitude,
      googlePlaceId: r.google_place_id,
    },
    manacheRank: r.manache_rank,
    prominence: r.prominence,
    establishedYear: r.established_year,
    timings: {
      open: r.timing_open,
      close: r.timing_close,
      note: r.timing_note,
    },
    darshanMinutes: r.darshan_minutes,
    peakDarshanMinutes: r.peak_darshan_minutes,
    darshanStyle: r.darshan_style ?? 'either',
    images: r.images.map(toImage).sort((a, b) => a.sortOrder - b.sortOrder),
    tags: r.tags,
    confidence: r.confidence,
    featured: r.featured,
    verified: r.verified,
    published: r.published,
    coordinateSource: r.coordinate_source ?? null,
    osmId: r.osm_id ?? null,
    crowdReportingEnabled: r.crowd_reporting_enabled ?? true,
    createdAt: '',
    updatedAt: '',
  };
}

export const CATALOGUE_GENERATED_AT = raw.generatedAt;

export const localGanpatis: Ganpati[] = raw.ganpatis.map(toGanpati);

export const localAreas: Area[] = raw.areas.map((a) => ({
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

export const localCategories: Category[] = raw.categories.map((c) => ({
  id: c.id,
  key: c.key,
  name: c.name,
  nameMr: c.name_mr,
  description: c.description,
  sortOrder: c.sort_order,
}));

export const localFestival: FestivalConfig = {
  year: raw.festival.year,
  startDate: raw.festival.start_date,
  endDate: raw.festival.end_date,
  visarjanDate: raw.festival.visarjan_date,
  greetingEn: raw.festival.greeting_en,
  greetingMr: raw.festival.greeting_mr,
  tagline: raw.festival.tagline,
};

const bySlug = new Map(localGanpatis.map((g) => [g.slug, g]));
export const getLocalGanpati = (slug: string) => bySlug.get(slug) ?? null;

/** Curated routes from the generated snapshot, joined to their mandals. */
export const localRoutes: CuratedRoute[] = (raw.routes ?? []).map((r) => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  titleMr: r.title_mr,
  summary: r.summary,
  description: r.description,
  mode: r.mode,
  timeOfDay: (r.time_of_day ?? 'any') as TimeOfDay,
  themes: r.themes,
  totalDarshanS: r.total_darshan_s,
  featured: r.featured,
  stops: r.stops
    .map((s) => {
      const ganpati = bySlug.get(s.ganpati_slug);
      return ganpati
        ? {
            ganpati,
            position: s.position,
            darshanMinutes: s.darshan_minutes,
            darshanStyle: s.darshan_style,
            note: s.note,
          }
        : null;
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => a.position - b.position),
}));

export const getLocalRoute = (slug: string) =>
  localRoutes.find((r) => r.slug === slug) ?? null;
