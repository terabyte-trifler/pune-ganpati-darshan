/**
 * Domain types. These are the app's vocabulary — the DB row shapes in
 * `src/db/` are mapped into these at the service boundary so that UI code
 * never depends on column naming.
 */

export type GanpatiCategory = 'maanache' | 'famous' | 'historic' | 'local';

/**
 * How far a record can be trusted. Rendered in the UI: a visitor deciding
 * whether to cross the city deserves to know which claims are checked.
 */
export type DataConfidence = 'verified' | 'community' | 'demo';

export type TravelMode = 'walk' | 'two_wheeler' | 'drive' | 'transit';

/** Whether you queue to go in, or take darshan from the road. */
export type DarshanStyle = 'inside' | 'outside' | 'either';

export interface Area {
  id: string;
  slug: string;
  name: string;
  nameMr: string | null;
  city: string;
  isCore: boolean;
  centroid: { lat: number; lng: number } | null;
  sortOrder: number;
}

export interface Category {
  id: string;
  key: GanpatiCategory;
  name: string;
  nameMr: string | null;
  description: string | null;
  sortOrder: number;
}

export interface GanpatiImage {
  id: string;
  url: string;
  alt: string | null;
  credit: string | null;
  width: number | null;
  height: number | null;
  blurDataUrl: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

/**
 * Darshan timings are nullable by design. Mandals announce them close to
 * the festival; publishing a guess would send someone across Pune for
 * nothing. `note` carries anything qualitative we do know.
 */
export interface Timings {
  open: string | null;
  close: string | null;
  note: string | null;
}

export interface Ganpati {
  id: string;
  slug: string;
  name: string;
  nameMr: string | null;
  description: string | null;
  visitorTip: string | null;

  category: GanpatiCategory;
  area: Pick<Area, 'slug' | 'name' | 'nameMr' | 'isCore'>;

  location: {
    address: string | null;
    lat: number;
    lng: number;
    googlePlaceId: string | null;
  };

  /** Ceremonial order 1-5, present only for the Manache Paach. */
  manacheRank: number | null;
  /** Editorial footfall weight 0-1000. Not a rating; never shown as stars. */
  prominence: number;
  establishedYear: number | null;

  timings: Timings;

  /**
   * Typical minutes spent AT the mandal — queue plus darshan, excluding
   * travel. This is what makes a time-budgeted route possible: at Dagdusheth
   * the queue dwarfs the walk. Null when unknown; never guessed per-mandal.
   */
  darshanMinutes: number | null;
  /** The bad case, when a queue is genuinely unpredictable. */
  peakDarshanMinutes: number | null;
  darshanStyle: DarshanStyle;

  images: GanpatiImage[];
  tags: string[];

  confidence: DataConfidence;
  featured: boolean;
  verified: boolean;
  /** Unpublished mandals are visible to admins only (enforced by RLS). */
  published: boolean;

  createdAt: string;
  updatedAt: string;
}

/** A Ganpati plus a distance, produced by a nearby/route query. */
export interface GanpatiWithDistance extends Ganpati {
  distanceM: number;
}

export interface FestivalConfig {
  year: number;
  startDate: string;
  endDate: string;
  visarjanDate: string;
  greetingEn: string;
  greetingMr: string;
  tagline: string | null;
}

export interface PlanStop {
  ganpatiId: string;
  slug: string;
  name: string;
  nameMr: string | null;
  lat: number;
  lng: number;
  position: number;
  legDistanceM: number | null;
  legDurationS: number | null;
}

export interface DarshanPlan {
  id: string;
  shareId: string;
  title: string;
  mode: TravelMode;
  origin: { lat: number; lng: number; label: string | null } | null;
  totalDistanceM: number | null;
  totalDurationS: number | null;
  stops: PlanStop[];
  createdAt: string;
}

/** A stop on a curated route. Overrides the mandal's default dwell time. */
export interface RouteStop {
  ganpati: Ganpati;
  position: number;
  darshanMinutes: number | null;
  darshanStyle: DarshanStyle | null;
  note: string | null;
}

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night' | 'any';

export interface CuratedRoute {
  id: string;
  slug: string;
  title: string;
  titleMr: string | null;
  summary: string | null;
  description: string | null;
  mode: TravelMode;
  timeOfDay: TimeOfDay;
  themes: string[];
  /** Sum of stop dwell times, cached. Travel time is computed separately. */
  totalDarshanS: number | null;
  featured: boolean;
  stops: RouteStop[];
}
