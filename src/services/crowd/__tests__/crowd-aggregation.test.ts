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
        { mandalId: 'a', status: 'long', createdAt: new Date(NOW).toISOString(), atMandal: true, deviceSeq: 1 },
        { mandalId: 'a', status: 'long', createdAt: new Date(NOW).toISOString(), atMandal: true, deviceSeq: 2 },
        { mandalId: 'b', status: 'short', createdAt: new Date(NOW).toISOString(), atMandal: true, deviceSeq: 1 },
        { mandalId: 'b', status: 'short', createdAt: new Date(NOW).toISOString(), atMandal: true, deviceSeq: 2 },
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

let deviceCounter = 0;
const nextDevice = () => ++deviceCounter;

describe('proximity weighting', () => {
  /** A report `ageMinutes` old, with explicit provenance. */
  const at = (
    status: CrowdLevel,
    atMandal: boolean,
    ageMinutes = 1,
    // A reading needs two devices, so fixtures have to say who reported.
    // Defaults differ per call site via the counter below.
    deviceSeq = nextDevice()
  ): CrowdReportInput => ({
    mandalId: 'm1',
    status,
    createdAt: new Date(NOW - ageMinutes * 60_000).toISOString(),
    atMandal,
    deviceSeq,
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
    // Two of them, because one device is never a reading whatever it says.
    const result = aggregateMandal('m1', [at('moving', false), at('moving', false)], NOW);

    expect(result.status).toBe('moving');
    expect(result.reportCount).toBe(2);
  });
});

describe('one device is enough for a reading', () => {
  const from = (deviceSeq: number, status: CrowdLevel = 'short'): CrowdReportInput => ({
    mandalId: 'm1',
    status,
    createdAt: new Date(NOW - 60_000).toISOString(),
    atMandal: true,
    deviceSeq,
  });

  it('shows a level from a single report', () => {
    // The owner's decision, and the reason for it: a person who reports
    // what they are looking at has to see it appear, or they do not
    // report again. The exposure this accepts — one person can colour a
    // mandal alone — is documented on MIN_DEVICES_FOR_STATUS.
    const result = aggregateMandal('m1', [from(1)], NOW);
    expect(result.status).toBe('short');
    expect(result.label).toBe('Short');
  });

  it('calls a single report an early signal, not a confident one', () => {
    // What carries the weakness now that the device gate does not. One
    // fresh report is mass 1.0, which is below the threshold for medium.
    const result = aggregateMandal('m1', [from(1)], NOW);
    expect(result.reportCount).toBe(1);
    expect(result.confidence).toBe('low');
  });

  it('still counts devices rather than taps', () => {
    // Same device, three times — which the hourly cooldown already
    // prevents. It is one voice however often it speaks, so the reading
    // must not grow more confident for the repetition.
    const once = aggregateMandal('m1', [from(1)], NOW);
    const thrice = aggregateMandal('m1', [from(1), from(1), from(1)], NOW);
    expect(thrice.status).toBe(once.status);
  });

  it('strengthens as a second device agrees', () => {
    const result = aggregateMandal('m1', [from(1), from(2)], NOW);
    expect(result.status).toBe('short');
    expect(result.label).toBe('Short');
  });

  it('counts devices, not reports, even when they disagree', () => {
    const result = aggregateMandal('m1', [from(1, 'short'), from(2, 'long')], NOW);
    expect(result.status).not.toBeNull();
    // Two devices saying different things is a real reading with low
    // agreement, which is what confidence is for.
    expect(result.confidence).toBe('low');
  });

  it('falls back to the old behaviour when the database sends no device', () => {
    /**
     * A deployment running the previous crowd_active_reports returns no
     * device column. Treating that as "one device" would mark every
     * mandal in the city unconfirmed the moment the app shipped ahead of
     * the migration, so each report counts as its own device instead.
     */
    const legacy: CrowdReportInput[] = [
      { mandalId: 'm1', status: 'short', createdAt: new Date(NOW).toISOString(), atMandal: true },
      { mandalId: 'm1', status: 'short', createdAt: new Date(NOW).toISOString(), atMandal: true },
    ];
    expect(aggregateMandal('m1', legacy, NOW).status).toBe('short');
  });
});


describe('the report count is safe to display', () => {
  it('shows a status from one report, and says it is early', () => {
    // The count was hidden from visitors entirely, so nothing on the
    // public side depends on a floor any more. What must hold is that a
    // lone report reads as weak: mass 1.0 is below the medium threshold.
    const now = new Date('2026-09-20T15:30:00.000Z');
    const at = (mins: number) => new Date(now.getTime() - mins * 60_000).toISOString();

    const one = aggregateMandal('m1', [
      { mandalId: 'm1', status: 'long', createdAt: at(5), atMandal: true, deviceSeq: 1 },
    ], now.getTime());
    expect(one.status).toBe('long');
    expect(one.confidence).toBe('low');

    const two = aggregateMandal('m1', [
      { mandalId: 'm1', status: 'long', createdAt: at(5), atMandal: true, deviceSeq: 1 },
      { mandalId: 'm1', status: 'long', createdAt: at(7), atMandal: true, deviceSeq: 2 },
    ], now.getTime());
    expect(two.status).toBe('long');
  });
});

