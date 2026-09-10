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

describe('temples are not pandals', () => {
  const TEMPLES = localGanpatis.filter((g) => g.isTemple);
  const templeSlugs = new Set(TEMPLES.map((g) => g.slug));
  const slugsOf = (interests: Interest[], budgetMinutes = 360) =>
    buildItinerary({ ...base, budgetMinutes, interests }).stops.map((s) => s.ganpati.slug);

  it('has temples in the catalogue to exclude', () => {
    // Without this the rest of the block passes vacuously.
    expect(TEMPLES.map((g) => g.slug).sort()).toEqual([
      'sarasbaug-ganpati',
      'shri-morya-gosavi',
      'trishund-ganpati-mandir',
    ]);
  });

  it.each<Interest[]>([
    ['famous'],
    ['historic'],
    ['dekhava'],
    ['manache'],
    ['surprise'],
    ['famous', 'historic', 'dekhava'],
  ])('keeps temples out of a %s route', (...interests) => {
    // Sarasbaug is category 'famous' and Trishund is 'historic', so both
    // scored well on a pandal crawl and were being folded into it. The
    // visitor asked for mandaps, lights and the ten-day queue; a year-round
    // temple is a different outing that happens to have a Ganpati in it.
    const chosen = slugsOf(interests.flat());
    const temples = chosen.filter((s) => templeSlugs.has(s));
    expect(temples, `temples leaked into [${interests.flat().join(', ')}]`).toEqual([]);
  });

  it('includes them when the visitor asks for calm temples', () => {
    const chosen = slugsOf(['temple']);
    expect(chosen.some((s) => templeSlugs.has(s))).toBe(true);
  });

  it('still allows temples alongside other interests once temples are asked for', () => {
    // The gate is "did they ask", not "did they ask for ONLY this".
    const chosen = slugsOf(['famous', 'temple']);
    expect(chosen.some((s) => templeSlugs.has(s))).toBe(true);
  });

  it('leaves mandals that merely have a permanent temple alone', () => {
    // The trap this rule has to avoid. Dagdusheth and Kasba Ganpati both
    // carry the 'temple' tag and both have real year-round temples, but
    // during Ganeshotsav the pandal is the thing people queue for — and
    // Kasba is the first of the Manache Paach. Deriving isTemple from the
    // tag would have dropped both from every pandal route.
    for (const slug of ['dagdusheth-halwai-ganpati', 'kasba-ganpati']) {
      const g = localGanpatis.find((m) => m.slug === slug);
      expect(g, `${slug} missing from the catalogue`).toBeDefined();
      expect(g!.isTemple, `${slug} must not be a temple`).toBe(false);
    }
    expect(slugsOf(['manache'])).toContain('kasba-ganpati');
  });
});
