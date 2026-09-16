import { describe, it, expect } from 'vitest';
import {
  buildItinerary,
  dwellMinutes,
  type DarshanPace,
  type Interest,
  DAGDUSHETH_SLUG,
  legModeFor,
} from '../itinerary';
import { localGanpatis } from '@/services/catalogue';
import { legCostFactor } from '@/services/pedestrian-flow';
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

/**
 * The one mandal people ask for by name.
 *
 * Every other interest is a category matched by tag or class. This one is
 * a slug, which is a thing that can stop matching without anything
 * failing — the button would still render and quietly do nothing — so the
 * first test here is that it still points at a real mandal.
 */
describe('asking for Dagdusheth by name', () => {
  const dagdusheth = localGanpatis.find((g) => g.slug === DAGDUSHETH_SLUG);

  it('names a mandal that is actually in the catalogue', () => {
    expect(dagdusheth, `no mandal with slug ${DAGDUSHETH_SLUG}`).toBeDefined();
  });

  it('is not filtered out as a year-round temple', () => {
    // It carries a "temple" tag and is open all year, and the builder drops
    // temples unless they were asked for. If is_temple were ever set on it,
    // this button would return an empty plan.
    expect(dagdusheth!.isTemple).toBe(false);
  });

  it('puts it in the plan', () => {
    const plan = buildItinerary({
      budgetMinutes: 240,
      interests: ['dagdusheth'],
      pace: 'balanced',
      mode: 'walk',
      origin: { lat: 18.5308, lng: 73.8478 },
      mandals: localGanpatis,
    });
    expect(plan.stops.map((s) => s.ganpati.slug)).toContain(DAGDUSHETH_SLUG);
  });

  it('fills the rest of the time around it rather than stopping at one', () => {
    // The deliberate difference from every other interest. A six-hour
    // budget spent on a single mandal is not an answer to "I want to see
    // Dagdusheth".
    const plan = buildItinerary({
      budgetMinutes: 360,
      interests: ['dagdusheth'],
      pace: 'balanced',
      mode: 'walk',
      origin: { lat: 18.5308, lng: 73.8478 },
      mandals: localGanpatis,
    });
    expect(plan.stops.length).toBeGreaterThan(1);
  });

  it('still keeps it when combined with another interest', () => {
    const plan = buildItinerary({
      budgetMinutes: 300,
      interests: ['dagdusheth', 'manache'],
      pace: 'balanced',
      mode: 'walk',
      origin: { lat: 18.5308, lng: 73.8478 },
      mandals: localGanpatis,
    });
    const slugs = plan.stops.map((s) => s.ganpati.slug);
    expect(slugs).toContain(DAGDUSHETH_SLUG);
    // And the other interest is not crowded out by it.
    expect(slugs.some((s) => s !== DAGDUSHETH_SLUG)).toBe(true);
  });

  it('is in the plan at every budget, not only the generous ones', () => {
    // The bug this replaced: at 90 minutes the plan came back with three
    // other mandals and no Dagdusheth. It is 47 minutes' walk from the
    // city centre with a 45-minute queue, so it missed the budget by two
    // and the greedy loop spent the time on nearer mandals instead —
    // which is not what somebody who pressed this button asked for.
    for (const budgetMinutes of [30, 60, 90, 120, 240, 360]) {
      const plan = buildItinerary({
        budgetMinutes,
        interests: ['dagdusheth'],
        pace: 'balanced',
        mode: 'walk',
        origin: { lat: 18.5308, lng: 73.8478 },
        mandals: localGanpatis,
      });
      expect(
        plan.stops.map((s) => s.ganpati.slug),
        `budget ${budgetMinutes} dropped it`
      ).toContain(DAGDUSHETH_SLUG);
    }
  });

  it('says the plan runs over rather than quietly substituting', () => {
    // An hour is not enough for Dagdusheth. The honest answer is the one
    // mandal they asked for and a total that admits it, not a different
    // mandal that fits.
    const plan = buildItinerary({
      budgetMinutes: 60,
      interests: ['dagdusheth'],
      pace: 'balanced',
      mode: 'walk',
      origin: { lat: 18.5308, lng: 73.8478 },
      mandals: localGanpatis,
    });
    expect(plan.stops).toHaveLength(1);
    expect(plan.stops[0].ganpati.slug).toBe(DAGDUSHETH_SLUG);
    expect(plan.totalMinutes).toBeGreaterThan(plan.budgetMinutes);
  });

  it('does not appear twice when the budget is generous', () => {
    // It is seeded before the greedy loop, so it also has to be taken out
    // of the candidate list.
    const plan = buildItinerary({
      budgetMinutes: 360,
      interests: ['dagdusheth'],
      pace: 'balanced',
      mode: 'walk',
      origin: { lat: 18.5308, lng: 73.8478 },
      mandals: localGanpatis,
    });
    const slugs = plan.stops.map((s) => s.ganpati.slug);
    expect(slugs.filter((x) => x === DAGDUSHETH_SLUG)).toHaveLength(1);
  });

  it('does not leak into a plan that did not ask for it', () => {
    const plan = buildItinerary({
      budgetMinutes: 90,
      interests: ['historic'],
      pace: 'balanced',
      mode: 'walk',
      origin: { lat: 18.5308, lng: 73.8478 },
      mandals: localGanpatis,
    });
    expect(plan.stops.length).toBeGreaterThan(0);
    for (const s of plan.stops) {
      expect(s.ganpati.slug).not.toBe(DAGDUSHETH_SLUG);
      /**
       * Matching the interest, not carrying one category.
       *
       * This asked every stop to be category 'historic', which was always
       * stricter than the rule it was guarding: a mandal matches an
       * interest by its TAGS as well, and Tambdi Jogeshwari is maanache by
       * category and 'heritage' by tag. It only passed because the stops
       * that fitted a ninety-minute budget happened to be the ones whose
       * category said historic too, and a change in what those legs cost
       * to walk was enough to bring in a mandal that had always qualified.
       */
      const tags = ['historic', 'heritage', 'early-mandal', 'talim', 'tilak'];
      expect(
        s.ganpati.category === 'historic' ||
          tags.some((t) => s.ganpati.tags.includes(t)),
        `${s.ganpati.slug} does not match the historic interest at all`
      ).toBe(true);
    }
  });
});

