/**
 * Database bindings, kept in step with supabase/migrations/*.sql.
 *
 * Hand-authored rather than generated: the generated output inlines every
 * relationship and is unreadable in review, and this file is the contract
 * the whole app types against.
 */

export type GanpatiCategoryEnum = 'maanache' | 'famous' | 'historic' | 'local';
export type DataConfidenceEnum = 'verified' | 'community' | 'demo';
export type TravelModeEnum = 'walk' | 'two_wheeler' | 'drive' | 'transit';

export type AreaRow = {
  id: string;
  slug: string;
  name: string;
  name_mr: string | null;
  city: string;
  is_core: boolean;
  centroid_lat: number | null;
  centroid_lng: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type CategoryRow = {
  id: string;
  key: GanpatiCategoryEnum;
  name: string;
  name_mr: string | null;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type GanpatiRow = {
  id: string;
  slug: string;
  name: string;
  name_mr: string | null;
  description: string | null;
  visitor_tip: string | null;
  category: GanpatiCategoryEnum;
  area_id: string;
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
  tags: string[];
  confidence: DataConfidenceEnum;
  featured: boolean;
  verified: boolean;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export type GanpatiImageRow = {
  id: string;
  ganpati_id: string;
  url: string;
  alt: string | null;
  credit: string | null;
  width: number | null;
  height: number | null;
  blur_data_url: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export type FavoriteRow = {
  user_id: string;
  ganpati_id: string;
  created_at: string;
}

export type DarshanPlanRow = {
  id: string;
  share_id: string;
  user_id: string | null;
  title: string;
  mode: TravelModeEnum;
  origin_lat: number | null;
  origin_lng: number | null;
  origin_label: string | null;
  total_distance_m: number | null;
  total_duration_s: number | null;
  route_computed_at: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export type DarshanPlanStopRow = {
  id: string;
  plan_id: string;
  ganpati_id: string;
  position: number;
  leg_distance_m: number | null;
  leg_duration_s: number | null;
  created_at: string;
}

export type FestivalConfigRow = {
  id: string;
  year: number;
  start_date: string;
  end_date: string;
  visarjan_date: string;
  greeting_en: string;
  greeting_mr: string;
  tagline: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type AnalyticsEventRow = {
  id: number;
  name: string;
  session_id: string | null;
  ganpati_id: string | null;
  props: Record<string, unknown>;
  created_at: string;
}

/** Return shape of the search_ganpatis() RPC. */
export type SearchGanpatiResult = {
  id: string;
  slug: string;
  name: string;
  name_mr: string | null;
  category: GanpatiCategoryEnum;
  area_slug: string;
  area_name: string;
  latitude: number;
  longitude: number;
  prominence: number;
  rank: number;
}

/** Return shape of the nearby_ganpatis() RPC. */
export type NearbyGanpatiResult = Omit<SearchGanpatiResult, 'rank'> & {
  distance_m: number;
};

/**
 * NOTE: every Row above is a `type`, not an `interface`. supabase-js checks
 * `Schema extends GenericSchema`, which requires each Row to satisfy
 * `Record<string, unknown>`. Interfaces have no implicit index signature and
 * fail that check silently — the schema resolves to `never` and every query
 * result becomes `never`. Type aliases do satisfy it.
 */
type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      areas: Table<AreaRow>;
      categories: Table<CategoryRow>;
      ganpatis: Table<GanpatiRow>;
      ganpati_images: Table<GanpatiImageRow>;
      profiles: Table<ProfileRow>;
      favorites: Table<FavoriteRow>;
      darshan_plans: Table<DarshanPlanRow>;
      darshan_plan_stops: Table<DarshanPlanStopRow>;
      festival_config: Table<FestivalConfigRow>;
      analytics_events: Table<AnalyticsEventRow>;
    };
    Views: Record<never, never>;
    Functions: {
      search_ganpatis: {
        Args: { q: string; max_results?: number };
        Returns: SearchGanpatiResult[];
      };
      nearby_ganpatis: {
        Args: { lat: number; lng: number; radius_m?: number; max_results?: number };
        Returns: NearbyGanpatiResult[];
      };
      is_admin: { Args: Record<never, never>; Returns: boolean };
    };
    Enums: {
      ganpati_category: GanpatiCategoryEnum;
      data_confidence: DataConfidenceEnum;
      travel_mode: TravelModeEnum;
    };
    CompositeTypes: Record<never, never>;
  };
}
