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
