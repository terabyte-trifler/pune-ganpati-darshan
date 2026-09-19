import { describe, it, expect } from 'vitest';
import {
  aggregateMandal, levelForWaitMinutes, MIN_WAITS_TO_LOWER_COLOUR,
} from '@/services/crowd/crowd-aggregation';
import {
  redThresholdFor, DEFAULT_RED_THRESHOLD_MIN, RED_THRESHOLD_BY_SLUG,
} from '@/content/crowd-thresholds';

const NOW = Date.parse('2026-09-19T15:00:00.000Z');
const minsAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

/** `n` people voting the same level, each its own device. */
const votes = (status: 'short' | 'moving' | 'long', n: number) =>
  Array.from({ length: n }, (_, i) => ({
    mandalId: 'm', status, createdAt: minsAgo(5), atMandal: true, deviceSeq: i + 1,
  }));

const waits = (minutes: number[], ago = 5) =>
  minutes.map((m) => ({ minutes: m, createdAt: minsAgo(ago) }));

describe('the per-mandal red threshold', () => {
  it('gives Shanipar and Dagdusheth 30', () => {
    expect(redThresholdFor('shanipar-mandal')).toBe(30);
    expect(redThresholdFor('dagdusheth-halwai-ganpati')).toBe(30);
  });

  it('pins those two by name rather than letting them inherit', () => {
    // Both now equal DEFAULT_RED_THRESHOLD_MIN, so redThresholdFor alone
    // can no longer tell a decision from an inheritance — the test above
    // would pass with the entries deleted. These two were decided about
    // by name, and must not be carried along by a future change to the
    // default. Asserting on the map is the only thing that catches that.
    expect(RED_THRESHOLD_BY_SLUG['shanipar-mandal']).toBe(30);
    expect(RED_THRESHOLD_BY_SLUG['dagdusheth-halwai-ganpati']).toBe(30);
  });

  it('leaves every other mandal on the flat threshold', () => {
    expect(redThresholdFor('tulshibaug-ganpati')).toBe(DEFAULT_RED_THRESHOLD_MIN);
    expect(redThresholdFor(null)).toBe(DEFAULT_RED_THRESHOLD_MIN);
    expect(redThresholdFor('not-a-mandal')).toBe(DEFAULT_RED_THRESHOLD_MIN);
  });

  it('moves the boundary red sits at', () => {
    expect(levelForWaitMinutes(30, 35)).toBe('moving');
    expect(levelForWaitMinutes(35, 35)).toBe('long');
    expect(levelForWaitMinutes(30, 30)).toBe('long');
  });
});

/**
 * The two readings that prompted this.
 *
 * The live snapshot showed Dagdusheth "Heavy" beside a reported wait of
 * 25 minutes, and Shanipar "Heavy" beside 20 — the colour coming from the
 * level votes and the minutes from the wait votes, with nothing stopping
 * the two contradicting each other.
 */
describe('a badge may not contradict the minutes printed beside it', () => {
  it('takes Dagdusheth off red at 25 minutes', () => {
    const got = aggregateMandal('m', votes('long', 5), NOW, [], waits([25, 25, 20, 30, 25]), 35);
    expect(got.waitMedianMinutes).toBe(25);
    expect(got.status).toBe('moving');
  });

  it('keeps Dagdusheth red once the wait reaches its own threshold', () => {
    const got = aggregateMandal('m', votes('long', 5), NOW, [], waits([35, 40, 45]), 35);
    expect(got.status).toBe('long');
  });

  it('takes Shanipar off red at 20 minutes', () => {
    const got = aggregateMandal('m', votes('long', 4), NOW, [], waits([20, 20, 15, 20]), 30);
    expect(got.status).toBe('moving');
  });

  it('keeps Shanipar red at 30', () => {
    const got = aggregateMandal('m', votes('long', 4), NOW, [], waits([30, 30, 45]), 30);
    expect(got.status).toBe('long');
  });

  /**
   * The guard on the new direction. Raising a colour still takes one
   * report; lowering one takes two, because a single visitor who walked
   * straight in must not talk a heavy queue down for everyone behind.
   */
  it('will not lower a colour on a single wait report', () => {
    const one = aggregateMandal('m', votes('long', 5), NOW, [], waits([10]), 35);
    expect(one.waitReportCount).toBe(1);
    expect(one.status).toBe('long');

    // The same reading, one more agreeing report, and it comes down.
    const two = aggregateMandal('m', votes('long', 5), NOW, [], waits([10, 10]), 35);
    expect(two.waitReportCount).toBe(MIN_WAITS_TO_LOWER_COLOUR);
    expect(two.status).toBe('moving');
  });

  it('still raises on a single wait report', () => {
    const got = aggregateMandal('m', votes('short', 3), NOW, [], waits([40]), 35);
    expect(got.status).toBe('long');
  });

  /** It caps red; it does not reach down to short. */
  it('stops at moving rather than following the minutes all the way down', () => {
    const got = aggregateMandal('m', votes('long', 5), NOW, [], waits([2, 3, 2]), 35);
    expect(got.status).toBe('moving');
  });

  it('leaves a mandal with no wait reports to its votes', () => {
    const got = aggregateMandal('m', votes('long', 5), NOW, [], [], 35);
    expect(got.status).toBe('long');
  });

  /** An old wait describes a queue that has since moved. */
  it('ignores waits too old to describe the queue now', () => {
    const got = aggregateMandal('m', votes('long', 5), NOW, [], waits([10, 10, 10], 300), 35);
    expect(got.status).toBe('long');
  });
});
