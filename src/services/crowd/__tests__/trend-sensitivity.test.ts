import { describe, it, expect } from 'vitest';
import { trendFrom } from '@/services/crowd/crowd-aggregation';
import type { CrowdLevel } from '@/types/crowd';

/** prior reports land at 40 min, recent ones at 5 min. */
const build = (prior: CrowdLevel[], recent: CrowdLevel[]) => [
  ...prior.map((status) => ({ status, ageMinutes: 40 })),
  ...recent.map((status) => ({ status, ageMinutes: 5 })),
];

/**
 * Why this is a mean where everything else in the file is a median.
 *
 * Severity is an ordinal 0/1/2 over a handful of reports, and a median of
 * three ordinals barely moves. It was briefly a median — to stop one loud
 * report tipping the verdict — and that suppressed the outlier and three
 * genuine shifts with it. The outlier is filtered by TREND_EPSILON
 * instead, which can tell the two apart where the statistic cannot.
 */
describe('trend sees real movement and ignores one loud report', () => {
  it('calls a genuine worsening', () => {
    expect(trendFrom(build(['short', 'moving', 'moving'], ['moving', 'moving', 'long'])))
      .toBe('worsening');
  });

  it('calls a genuine easing', () => {
    expect(trendFrom(build(['moving', 'long', 'long'], ['short', 'moving', 'moving'])))
      .toBe('improving');
  });

  /** delta 0.33 — under the 0.5 threshold, so it stays quiet. */
  it('ignores a single outlier among steady reports', () => {
    expect(trendFrom(build(['moving', 'moving', 'moving'], ['moving', 'moving', 'long'])))
      .toBe('stable');
  });

  it('sees a shift spread across five reports', () => {
    expect(trendFrom(build(
      ['short', 'short', 'moving', 'moving', 'moving'],
      ['moving', 'moving', 'moving', 'long', 'long']
    ))).toBe('worsening');
  });

  it('says nothing without enough on both sides', () => {
    expect(trendFrom(build(['short'], ['long']))).toBe('unknown');
    expect(trendFrom(build([], ['long', 'long']))).toBe('unknown');
  });

  it('is stable when nothing changed', () => {
    expect(trendFrom(build(['moving', 'moving'], ['moving', 'moving']))).toBe('stable');
  });
});
