import { describe, it, expect } from 'vitest';
import { queueTimeFor } from '@/features/crowd/crowd-display';
import { waitForLevel } from '@/services/crowd/crowd-prior';
import type { PriorInput } from '@/services/crowd/crowd-prior';

/**
 * How long the queue is, per mandal.
 *
 * The app carried a wait figure and rendered it nowhere, and threw it away
 * entirely the moment anybody reported a queue — so it stopped saying how
 * long the wait was exactly when it knew most about it.
 *
 * Two rules hold everything else up: a reported wait beats a worked-out
 * one, and a worked-out one is specific to the mandal rather than a number
 * applied to all of them.
 */
const BIG: PriorInput = { darshanMinutes: 45, peakDarshanMinutes: 120, prominence: 100 } as PriorInput;
const SMALL: PriorInput = { darshanMinutes: 6, peakDarshanMinutes: 15, prominence: 20 } as PriorInput;

describe('queue time', () => {
  it('prefers what people actually waited over anything modelled', () => {
    const wait = queueTimeFor({ status: 'long', waitMedianMinutes: 35 }, BIG);
    expect(wait).toEqual({ minutes: 35, source: 'reported' });
  });

  it('falls back to the mandal’s own bounds when nobody has timed it', () => {
    const wait = queueTimeFor({ status: 'long', waitMedianMinutes: null }, BIG);
    expect(wait?.source).toBe('modelled');
    expect(wait?.minutes).toBeGreaterThan(0);
  });

  /**
   * The point of doing this per mandal. Heavy at Dagdusheth and heavy at a
   * lane mandal are both heavy and are not the same wait, and a single
   * number for "heavy" would have said they were.
   */
  it('gives a big mandal a longer queue than a small one at the same level', () => {
    for (const level of ['short', 'moving', 'long'] as const) {
      const big = queueTimeFor({ status: level, waitMedianMinutes: null }, BIG)!;
      const small = queueTimeFor({ status: level, waitMedianMinutes: null }, SMALL)!;
      expect(big.minutes, `${level}`).toBeGreaterThan(small.minutes);
    }
  });

  it('gets longer as the queue gets busier, for the same mandal', () => {
    const short = waitForLevel(BIG, 'short')!.minutes;
    const moving = waitForLevel(BIG, 'moving')!.minutes;
    const long = waitForLevel(BIG, 'long')!.minutes;
    expect(short).toBeLessThan(moving);
    expect(moving).toBeLessThan(long);
  });

  it('says nothing rather than guessing when there is no level', () => {
    expect(queueTimeFor({ status: null, waitMedianMinutes: 20 }, BIG)).toBeNull();
    expect(queueTimeFor(null, BIG)).toBeNull();
  });

  it('says nothing when the mandal has no darshan time to reason from', () => {
    expect(queueTimeFor({ status: 'long', waitMedianMinutes: null }, null)).toBeNull();
  });
});
