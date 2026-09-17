import { describe, it, expect } from 'vitest';
import { queueTimeFor } from '@/features/crowd/crowd-display';
import type { PriorInput } from '@/services/crowd/crowd-prior';

const DAGDUSHETH: PriorInput = {
  darshanMinutes: 45, peakDarshanMinutes: 150, prominence: 1000,
};

/**
 * An override can now assert the minutes, not only the colour.
 *
 * Before this, somebody standing at Dagdusheth watching a forty-minute
 * queue could set "heavy" and the app printed 150 minutes at the visitor,
 * because waitForLevel reads the mandal's curated peak. The colour was
 * right and the number — the one people plan an evening around — was not.
 */
describe('an override carries its own wait', () => {
  it('shows the asserted minutes rather than the mandal peak', () => {
    const got = queueTimeFor(
      { status: 'long', waitMedianMinutes: 40, observedWaitMinutes: null, source: 'override' },
      DAGDUSHETH
    );
    expect(got).toEqual({ minutes: 40, source: 'override' });
  });

  /**
   * The wording is the point. "The middle of what people here have said
   * they waited" is false of a number one named person asserted, and this
   * app does not misattribute a reading.
   */
  it('is never described as a visitor report', () => {
    const override = queueTimeFor(
      { status: 'long', waitMedianMinutes: 40, observedWaitMinutes: null, source: 'override' },
      DAGDUSHETH
    );
    const reported = queueTimeFor(
      { status: 'long', waitMedianMinutes: 40, observedWaitMinutes: null, source: 'reported' },
      DAGDUSHETH
    );
    expect(override!.source).toBe('override');
    expect(reported!.source).toBe('reported');
    expect(override!.minutes).toBe(reported!.minutes);
  });

  /**
   * Null is "assert the colour and nothing more", which is what every
   * override could say before this existed. It must not read as zero.
   */
  it('falls back to the model when no minutes were asserted', () => {
    const got = queueTimeFor(
      { status: 'long', waitMedianMinutes: null, observedWaitMinutes: null, source: 'override' },
      DAGDUSHETH
    );
    expect(got!.source).toBe('modelled');
    expect(got!.minutes).toBe(150);
  });

  it('still works with no prior at all', () => {
    const got = queueTimeFor(
      { status: 'moving', waitMedianMinutes: 25, observedWaitMinutes: null, source: 'override' },
      null
    );
    expect(got).toEqual({ minutes: 25, source: 'override' });
  });

  /** An asserted wait outranks the passive devices, as a person should. */
  it('outranks the observed floor', () => {
    const got = queueTimeFor(
      { status: 'long', waitMedianMinutes: 40, observedWaitMinutes: 95, source: 'override' },
      DAGDUSHETH
    );
    expect(got).toEqual({ minutes: 40, source: 'override' });
  });
});