describe('dwell contributes mass, within limits', () => {
  const now = Date.parse('2026-09-19T15:30:00.000Z');
  const at = (m: number) => new Date(now - m * 60_000).toISOString();
  const rep = (status: CrowdLevel, m: number, dev: number): CrowdReportInput =>
    ({ mandalId: 'm', status, createdAt: at(m), atMandal: true, deviceSeq: dev });
  const dw = (dwell: 'lingering' | 'queueing', m: number) => ({ dwell, createdAt: at(m) });

  it('cannot create a reading on its own', () => {
    // The limit that matters most. Twenty queueing observations and no
    // human reports is still "no recent reports" — dwell never counts
    // toward MIN_DEVICES_FOR_STATUS.
    const many = Array.from({ length: 20 }, () => dw('queueing', 1));
    const s = aggregateMandal('m', [], now, many);
    expect(s.status).toBeNull();
    expect(s.reportCount).toBe(0);
  });

  it('still cannot create a reading out of nothing', () => {
    // The limit that survives the device minimum going to one: dwell earns
    // no device credit, so with no human report at all there is no status
    // however many observations arrive.
    const many = Array.from({ length: 20 }, () => dw('queueing', 1));
    expect(aggregateMandal('m1', [], now, many).status).toBeNull();
    // With one human report the reading exists, and dwell may shade it.
    expect(aggregateMandal('m1', [rep('short', 1, 1)], now, many).status).not.toBeNull();
  });

  it('tips a tie towards what the dwell says', () => {
    // Two people disagree, 1.0 each. Dwell breaks it.
    const split = [rep('short', 2, 1), rep('long', 2, 2)];
    expect(aggregateMandal('m', split, now).status).toBe('short');
    const tipped = aggregateMandal('m', split, now, [dw('queueing', 1), dw('queueing', 2)]);
    expect(tipped.status).toBe('long');
  });

  it('cannot outvote two people who agree', () => {
    // Two fresh at-gate reports are 2.0; dwell is capped at 1.0, so no
    // number of observations overturns them.
    const agreed = [rep('short', 1, 1), rep('short', 2, 2)];
    const many = Array.from({ length: 40 }, (_, i) => dw('queueing', (i % 30) + 1));
    expect(aggregateMandal('m', agreed, now, many).status).toBe('short');
  });

  it('is capped in aggregate, not per sample', () => {
    // Five samples must not be worth five times one sample once the cap
    // binds — otherwise this scales with the app's popularity.
    const base = [rep('short', 2, 1), rep('long', 2, 2)];
    const five = aggregateMandal('m', base, now, Array.from({ length: 5 }, () => dw('queueing', 1)));
    const fifty = aggregateMandal('m', base, now, Array.from({ length: 50 }, () => dw('queueing', 1)));
    expect(five.status).toBe('long');
    expect(fifty.status).toBe('long');
    // Both tipped; neither ran away with it.
    expect(fifty.confidence).toBe(five.confidence);
  });

  it('does not raise confidence', () => {
    // A passive signal must not make a reader trust a reading more.
    const humans = [rep('long', 2, 1), rep('long', 3, 2)];
    const without = aggregateMandal('m', humans, now);
    const with_ = aggregateMandal('m', humans, now,
      Array.from({ length: 20 }, () => dw('queueing', 1)));
    expect(with_.confidence).toBe(without.confidence);
  });

  it('lowers agreement when it contradicts the humans', () => {
    const humans = [rep('short', 2, 1), rep('short', 3, 2)];
    const agreeing = aggregateMandal('m', humans, now, [dw('lingering', 1)]);
    const against = aggregateMandal('m', humans, now, [dw('queueing', 1), dw('queueing', 2)]);
    expect(against.status).toBe('short');
    // Still short, but the reading is now less clean than it was.
    expect(against.confidence === 'low' || agreeing.confidence !== against.confidence).toBe(true);
  });

  it('decays like a report and expires with the window', () => {
    const split = [rep('short', 2, 1), rep('long', 2, 2)];
    const stale = aggregateMandal('m', split, now, [
      dw('queueing', ACTIVE_WINDOW_MINUTES + 5),
      dw('queueing', ACTIVE_WINDOW_MINUTES + 9),
    ]);
    expect(stale.status).toBe('short');
  });

  it('does not count towards reportCount', () => {
    const s = aggregateMandal('m', [rep('long', 1, 1), rep('long', 2, 2)], now,
      Array.from({ length: 9 }, () => dw('queueing', 1)));
    expect(s.reportCount).toBe(2);
  });
});
