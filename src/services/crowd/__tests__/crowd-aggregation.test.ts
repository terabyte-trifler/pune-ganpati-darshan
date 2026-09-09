import { describe, it, expect } from 'vitest';
import {
  ACTIVE_WINDOW_MINUTES,
  FRESHNESS_HALF_LIFE_MINUTES,
  aggregateMandal,
  aggregateSnapshot,
  confidenceFrom,
  freshnessWeight,
  labelFor,
  trendFrom,
} from '../crowd-aggregation';
import type { CrowdLevel, CrowdReportInput } from '@/types/crowd';

/**
 * The aggregation is the one part of this feature that can be wrong
 * without anything failing. A broken cooldown throws; a broken weighting
 * just misinforms people quietly, which is worse. These tests pin the
 * behaviour the product promises rather than the implementation.
 */

const NOW = Date.parse('2026-09-09T20:00:00.000Z');

/** A report `ageMinutes` old. */
function report(status: CrowdLevel, ageMinutes: number): CrowdReportInput {
  return {
    mandalId: 'm1',
    status,
    createdAt: new Date(NOW - ageMinutes * 60_000).toISOString(),
    atMandal: true,
  };
}

describe('freshnessWeight', () => {
  it('is 1 for a brand new report and halves each half-life', () => {
    expect(freshnessWeight(0)).toBe(1);
    expect(freshnessWeight(FRESHNESS_HALF_LIFE_MINUTES)).toBeCloseTo(0.5, 10);
    expect(freshnessWeight(FRESHNESS_HALF_LIFE_MINUTES * 2)).toBeCloseTo(0.25, 10);
  });

  it('decays continuously, with no cliff that could flip a status on a clock tick', () => {
    // The step-bucket alternative jumps 1.0 -> 0.8 at exactly 15 minutes.
    const before = freshnessWeight(14.99);
    const after = freshnessWeight(15.01);
    expect(before - after).toBeLessThan(0.001);
  });

  it('is strictly decreasing across the active window', () => {
    for (let age = 0; age < ACTIVE_WINDOW_MINUTES; age += 5) {
      expect(freshnessWeight(age)).toBeGreaterThan(freshnessWeight(age + 5));
    }
  });

  it('is zero past the active window, so expiry needs no cron job', () => {
    expect(freshnessWeight(ACTIVE_WINDOW_MINUTES + 0.01)).toBe(0);
    expect(freshnessWeight(1_000)).toBe(0);
  });

  it('treats a future timestamp as brand new rather than trusting clock skew', () => {
    expect(freshnessWeight(-5)).toBe(1);
  });
});

describe('aggregateMandal — the unknown state', () => {
  it('reports no status at all when nothing is active, never "short"', () => {
    const result = aggregateMandal('m1', [], NOW);
    expect(result.status).toBeNull();
    expect(result.reportCount).toBe(0);
    expect(result.lastUpdated).toBeNull();
    expect(result.trend).toBe('unknown');
    expect(result.label).toMatch(/no recent reports/i);
  });

  it('ignores reports that have aged out of the 90-minute window', () => {
    const result = aggregateMandal(
      'm1',
      [report('long', 91), report('long', 120), report('long', 500)],
      NOW
    );
    expect(result.status).toBeNull();
    expect(result.reportCount).toBe(0);
  });

  it('counts only the reports still inside the window', () => {
    const result = aggregateMandal(
      'm1',
      [report('long', 10), report('long', 89), report('long', 91)],
      NOW
    );
    expect(result.reportCount).toBe(2);
  });
});

