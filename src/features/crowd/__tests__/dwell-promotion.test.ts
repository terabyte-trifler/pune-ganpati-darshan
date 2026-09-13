// @vitest-environment node
//
// Node, not jsdom: dwellDeviceKey reads the server environment, which
// refuses to run where a `window` exists — correctly, since the salt must
// never reach a browser.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dwellDeviceKey } from '@/lib/dwell-key';
import {
  dwellConsensus, dwellDeviceCount,
  MIN_DWELL_DEVICES_FOR_STATUS, DWELL_DOMINANCE_SHARE,
  type DwellInput,
} from '@/services/crowd/crowd-aggregation';

/**
 * Promoting dwell to a decision-maker.
 *
 * The shadow migration allowed this on one condition — that the
 * device-keyed question be answered properly rather than inherited. What
 * is tested here is the answer: the key deduplicates, and it links
 * nothing. If any of these fail, the table has quietly become a record of
 * where people spent their evening.
 */

const A = 'device-aaaaaaaaaaaaaaaa';
const B = 'device-bbbbbbbbbbbbbbbb';
const M1 = '11111111-1111-4111-8111-111111111111';
const M2 = '22222222-2222-4222-8222-222222222222';
const EVENING = new Date('2026-09-18T16:00:00.000Z'); // 21:30 IST
const LATER = new Date('2026-09-18T17:30:00.000Z'); // 23:00 IST, same IST day
const NEXT_DAY = new Date('2026-09-19T16:00:00.000Z');

describe('the device key deduplicates', () => {
  it('is stable for one phone at one mandal through an evening', () => {
    expect(dwellDeviceKey(A, M1, EVENING)).toBe(dwellDeviceKey(A, M1, LATER));
  });

  it('separates two phones at the same mandal', () => {
    expect(dwellDeviceKey(A, M1, EVENING)).not.toBe(dwellDeviceKey(B, M1, EVENING));
  });
});

describe('and links nothing', () => {
  it('cannot be joined across mandals — no route through the peths', () => {
    expect(dwellDeviceKey(A, M1, EVENING)).not.toBe(dwellDeviceKey(A, M2, EVENING));
  });

  it('cannot be joined across days — no festival-long identifier', () => {
    expect(dwellDeviceKey(A, M1, EVENING)).not.toBe(dwellDeviceKey(A, M1, NEXT_DAY));
  });

  it('is not the device id, nor anything containing it', () => {
    const key = dwellDeviceKey(A, M1, EVENING);
    expect(key).not.toContain(A);
    expect(key).not.toBe(A);
    expect(key).toMatch(/^[0-9a-f]{32}$/);
  });

  it('rolls at IST midnight, not UTC midnight', () => {
    // 19:00 UTC on the 18th is 00:30 IST on the 19th — a new festival day
    // in Pune, which is the boundary that matters here.
    const beforeIstMidnight = new Date('2026-09-18T18:00:00.000Z');
    const afterIstMidnight = new Date('2026-09-18T19:00:00.000Z');
    expect(dwellDeviceKey(A, M1, beforeIstMidnight)).not.toBe(
      dwellDeviceKey(A, M1, afterIstMidnight)
    );
  });
});

describe('the promotion gate', () => {
  const now = Date.parse('2026-09-18T16:00:00.000Z');
  const sample = (dwell: 'lingering' | 'queueing', key: string | null): DwellInput => ({
    dwell,
    createdAt: new Date(now - 5 * 60_000).toISOString(),
    deviceKey: key,
  });

  it('ignores rows it cannot attribute, however many', () => {
    const shadowRows = Array.from({ length: 50 }, () => sample('queueing', null));
    expect(dwellConsensus(shadowRows, now)).toBeNull();
  });

  it('collapses one visit to one device', () => {
    // A lingering marker, a queueing marker and a final sample.
    const oneVisit = [sample('lingering', 'k'), sample('queueing', 'k'), sample('queueing', 'k')];
    expect(dwellDeviceCount(oneVisit, now)).toBe(1);
  });

  it('takes the strongest class that device reached', () => {
    const rising = [
      sample('lingering', 'a'), sample('queueing', 'a'),
      sample('lingering', 'b'), sample('queueing', 'b'),
      sample('lingering', 'c'), sample('queueing', 'c'),
    ];
    expect(dwellConsensus(rising, now)?.level).toBe('long');
  });

  it('needs the minimum devices, and they have to agree', () => {
    expect(MIN_DWELL_DEVICES_FOR_STATUS).toBeGreaterThanOrEqual(3);
    expect(DWELL_DOMINANCE_SHARE).toBeGreaterThan(0.5);
  });
});

describe('what the table may still never hold', () => {
  it('has no device id and no coordinate column', () => {
    const sql = readFileSync(
      'supabase/migrations/20260914160000_dwell_device_key.sql',
      'utf8'
    );
    // The migration verifies this against the live schema on apply; this
    // asserts the check itself was not quietly dropped from the file.
    expect(sql).toContain("column_name = 'device_id'");
    expect(sql).toContain("'lat', 'lng', 'latitude', 'longitude'");
  });
});
