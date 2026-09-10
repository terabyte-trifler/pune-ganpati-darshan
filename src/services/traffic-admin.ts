import 'server-only';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { features } from '@/lib/env';

/**
 * Traffic origin, for the admin console.
 *
 * Read through the service-role client, matching how the crowd console
 * reads its own overview: `traffic_origin_overview()` grants execute to
 * service_role only, so no browser session can reach it however the URL is
 * guessed, and the page checks `isAdmin` before calling.
 *
 * The aggregation happens in Postgres rather than here. At festival volume
 * `analytics_events` is the largest table in the product, and pulling it
 * across the wire to count rows in JavaScript would be the one genuinely
 * expensive query we own.
 */

export interface CityRow {
  city: string;
  region: string | null;
  country: string | null;
  events: number;
  sessions: number;
}

export interface TrafficOverview {
  since: string;
  totalEvents: number;
  sessions: number;
  cities: CityRow[];
  countries: { country: string; sessions: number }[];
  referrers: { source: string; sessions: number }[];
  daily: { day: string; sessions: number }[];
}

const EMPTY: TrafficOverview = {
  since: new Date().toISOString(),
  totalEvents: 0,
  sessions: 0,
  cities: [],
  countries: [],
  referrers: [],
  daily: [],
};

export async function getTrafficOverview(
  windowDays = 7
): Promise<TrafficOverview | null> {
  // Null, not EMPTY: "no database configured" and "a configured database
  // with nothing in it" are different things, and the page says so.
  if (!features.supabase || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc('traffic_origin_overview', {
    p_window: `${windowDays} days`,
  });

  if (error || !data) return EMPTY;
  return data as TrafficOverview;
}