describe('aggregateMandal — consensus', () => {
  it('takes the highest weighted score', () => {
    const result = aggregateMandal(
      'm1',
      [report('short', 5), report('moving', 5), report('moving', 6)],
      NOW
    );
    expect(result.status).toBe('moving');
  });

  it('does not let a stale majority outvote a fresh minority', () => {
    // Five reports at 85 minutes weigh 5 * 2^(-85/30) = ~0.70 in total.
    // Two fresh ones weigh ~2.0. Recency has to win, or the display lags
    // reality by an hour and a half.
    const stale = Array.from({ length: 5 }, () => report('long', 85));
    const fresh = [report('short', 1), report('short', 2)];
    const result = aggregateMandal('m1', [...stale, ...fresh], NOW);
    expect(result.status).toBe('short');
  });

  it('still lets a large older majority beat a single fresh outlier', () => {
    // The inverse guard: recency must not mean one person overrides ten.
    const many = Array.from({ length: 10 }, (_, i) => report('long', 20 + i));
    const one = [report('short', 0)];
    const result = aggregateMandal('m1', [...many, ...one], NOW);
    expect(result.status).toBe('long');
  });

  it('breaks an exact tie toward the more recent report, not the worse one', () => {
    // Biasing ties to "long" would systematically overstate crowds.
    const result = aggregateMandal('m1', [report('long', 30), report('short', 10)], NOW);
    expect(result.status).toBe('short');
  });

  it('uses the newest active report as lastUpdated', () => {
    const result = aggregateMandal(
      'm1',
      [report('long', 40), report('short', 3), report('moving', 70)],
      NOW
    );
    expect(result.lastUpdated).toBe(new Date(NOW - 3 * 60_000).toISOString());
  });
});

describe('confidence', () => {
  it('calls a single report low, however fresh', () => {
    const result = aggregateMandal('m1', [report('long', 0)], NOW);
    expect(result.confidence).toBe('low');
  });

  it('calls a handful of mixed recent reports medium', () => {
    const result = aggregateMandal(
      'm1',
      [
        report('long', 2), report('long', 4), report('long', 6),
        report('moving', 3), report('short', 5),
      ],
      NOW
    );
    expect(result.confidence).toBe('medium');
  });

  it('calls many fresh agreeing reports high', () => {
    const reports = Array.from({ length: 30 }, (_, i) => report('long', i % 12));
    const result = aggregateMandal('m1', reports, NOW);
    expect(result.confidence).toBe('high');
  });

  it('refuses high confidence when plenty of reports disagree', () => {
    const reports = [
      ...Array.from({ length: 10 }, () => report('short', 5)),
      ...Array.from({ length: 10 }, () => report('long', 5)),
    ];
    const result = aggregateMandal('m1', reports, NOW);
    expect(result.confidence).not.toBe('high');
  });

  it('refuses high confidence when strong agreement is all stale', () => {
    const reports = Array.from({ length: 30 }, () => report('long', 88));
    const result = aggregateMandal('m1', reports, NOW);
    expect(result.confidence).not.toBe('high');
  });

  it('is a pure function of mass and agreement', () => {
    expect(confidenceFrom(1, 1)).toBe('low');
    expect(confidenceFrom(10, 0.4)).toBe('low');
    expect(confidenceFrom(4, 0.6)).toBe('medium');
    expect(confidenceFrom(6, 0.7)).toBe('high');
  });
});

describe('trend', () => {
  const aged = (status: CrowdLevel, ageMinutes: number) => ({ status, ageMinutes });

  it('is unknown without enough data in both windows', () => {
    expect(trendFrom([aged('long', 5)])).toBe('unknown');
    expect(trendFrom([aged('long', 5), aged('long', 6)])).toBe('unknown');
  });

  it('reports worsening when recent conditions are heavier than before', () => {
    expect(
      trendFrom([
        aged('long', 5), aged('long', 10),
        aged('moving', 30), aged('moving', 45),
      ])
    ).toBe('worsening');
  });

  it('reports improving when recent conditions are lighter than before', () => {
    expect(
      trendFrom([
        aged('moving', 5), aged('moving', 10),
        aged('long', 30), aged('long', 45),
      ])
    ).toBe('improving');
  });

  it('reports stable when nothing has really changed', () => {
    expect(
      trendFrom([
        aged('moving', 5), aged('moving', 10),
        aged('moving', 30), aged('moving', 45),
      ])
    ).toBe('stable');
  });

  it('ignores reports older than the comparison window', () => {
    expect(
      trendFrom([
        aged('long', 5), aged('long', 10),
        aged('short', 70), aged('short', 85),
      ])
    ).toBe('unknown');
  });
});

