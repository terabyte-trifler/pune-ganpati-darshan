import { describe, it, expect } from 'vitest';
import type { FestivalPhase } from '@/lib/festival';
import {
  crowdExpectation, hourFactor, phaseFactor, weekendBonus,
  waitBounds, levelForWait, istHourOf, istDayOfWeek,
  type PriorInput,
} from '@/services/crowd/crowd-prior';

/**
 * Lane B — the prior.
 *
 * The thing worth testing here is not that the arithmetic runs. It is
 * that the model cannot do the two things it must never do: claim to be a
 * report, and speak outside the festival. Everything else is calibration,
 * and calibration is a judgement that real reports will settle later.
 */

/** 21:00 IST on a given day = 15:30 UTC. */
const ist = (isoDate: string, hour: number, min = 0) =>
  new Date(Date.parse(`${isoDate}T00:00:00.000Z`) - 5.5 * 3600_000 + (hour * 60 + min) * 60_000);

const during = (day: number, totalDays = 12, isVisarjan = false): FestivalPhase =>
  ({ phase: 'during', day, totalDays, isVisarjan });

const DAGDUSHETH: PriorInput = { darshanMinutes: 45, peakDarshanMinutes: 150, prominence: 1000 };
const KASBA: PriorInput = { darshanMinutes: 20, peakDarshanMinutes: 40, prominence: 980 };
const UNKNOWN: PriorInput = { darshanMinutes: null, peakDarshanMinutes: null, prominence: 120 };

describe('IST conversion', () => {
  it('reads the hour in Pune, not UTC', () => {
    // 21:00 IST on 24 Sep 2026 is 15:30 UTC the same day.
    const at = ist('2026-09-24', 21);
    expect(at.toISOString()).toBe('2026-09-24T15:30:00.000Z');
    expect(istHourOf(at)).toBeCloseTo(21, 5);
  });

  it('keeps a visitor at 00:30 IST on the correct day', () => {
    // The bug this guards: 00:30 IST is 19:00 UTC the PREVIOUS day, so a
    // naive getUTCHours would read 19:00 and show the evening peak to
    // someone standing in a lane after midnight.
    const at = ist('2026-09-20', 0, 30);
    expect(istHourOf(at)).toBeCloseTo(0.5, 5);
    expect(istDayOfWeek(at)).toBe(0); // Sunday 20 Sep 2026
  });
});

describe('hour curve', () => {
  it('peaks in the evening and empties before dawn', () => {
    expect(hourFactor(21)).toBe(1);
    expect(hourFactor(3)).toBeLessThan(0.1);
    expect(hourFactor(21)).toBeGreaterThan(hourFactor(14));
    expect(hourFactor(14)).toBeGreaterThan(hourFactor(3));
  });

  it('interpolates rather than stepping', () => {
    // Why it matters: a stepped curve changes the displayed status the
    // moment a clock ticks past the hour, with no new information.
    const a = hourFactor(20);
    const b = hourFactor(21);
    const mid = hourFactor(20.5);
    expect(mid).toBeGreaterThan(a);
    expect(mid).toBeLessThan(b);
    expect(mid).toBeCloseTo((a + b) / 2, 6);
  });

  it('is continuous across midnight', () => {
    expect(hourFactor(23.99)).toBeCloseTo(hourFactor(-0.01), 1);
  });
});

describe('festival day shape', () => {
  it('treats day one as an evening, not a peak', () => {
    expect(phaseFactor(1, 12, false)).toBeLessThan(phaseFactor(11, 12, false));
  });

  it('climbs towards the end of the festival', () => {
    const days = [2, 4, 6, 8, 11].map((d) => phaseFactor(d, 12, false));
    for (let i = 1; i < days.length; i++) {
      expect(days[i]).toBeGreaterThan(days[i - 1]);
    }
  });

  it('does not make visarjan day the busiest evening', () => {
    // The morning is heavy and then the mandals leave. Modelling it as
    // the top of the ramp would be wrong for the half of the day someone
    // would actually be reading it.
    expect(phaseFactor(12, 12, true)).toBeLessThan(phaseFactor(11, 12, false));
  });

  it('adds the weekend rather than scaling by it', () => {
    // Multiplying sub-1 factors would make a busy Saturday read quieter
    // than a Tuesday, which is backwards.
    expect(weekendBonus(6)).toBeGreaterThan(0);
    expect(weekendBonus(0)).toBeGreaterThan(0);
    expect(weekendBonus(2)).toBe(0);
    const sat = phaseFactor(6, 12, false) + weekendBonus(6);
    const tue = phaseFactor(9, 12, false) + weekendBonus(2);
    expect(sat).toBeGreaterThan(phaseFactor(6, 12, false));
    expect(tue).toBe(phaseFactor(9, 12, false));
  });
});

describe('wait bounds', () => {
  it('uses curated figures when both are present', () => {
    expect(waitBounds(DAGDUSHETH)).toEqual({ peak: 150, normal: 45, basis: 'curated' });
  });

  it('marks an estimate as estimated, and keeps it conservative', () => {
    const b = waitBounds(UNKNOWN);
    expect(b.basis).toBe('estimated');
    expect(b.peak).toBe(12);
    // The load-bearing consequence: 12 minutes can never cross the 30
    // minute threshold, so an estimated mandal is never called heavy.
    expect(levelForWait(b.peak)).not.toBe('long');
  });
});

