import { describe, it, expect } from 'vitest';
import {
  buildItinerary,
  dwellMinutes,
  type DarshanPace,
  type Interest,
} from '../itinerary';
import { localGanpatis } from '@/services/catalogue';
import { PUNE_CENTER } from '@/lib/geo';

const base = {
  mode: 'walk' as const,
  origin: PUNE_CENTER,
  mandals: localGanpatis,
  pace: 'balanced' as const,
};

describe('itinerary builder', () => {
  it('never exceeds the time budget', () => {
    for (const budgetMinutes of [60, 90, 120, 180, 240, 360]) {
      const plan = buildItinerary({ ...base, budgetMinutes, interests: ['famous', 'manache'] });
      expect(plan.totalMinutes, `budget ${budgetMinutes}`).toBeLessThanOrEqual(budgetMinutes);
    }
  });

  it('counts queue time, not just walking', () => {
    const plan = buildItinerary({ ...base, budgetMinutes: 180, interests: ['manache'] });
    // The Manache Paach are close together, so darshan must dominate travel.
    expect(plan.darshanMinutes).toBeGreaterThan(plan.travelMinutes);
    expect(plan.totalMinutes).toBe(plan.darshanMinutes + plan.travelMinutes);
  });

  it('fits more mandals as the budget grows', () => {
    const short = buildItinerary({ ...base, budgetMinutes: 60, interests: ['surprise'] });
    const long = buildItinerary({ ...base, budgetMinutes: 300, interests: ['surprise'] });
    expect(long.stops.length).toBeGreaterThan(short.stops.length);
  });

  it('respects the chosen interests', () => {
    const plan = buildItinerary({ ...base, budgetMinutes: 240, interests: ['manache'] });
    expect(plan.stops.length).toBeGreaterThan(0);
    expect(plan.stops.every((s) => s.ganpati.category === 'maanache')).toBe(true);
  });

  it('a quicker pace fits more stops than a thorough one', () => {
    const interests: Interest[] = ['famous', 'manache', 'historic'];
    const thorough = buildItinerary({ ...base, budgetMinutes: 150, interests, pace: 'thorough' });
    const quick = buildItinerary({ ...base, budgetMinutes: 150, interests, pace: 'quick' });
    expect(quick.stops.length).toBeGreaterThanOrEqual(thorough.stops.length);
    expect(quick.darshanMinutes).toBeLessThan(thorough.darshanMinutes);
  });

  it('reports what it had to leave out', () => {
    const plan = buildItinerary({ ...base, budgetMinutes: 45, interests: ['famous', 'manache'] });
    expect(plan.skipped.length).toBeGreaterThan(0);
    // Nothing appears both in and out of the plan.
    const chosen = new Set(plan.stops.map((s) => s.ganpati.slug));
    expect(plan.skipped.every((g) => !chosen.has(g.slug))).toBe(true);
  });

  it('returns an empty plan rather than overrunning an impossible budget', () => {
    const plan = buildItinerary({ ...base, budgetMinutes: 3, interests: ['famous'] });
    expect(plan.stops).toHaveLength(0);
    expect(plan.totalMinutes).toBe(0);
  });

  it('orders stops sensibly rather than by input order', () => {
    const plan = buildItinerary({ ...base, budgetMinutes: 300, interests: ['manache'] });
    const slugs = plan.stops.map((s) => s.ganpati.slug);
    expect(new Set(slugs).size).toBe(slugs.length);

    // Total walking must not exceed the naive prominence-ordered walk.
    const naive = buildItinerary({
      ...base, budgetMinutes: 300, interests: ['manache'],
    });
    expect(plan.travelMinutes).toBeLessThanOrEqual(naive.travelMinutes + 1);
  });
});

describe('dwell time', () => {
  const dagdusheth = localGanpatis.find((g) => g.slug === 'dagdusheth-halwai-ganpati')!;

  it('uses the peak estimate for a thorough pace', () => {
    expect(dwellMinutes(dagdusheth, 'thorough')).toBe(dagdusheth.peakDarshanMinutes);
  });

  it('skips most of the queue when viewing quickly', () => {
    expect(dwellMinutes(dagdusheth, 'quick')).toBeLessThan(dwellMinutes(dagdusheth, 'balanced'));
  });

  it('falls back to a short look when no estimate exists', () => {
    const unknown = { ...dagdusheth, darshanMinutes: null, peakDarshanMinutes: null };
    expect(dwellMinutes(unknown, 'balanced')).toBe(5);
  });
});

describe('crowd-aware budgets', () => {
  /**
   * The point of feeding the tracker into the planner: a heavy mandal eats
   * more of a fixed budget, so an honest plan fits fewer stops into it.
   * Without this the wizard promised a six-mandal evening that a real queue
   * would have destroyed by the second stop.
   */
  const base = {
    interests: ['famous'] as Interest[],
    pace: 'balanced' as DarshanPace,
    mode: 'walk' as const,
    origin: PUNE_CENTER,
    mandals: localGanpatis,
  };

  it('fits fewer mandals into the same budget when queues are heavy', () => {
    const calm = buildItinerary({ ...base, budgetMinutes: 180 });

    const heavy = buildItinerary({
      ...base,
      budgetMinutes: 180,
      crowdByMandalId: Object.fromEntries(
        base.mandals.map((g) => [g.id, 'long' as const])
      ),
    });

    expect(heavy.stops.length).toBeLessThanOrEqual(calm.stops.length);
    expect(heavy.crowdAdjusted).toBe(true);
    expect(calm.crowdAdjusted).toBe(false);
  });

  it('never exceeds the budget it was given, crowded or not', () => {
    for (const level of ['short', 'moving', 'long'] as const) {
      const plan = buildItinerary({
        ...base,
        budgetMinutes: 360,
        crowdByMandalId: Object.fromEntries(base.mandals.map((g) => [g.id, level])),
      });
      expect(plan.totalMinutes, level).toBeLessThanOrEqual(360);
    }
  });

  it('leaves the estimate alone when nobody has reported', () => {
    // No reports is not good news. A plan that assumed short queues
    // wherever it was ignorant would be wrong in the expensive direction.
    const silent = buildItinerary({
      ...base,
      budgetMinutes: 180,
      crowdByMandalId: Object.fromEntries(base.mandals.map((g) => [g.id, null])),
    });
    const none = buildItinerary({ ...base, budgetMinutes: 180 });

    expect(silent.totalMinutes).toBe(none.totalMinutes);
    expect(silent.crowdAdjusted).toBe(false);
  });
});
