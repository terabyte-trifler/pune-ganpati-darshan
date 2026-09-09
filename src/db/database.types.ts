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
export type DarshanStyleEnum = 'inside' | 'outside' | 'either';
export type CrowdLevelEnum = 'short' | 'moving' | 'long';

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
  darshan_minutes: number | null;
  peak_darshan_minutes: number | null;
  darshan_style: DarshanStyleEnum;
  tags: string[];
  confidence: DataConfidenceEnum;
  featured: boolean;
  verified: boolean;
  published: boolean;
  /** Provenance of latitude/longitude: openstreetmap, cross-checked, … */
  coordinate_source: string | null;
  /** OSM element id backing the coordinate, when that is the source. */
  osm_id: string | null;
  /** Admin kill switch for crowd reporting on this mandal. */
  crowd_reporting_enabled: boolean;
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
export type RouteRow = {
  id: string;
  slug: string;
  title: string;
  title_mr: string | null;
  summary: string | null;
  description: string | null;
  mode: TravelModeEnum;
  time_of_day: string | null;
  themes: string[];
  total_distance_m: number | null;
  total_walk_s: number | null;
  total_darshan_s: number | null;
  featured: boolean;
  published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type RouteStopRow = {
  id: string;
  route_id: string;
  ganpati_id: string;
  position: number;
  darshan_minutes: number | null;
  darshan_style: DarshanStyleEnum | null;
  note: string | null;
  created_at: string;
};

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type CrowdReportRow = {
  id: string;
  mandal_id: string;
  device_id: string;
  status: CrowdLevelEnum;
  request_id: string | null;
  created_at: string;
}

export type CrowdReportCooldownRow = {
  device_id: string;
  mandal_id: string;
  last_report_at: string;
}

export type CrowdAbuseSignalRow = {
  id: string;
  device_id: string;
  signal: string;
  detail: Record<string, unknown>;
  created_at: string;
}

export type CrowdDeviceBlockRow = {
  device_id: string;
  reason: string;
  blocked_until: string | null;
  created_at: string;
  created_by: string | null;
}

export type RateLimitBucketRow = {
  bucket: string;
  key_hash: string;
  window_start: string;
  count: number;
}

/**
 * Row shape of crowd_active_reports(). Deliberately narrow (§26): the
 * aggregator needs the level, when it was said, and whether the person was
 * there. No device identifier ever leaves the database.
 */
export type CrowdActiveReportResult = {
  mandal_id: string;
  status: CrowdLevelEnum;
  created_at: string;
  at_mandal: boolean | null;
}

export type CrowdDeviceCooldownResult = {
  mandal_id: string;
  retry_after: number;
}

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
      routes: Table<RouteRow>;
      route_stops: Table<RouteStopRow>;
      crowd_reports: Table<CrowdReportRow>;
      crowd_report_cooldowns: Table<CrowdReportCooldownRow>;
      crowd_abuse_signals: Table<CrowdAbuseSignalRow>;
      crowd_device_blocks: Table<CrowdDeviceBlockRow>;
      rate_limit_buckets: Table<RateLimitBucketRow>;
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
      crowd_active_reports: {
        Args: { p_mandal_ids: string[]; p_window?: string };
        Returns: CrowdActiveReportResult[];
      };
      crowd_device_cooldowns: {
        Args: { p_device_id: string; p_mandal_ids: string[]; p_cooldown?: string };
        Returns: CrowdDeviceCooldownResult[];
      };
      submit_crowd_report: {
        Args: {
          p_mandal_id: string;
          p_device_id: string;
          p_status: CrowdLevelEnum;
          p_request_id?: string | null;
          p_ip_hash?: string | null;
          p_at_mandal?: boolean;
        };
        Returns: unknown;
      };
      crowd_admin_overview: { Args: Record<never, never>; Returns: unknown };
      consume_rate_limit: {
        Args: {
          p_bucket: string;
          p_key_hash: string;
          p_window: string;
          p_limit: number;
        };
        Returns: unknown;
      };
      cleanup_crowd_data: {
        Args: { p_report_retention?: string; p_signal_retention?: string };
        Returns: unknown;
      };
    };
    Enums: {
      ganpati_category: GanpatiCategoryEnum;
      data_confidence: DataConfidenceEnum;
      travel_mode: TravelModeEnum;
      darshan_style: DarshanStyleEnum;
      crowd_level: CrowdLevelEnum;
    };
    CompositeTypes: Record<never, never>;
  };
}
