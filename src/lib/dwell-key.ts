import 'server-only';

import { createHash } from 'node:crypto';
import { serverEnv } from '@/lib/env.server';

/**
 * A dwell sample's identity, which is not an identity.
 *
 * Dwell can now colour a mandal on its own, so the samples have to be
 * countable by device — otherwise one caller with a loop is a crowd. But
 * storing the device id would turn the table into a record of where
 * somebody spent their evening, which is precisely what it was built to
 * avoid.
 *
 * So the stored value is a digest of the device, the mandal, the IST
 * date and a salt. Same phone, same mandal, same evening → same key, so
 * deduplication works. Different mandal or different day → unrelated key,
 * so the rows cannot be assembled into a route or a history. And the salt
 * means nobody holding the table can test a device id against it.
 *
 * The raw id never reaches the database from this path. It is used here,
 * and once more against the block list, and then it is gone.
 */

/**
 * See client-ip for the same reasoning: a fixed fallback keeps this
 * working without configuration and stays consistent across instances,
 * where a per-process random salt would silently split one device into
 * many. Set CROWD_DWELL_SALT in production.
 */
const DWELL_SALT_FALLBACK = 'pune-ganpati-darshan/crowd-dwell/v1';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** YYYY-MM-DD in IST — the festival's own day boundary, not UTC's. */
function istDay(at: Date): string {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function dwellDeviceKey(
  deviceId: string,
  mandalId: string,
  at: Date = new Date()
): string {
  const { CROWD_DWELL_SALT } = serverEnv();
  const salt = CROWD_DWELL_SALT ?? DWELL_SALT_FALLBACK;
  return createHash('sha256')
    .update(`${salt}:${mandalId}:${istDay(at)}:${deviceId}`)
    .digest('hex')
    .slice(0, 32);
}
