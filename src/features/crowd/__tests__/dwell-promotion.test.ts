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
  MIN_DWELL_DEVICES_FOR_STATUS, MIN_DWELL_DEVICES_FOR_SHORT, DWELL_DOMINANCE_SHARE,
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

  it('never lets a single device call a mandal short', () => {
    // The bar is currently one — a festival-night setting — which means
    // the dominance rule can no longer refuse anything and the short veto
    // has nobody to do the contradicting. So short carries its own,
    // higher requirement, and that is the invariant worth pinning: this
    // may drop to one, but never for `short`.
    expect(MIN_DWELL_DEVICES_FOR_SHORT).toBeGreaterThanOrEqual(2);
    expect(MIN_DWELL_DEVICES_FOR_SHORT).toBeGreaterThan(MIN_DWELL_DEVICES_FOR_STATUS - 1);
    expect(DWELL_DOMINANCE_SHARE).toBeGreaterThan(0.5);
  });
});

describe('a completed visit can say short — carefully', () => {
  const now = Date.parse('2026-09-18T16:00:00.000Z');
  // Tulshibaug: 50 m zone, 155s to walk across, queueing at 622s.
  const CROSS_SMALL = 155;
  // Dagdusheth: 65 m zone, 202s across.
  const CROSS_BIG = 202;

  const visit = (
    key: string,
    dwellSeconds: number,
    crossingSeconds: number,
    dwell: 'lingering' | 'queueing' = 'lingering'
  ): DwellInput => ({
    dwell,
    createdAt: new Date(now - 4 * 60_000).toISOString(),
    deviceKey: key,
    dwellSeconds,
    isFinal: true,
    crossingSeconds,
  });

  const marker = (
    key: string,
    dwell: 'lingering' | 'queueing',
    crossingSeconds: number
  ): DwellInput => ({
    dwell,
    createdAt: new Date(now - 6 * 60_000).toISOString(),
    deviceKey: key,
    dwellSeconds: dwell === 'queueing' ? crossingSeconds * 4 : crossingSeconds * 1.5,
    isFinal: false,
    crossingSeconds,
  });

  it('reads three quick completed visits as short', () => {
    // Eight minutes in the zone, 2.6 of which is walking across it: five
    // and a half minutes unexplained, which the wait scale calls short.
    const quick = ['a', 'b', 'c'].map((k) => visit(k, 8 * 60, CROSS_SMALL));
    expect(dwellConsensus(quick, now)?.level).toBe('short');
  });

  it('subtracts the walk, so a big zone is not read as a wait', () => {
    // The same eight minutes at a 75 m zone is mostly transit.
    const bigZone = ['a', 'b', 'c'].map((k) => visit(k, 8 * 60, 470));
    expect(dwellConsensus(bigZone, now)?.level).toBe('short');
    // And a real wait still reads as one, at either size.
    const waited = ['a', 'b', 'c'].map((k) => visit(k, 25 * 60, CROSS_SMALL));
    expect(dwellConsensus(waited, now)?.level).toBe('moving');
  });

  it('never says short on a threshold marker alone', () => {
    // A marker is a lower bound: the visit was still running when it was
    // written, so it cannot argue the queue was short.
    const markersOnly = ['a', 'b', 'c'].map((k) => marker(k, 'lingering', CROSS_SMALL));
    expect(dwellConsensus(markersOnly, now)?.level).toBe('moving');
  });

  it('refuses short at Dagdusheth when one person actually queued', () => {
    // The case this guard exists for. Three people stand on the road
    // outside for six minutes and walk on — exactly what a short mandal
    // looks like — while a fourth is in the queue. Without the veto the
    // busiest mandal in Pune goes green off passers-by.
    const passersBy = ['a', 'b', 'c'].map((k) => visit(k, 6 * 60, CROSS_BIG));
    expect(dwellConsensus(passersBy, now)?.level).toBe('short');

    const andOneQueueing = [...passersBy, marker('d', 'queueing', CROSS_BIG)];
    expect(dwellConsensus(andOneQueueing, now)).toBeNull();
  });

  it('still lets a queue be seen when most people are in it', () => {
    const queueing = ['a', 'b', 'c'].map((k) => marker(k, 'queueing', CROSS_BIG));
    expect(dwellConsensus(queueing, now)?.level).toBe('long');
  });

  it('reads one device\'s marker and final together, not as two devices', () => {
    const oneVisit = [marker('a', 'lingering', CROSS_SMALL), visit('a', 8 * 60, CROSS_SMALL)];
    expect(dwellConsensus(oneVisit, now)).toBeNull();
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
