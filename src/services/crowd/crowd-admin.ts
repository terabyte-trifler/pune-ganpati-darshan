import 'server-only';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { features } from '@/lib/env';
import { getCrowdCache } from './crowd-cache';

/**
 * Admin-side reads and controls for the crowd feature (§57, §58).
 *
 * Every function here assumes the caller has already been authorised —
 * `requireAdmin()` in the page or action above it is the boundary. These
 * use the service-role client, so nothing in this file may ever be
 * reachable from an unauthenticated path.
 */

export interface CrowdAdminOverview {
  reportsToday: number;
  reportsLastHour: number;
  reportsLast15Min: number;
  activeMandals: number;
  activeDevices: number;
  mostReported: { slug: string; name: string; reports: number }[];
  openSignals: {
    device_digest: string;
    device_id: string;
    signal: string;
    occurrences: number;
    last_seen: string;
  }[];
}

const EMPTY: CrowdAdminOverview = {
  reportsToday: 0,
  reportsLastHour: 0,
  reportsLast15Min: 0,
  activeMandals: 0,
  activeDevices: 0,
  mostReported: [],
  openSignals: [],
};

export async function getCrowdAdminOverview(): Promise<CrowdAdminOverview | null> {
  if (!features.supabase || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc('crowd_admin_overview');
  if (error || !data) return EMPTY;
  return data as CrowdAdminOverview;
}

/** Turn reporting off (or back on) for one mandal. */
export async function setMandalReporting(mandalId: string, enabled: boolean) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('ganpatis')
    .update({ crowd_reporting_enabled: enabled })
    .eq('id', mandalId);

  if (error) throw new Error('Could not change reporting for this mandal');

  // The flag rides on the catalogue, and the crowd cache holds aggregated
  // status keyed by the same mandal — drop it so the change is visible on
  // the next read rather than up to a TTL later.
  await getCrowdCache().invalidate(mandalId);
}

/**
 * Block a device.
 *
 * Blocked devices are told "rate_limited", the same as any other throttle,
 * so a blocked abuser cannot tell whether they have been singled out and
 * start cycling device ids in response.
 */
export async function blockDevice(
  deviceId: string,
  reason: string,
  blockedUntil: Date | null,
  adminUserId: string
) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from('crowd_device_blocks').upsert({
    device_id: deviceId,
    reason,
    blocked_until: blockedUntil?.toISOString() ?? null,
    created_by: adminUserId,
  });
  if (error) throw new Error('Could not block this device');
}

export async function unblockDevice(deviceId: string) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('crowd_device_blocks')
    .delete()
    .eq('device_id', deviceId);
  if (error) throw new Error('Could not unblock this device');
}

export async function listDeviceBlocks() {
  if (!features.supabase || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from('crowd_device_blocks')
    .select('device_id, reason, blocked_until, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  return data ?? [];
}

/** Retention sweep (§36). Run off-peak. */
export async function runCrowdCleanup() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc('cleanup_crowd_data', {});
  if (error) throw new Error('Cleanup failed');
  return data as Record<string, number>;
}
