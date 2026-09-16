import { describe, it, expect } from 'vitest';
import {
  observedWaitMinutes,
  MIN_DEVICES_FOR_OBSERVED_WAIT,
} from '@/services/crowd/crowd-aggregation';
import { queueTimeFor } from '@/features/crowd/crowd-display';
import type { PriorInput } from '@/services/crowd/crowd-prior';
import type { DwellInput } from '@/services/crowd/crowd-aggregation';

const NOW = Date.parse('2026-09-19T15:00:00.000Z');
const minsAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

/** A completed visit: the only row that carries a measured duration. */
const visit = (device: string, seconds: number, crossing = 120): DwellInput => ({
  dwell: 'queueing',
  createdAt: minsAgo(5),
  deviceKey: device,
  dwellSeconds: seconds,
  isFinal: true,
  crossingSeconds: crossing,
  maxPlausibleSeconds: 9000,
});

describe('observedWaitMinutes', () => {
  it('is null below the device floor', () => {
    const rows = Array.from({ length: MIN_DEVICES_FOR_OBSERVED_WAIT - 1 }, (_, i) =>
      visit(`d${i}`, 1200)
    );
    expect(observedWaitMinutes(rows, NOW)).toBeNull();
  });

  it('subtracts the walk across the zone', () => {
    // 720s inside, 120s of that is simply crossing it → 10 minutes queued.
    const rows = ['a', 'b', 'c'].map((d) => visit(d, 720, 120));
    expect(observedWaitMinutes(rows, NOW)?.minutes).toBe(10);
  });

  /**
   * A threshold marker's duration IS the threshold, quantised to the
   * 30-second clock — it always reads exactly 90 or 360. A median over
   * those measures the constants in the file, not any queue.
   */
  it('ignores threshold markers and uses completed visits only', () => {
    const markers: DwellInput[] = ['a', 'b', 'c'].map((d) => ({
      ...visit(d, 360),
      isFinal: false,
    }));
    expect(observedWaitMinutes(markers, NOW)).toBeNull();
  });

  it('counts one reading per device, so one phone cannot weight it', () => {
    const rows = [
      visit('a', 600), visit('a', 660), visit('a', 690), visit('a', 720),
      visit('b', 600), visit('c', 600),
    ];
    const got = observedWaitMinutes(rows, NOW);
    expect(got?.devices).toBe(3);
  });

  it('drops unattributable rows — they cannot be counted as devices', () => {
    const rows = ['a', 'b', 'c'].map((d) => ({ ...visit(d, 900), deviceKey: null }));
    expect(observedWaitMinutes(rows, NOW)).toBeNull();
  });

  it('drops a parked phone above the plausible ceiling', () => {
    const rows = ['a', 'b', 'c'].map((d) => ({
      ...visit(d, 20_000),
      maxPlausibleSeconds: 9000,
    }));
    expect(observedWaitMinutes(rows, NOW)).toBeNull();
  });

  it('ignores samples outside the active window', () => {
    const rows = ['a', 'b', 'c'].map((d) => ({ ...visit(d, 900), createdAt: minsAgo(600) }));
    expect(observedWaitMinutes(rows, NOW)).toBeNull();
  });
});

const DAGDUSHETH: PriorInput = {
  darshanMinutes: 45,
  peakDarshanMinutes: 150,
  prominence: 1000,
};
const SMALL: PriorInput = {
  darshanMinutes: 5,
  peakDarshanMinutes: 12,
  prominence: 150,
};

describe('queueTimeFor — the devices raise a wait, never lower it', () => {
  /**
   * The regression this whole feature turns on.
   *
   * Production dwell measures 7.9 minutes at Dagdusheth against a curated
   * peak of 150. The sample misses everyone who closed the tab mid-queue
   * and includes everyone photographing the dekhava from the road, so it
   * under-reads — and publishing it would tell people the busiest mandal
   * in Pune is an eight-minute wait.
   */
  it('never lets a low measurement pull down Dagdusheth', () => {
    const withDevices = queueTimeFor(
      { status: 'long', waitMedianMinutes: null, observedWaitMinutes: 8 },
      DAGDUSHETH
    );
    const without = queueTimeFor(
      { status: 'long', waitMedianMinutes: null, observedWaitMinutes: null },
      DAGDUSHETH
    );
    expect(withDevices).toEqual(without);
    expect(withDevices!.source).toBe('modelled');
    expect(withDevices!.minutes).toBeGreaterThan(8);
  });

  it('raises a figure the model has set too low', () => {
    const modelled = queueTimeFor(
      { status: 'short', waitMedianMinutes: null, observedWaitMinutes: null },
      SMALL
    )!;
    const observed = queueTimeFor(
      { status: 'short', waitMedianMinutes: null, observedWaitMinutes: 10 },
      SMALL
    )!;
    expect(observed.minutes).toBe(10);
    expect(observed.source).toBe('observed');
    expect(observed.minutes).toBeGreaterThan(modelled.minutes);
  });

  /**
   * The device floor is two. Two phones can establish that a queue ran
   * longer than the model thinks; they cannot establish a new record for
   * the mandal. Jilbya Maruti really does measure 14 against a peak of 12.
   */
  it('never claims more than the mandal’s own curated peak', () => {
    const got = queueTimeFor(
      { status: 'short', waitMedianMinutes: null, observedWaitMinutes: 90 },
      SMALL
    )!;
    expect(got.minutes).toBe(SMALL.peakDarshanMinutes);
    expect(got.source).toBe('observed');
  });

  /** A person saying how long they stood outranks a passive sample. */
  it('never displaces a reported wait', () => {
    const got = queueTimeFor(
      { status: 'long', waitMedianMinutes: 90, observedWaitMinutes: 120 },
      DAGDUSHETH
    );
    expect(got).toEqual({ minutes: 90, source: 'reported' });
  });

  it('still answers when there is no prior at all', () => {
    const got = queueTimeFor(
      { status: 'moving', waitMedianMinutes: null, observedWaitMinutes: 14 },
      null
    );
    expect(got).toEqual({ minutes: 14, source: 'observed' });
  });

  it('is unchanged when the devices measured nothing', () => {
    const got = queueTimeFor(
      { status: 'moving', waitMedianMinutes: null, observedWaitMinutes: null },
      SMALL
    );
    expect(got?.source).toBe('modelled');
  });
});