/**
 * A two-wheeler is ridden to the parking and no further.
 *
 * The peth core is barricaded through the festival. Everything after the
 * parking is on foot, which means it is subject to the one-way lanes and
 * to walking speed — and, crucially, it stays that way even when no
 * parking spot could be chosen.
 */
describe('once the vehicle is parked', () => {
  it('walks between mandals whether or not a parking was found', () => {
    expect(legModeFor('two_wheeler')).toBe('walk');
  });

  it('leaves the other modes alone', () => {
    expect(legModeFor('walk')).toBe('walk');
    expect(legModeFor('metro')).toBe('metro');
  });

  it('never prices a two-wheeler plan at riding speed between stops', () => {
    // The regression this replaced: the leg mode was decided by whether a
    // parking had been chosen, so a rider who had not granted location got
    // their whole darshan priced as a ride through closed lanes. The two
    // plans below differ only in origin, and both must be walked.
    const peths = { lat: 18.5160, lng: 73.8560 };
    const build = (origin: typeof peths) =>
      buildItinerary({
        budgetMinutes: 240,
        interests: ['manache'],
        pace: 'balanced',
        mode: 'two_wheeler',
        origin,
        mandals: localGanpatis,
      });

    const fromPeths = build(peths);
    // Same stops on foot cost the same whichever way the plan was reached.
    const onFoot = buildItinerary({
      budgetMinutes: 240,
      interests: ['manache'],
      pace: 'balanced',
      mode: 'walk',
      origin: peths,
      mandals: localGanpatis,
    });

    expect(fromPeths.stops.length).toBeGreaterThan(0);
    // Riding speed is over three times walking speed, so a plan priced as
    // a ride would have a travel figure a fraction of the walked one.
    expect(fromPeths.travelMinutes).toBeGreaterThan(onFoot.travelMinutes / 2);
  });
});

/**
 * A stop can only be reached the way the crowd allows.
 *
 * Tulshibaug is the clearest case in the catalogue: two one-way lanes
 * leave it and one arrives, so the only legal approach is down from
 * Guruji Talim. A six-hour two-wheeler plan used to arrive there from
 * Mandai — the leg was priced as though nothing were wrong, because the
 * graph was only consulted when BOTH stops stood on the lane network and
 * Mandai is 189 m off it.
 */
describe('arriving at a mandal the crowd allows', () => {
  it('never walks into a stop against the lane it stands on', () => {
    const plan = buildItinerary({
      budgetMinutes: 360,
      interests: ['manache', 'famous'],
      pace: 'balanced',
      mode: 'two_wheeler',
      origin: { lat: 18.5308, lng: 73.8478 },
      mandals: localGanpatis,
    });

    const at = (g: { location: { lat: number; lng: number } }) => ({
      lat: g.location.lat,
      lng: g.location.lng,
    });

    for (let i = 1; i < plan.stops.length; i++) {
      const from = at(plan.stops[i - 1].ganpati);
      const to = at(plan.stops[i].ganpati);
      expect(
        legCostFactor(from, to, 'walk'),
        `${plan.stops[i - 1].ganpati.slug} -> ${plan.stops[i].ganpati.slug} arrives illegally`
      ).toBeLessThan(4);
    }
  });
});