describe('labels', () => {
  it('never states a queue time as fact', () => {
    for (const level of ['short', 'moving', 'long', null] as const) {
      const { label, detail } = labelFor(level);
      // Any duration must be attributed to reports, not asserted.
      if (/\d+\s*\+?\s*min/i.test(label + detail)) {
        expect(detail.toLowerCase()).toMatch(/report/);
      }
    }
  });

  it('describes the empty state as missing reports rather than a short queue', () => {
    expect(labelFor(null).label.toLowerCase()).not.toContain('short');
  });
});

describe('aggregateSnapshot', () => {
  it('returns an entry for every requested mandal, including silent ones', () => {
    const statuses = aggregateSnapshot(
      ['a', 'b', 'c'],
      [{ mandalId: 'a', status: 'long', createdAt: new Date(NOW).toISOString(), atMandal: true }],
      NOW
    );
    expect(statuses.map((s) => s.mandalId)).toEqual(['a', 'b', 'c']);
    expect(statuses[1].status).toBeNull();
    expect(statuses[2].reportCount).toBe(0);
  });

  it('keeps each mandal independent', () => {
    const statuses = aggregateSnapshot(
      ['a', 'b'],
      [
        { mandalId: 'a', status: 'long', createdAt: new Date(NOW).toISOString(), atMandal: true },
        { mandalId: 'b', status: 'short', createdAt: new Date(NOW).toISOString(), atMandal: true },
      ],
      NOW
    );
    expect(statuses[0].status).toBe('long');
    expect(statuses[1].status).toBe('short');
  });

  it('ignores reports for mandals that were not asked for', () => {
    const statuses = aggregateSnapshot(
      ['a'],
      [{ mandalId: 'zzz', status: 'long', createdAt: new Date(NOW).toISOString(), atMandal: true }],
      NOW
    );
    expect(statuses).toHaveLength(1);
    expect(statuses[0].status).toBeNull();
  });
});

describe('proximity weighting', () => {
  /** A report `ageMinutes` old, with explicit provenance. */
  const at = (
    status: CrowdLevel,
    atMandal: boolean,
    ageMinutes = 1
  ): CrowdReportInput => ({
    mandalId: 'm1',
    status,
    createdAt: new Date(NOW - ageMinutes * 60_000).toISOString(),
    atMandal,
  });

  it('lets people at the mandal outvote a larger group who are not', () => {
    // Two at the gate against three who are not, all equally fresh, so
    // only provenance separates them: 2 x 1.0 beats 3 x 0.5.
    const result = aggregateMandal('m1', [
      at('long', true),
      at('long', true),
      at('short', false),
      at('short', false),
      at('short', false),
    ], NOW);

    expect(result.status).toBe('long');
  });

  it('still lets a clear off-site majority win', () => {
    // Half weight is not no weight. People who walked past are worth
    // hearing, and one on-site report must not veto them.
    const result = aggregateMandal('m1', [
      at('long', true),
      at('short', false),
      at('short', false),
      at('short', false),
    ], NOW);

    expect(result.status).toBe('short');
  });

  it('does not let proximity override staleness', () => {
    // An 80-minute-old on-site report against a fresh off-site one.
    // Freshness and proximity multiply; neither may dominate the other.
    const result = aggregateMandal('m1', [
      at('long', true, 80),
      at('short', false, 1),
    ], NOW);

    expect(result.status).toBe('short');
  });

  it('treats a missing position as off-site rather than blocking the report', () => {
    // A device that cannot get a fix still gets a voice, at half weight.
    const result = aggregateMandal('m1', [at('moving', false)], NOW);

    expect(result.status).toBe('moving');
    expect(result.reportCount).toBe(1);
  });
});
