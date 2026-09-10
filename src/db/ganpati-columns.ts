/**
 * Every `ganpatis` column the row mapper reads, listed once.
 *
 * Deliberately not inside the server-only service: the query and the tests
 * that guard it both need this list, and duplicating it is exactly the
 * failure being guarded against.
 *
 * When `darshan_minutes` was added for time budgeting, the select was not
 * updated. Every mandal came back with a null dwell time, the planner fell
 * back to five minutes per stop, and route timings were wrong in a way
 * nothing failed on — the unit tests passed because they run against the
 * generated snapshot, which had the values.
 */
export const GANPATI_COLUMNS = [
  'id', 'slug', 'name', 'name_mr', 'description', 'visitor_tip', 'category',
  'address', 'latitude', 'longitude', 'google_place_id', 'manache_rank',
  'prominence', 'established_year',
  'timing_open', 'timing_close', 'timing_note',
  'darshan_minutes', 'peak_darshan_minutes', 'darshan_style',
  'tags', 'confidence', 'featured', 'verified', 'published',
  'coordinate_source', 'osm_id',
  'crowd_reporting_enabled',
  'is_temple',
] as const;

/** Fields the snapshot adds by joining; not columns on `ganpatis`. */
export const DERIVED_CATALOGUE_FIELDS = [
  'area_slug', 'area_name', 'area_name_mr', 'area_is_core', 'images',
] as const;