describe('the expectation', () => {
  it('says nothing outside the festival', () => {
    expect(crowdExpectation(DAGDUSHETH, { phase: 'after' }, ist('2026-11-01', 21))).toBeNull();
    expect(
      crowdExpectation(DAGDUSHETH, { phase: 'before', daysUntil: 3 }, ist('2026-09-11', 21))
    ).toBeNull();
  });

  it('declines to speak on visarjan afternoon', () => {
    // The idols are in the procession by then, so "the queue at this
    // mandap" may have no answer at all. We do not know each mandal's
    // departure time and will not guess one.
    const vis = during(12, 12, true);
    expect(crowdExpectation(DAGDUSHETH, vis, ist('2026-09-25', 9))).not.toBeNull();
    expect(crowdExpectation(DAGDUSHETH, vis, ist('2026-09-25', 13))).toBeNull();
    expect(crowdExpectation(DAGDUSHETH, vis, ist('2026-09-25', 21))).toBeNull();
    // And a normal day at 21:00 still speaks, so the gate is visarjan-only.
    expect(crowdExpectation(DAGDUSHETH, during(11), ist('2026-09-24', 21))).not.toBeNull();
  });

  it('never phrases itself as a report', () => {
    // The whole point of Lane B. If this wording ever drifts into
    // "devotees report", the two lanes have become indistinguishable to
    // a reader and the measured status is no longer trustworthy either.
    for (const m of [DAGDUSHETH, KASBA, UNKNOWN]) {
      for (const hour of [3, 10, 15, 21]) {
        const e = crowdExpectation(m, during(9), ist('2026-09-22', hour))!;
        expect(e.label.toLowerCase()).toContain('usually');
        expect(e.detail).toMatch(/not a report/i);
        expect(e.detail.toLowerCase()).not.toContain('devotees report');
      }
    }
  });

  it('never claims nobody has reported', () => {
    // An expectation also shows alongside a single unconfirmed report,
    // where "nobody has reported" is false. Whether anyone reported is
    // the panel's fact to state, from the aggregation's own wording.
    const e = crowdExpectation(DAGDUSHETH, during(9), ist('2026-09-22', 21))!;
    expect(e.detail.toLowerCase()).not.toContain('nobody');
    expect(e.detail).toMatch(/not a report/i);
  });

  it('calls the busiest hour of the busiest day heavy at Dagdusheth', () => {
    // Thu 24 Sep 2026, 21:00 — the night before Anant Chaturdashi.
    const e = crowdExpectation(DAGDUSHETH, during(11), ist('2026-09-24', 21))!;
    expect(e.level).toBe('long');
    expect(e.waitMinutes).toBeGreaterThan(120);
    expect(e.basis).toBe('curated');
  });

  it('does not call 3am heavy anywhere', () => {
    for (const m of [DAGDUSHETH, KASBA, UNKNOWN]) {
      const e = crowdExpectation(m, during(11), ist('2026-09-24', 3))!;
      expect(e.level).not.toBe('long');
    }
  });

  it('is monotonic in the evening build-up', () => {
    const waits = [16, 18, 19, 20, 21].map(
      (h) => crowdExpectation(KASBA, during(6), ist('2026-09-19', h))!.waitMinutes
    );
    for (let i = 1; i < waits.length; i++) {
      expect(waits[i]).toBeGreaterThanOrEqual(waits[i - 1]);
    }
  });

  it('never exceeds the mandal’s own curated peak', () => {
    // A prior that can predict a worse queue than the mandal has ever
    // been recorded as having is not a prior, it is an invention.
    let checked = 0;
    for (const day of [1, 5, 6, 11, 12]) {
      for (const h of [0, 6, 12, 18, 21, 23]) {
        // Visarjan afternoon returns null by design, and a silence cannot
        // exceed anything — skip it rather than weaken the assertion.
        const e = crowdExpectation(DAGDUSHETH, during(day, 12, day === 12), ist('2026-09-19', h));
        if (!e) continue;
        expect(e.waitMinutes).toBeLessThanOrEqual(150);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('exposes every intermediate value for inspection', () => {
    const e = crowdExpectation(DAGDUSHETH, during(11), ist('2026-09-24', 21))!;
    const w = e.workings;
    // The admin view renders these; a missing one is a blank row there.
    expect(w.istHour).toBeCloseTo(21, 5);
    expect(w.hourFactor).toBe(1);
    expect(w.peakMinutes).toBe(150);
    expect(w.normalMinutes).toBe(45);
    expect(w.dayFactor).toBeCloseTo(w.phaseFactor + w.weekendBonus, 6);
    expect(w.load).toBeCloseTo(w.hourFactor * w.dayFactor, 6);
  });
});

describe('the prior holds no weight in the measured lane', () => {
  it('is absent from crowd-aggregation entirely', async () => {
    // The guarantee, asserted rather than trusted: Lane A must not import
    // or reference the prior. If anyone ever wires it in to "help quiet
    // mandals get a colour", this fails and says why.
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('src/services/crowd/crowd-aggregation.ts', 'utf8')
    );
    expect(src).not.toContain('crowd-prior');
    expect(src).not.toContain('crowdExpectation');
    expect(src).not.toContain('CrowdExpectation');
  });

  it('is not part of the CrowdStatus contract', async () => {
    // It is never serialised through the crowd API either, so it cannot
    // reach a caller that might treat it as a reading.
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('src/types/crowd.ts', 'utf8')
    );
    expect(src).not.toContain('expect');
    expect(src).not.toContain('prior');
  });
});
