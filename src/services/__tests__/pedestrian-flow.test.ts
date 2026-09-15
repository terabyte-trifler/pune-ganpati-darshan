import { describe, it, expect } from 'vitest';
import {
  legAgainstFlow, flowsOnRoute, penaliseAgainstFlow, flowBearingAt, legCostFactor,
  enforceOneWays,
  FLOW_CORRIDOR_M, AGAINST_FLOW_FACTOR,
} from '@/services/pedestrian-flow';
import { PEDESTRIAN_ONE_WAYS } from '@/content/diversions';
import { estimateMatrix, optimizeLocally, optimizeOrder } from '@/services/route-optimizer';
import { haversine, metresToPath, bearingDeg, type LatLng } from '@/lib/geo';
import { laneWalk } from '@/services/pedestrian-graph';
import catalogue from '@/content/catalogue.json';

/**
 * Walking against the crowd.
 *
 * The police make two stretches one-directional during the festival, and
 * no router knows it — these are not OSM one-ways, they exist for twelve
 * days. So the app prices them itself, and everything below is checked
 * against real mandals on the real stretches rather than invented points.
 */

const byName = (name: string) => {
  const w = PEDESTRIAN_ONE_WAYS.find((x) => x.name === name);
  if (!w) throw new Error(`no one-way named ${name}`);
  return w;
};

const at = (slug: string): LatLng => {
  const g = (catalogue.ganpatis as Array<{ slug: string; latitude: number; longitude: number }>)
    .find((x) => x.slug === slug);
  if (!g) throw new Error(`no mandal ${slug}`);
  return { lat: g.latitude, lng: g.longitude };
};

// Both sit on the Dagdusheth → Gotiram Bhaiya stretch: 1 m and 14 m off it.
const DAGDUSHETH = at('dagdusheth-halwai-ganpati');
const HUTATMA = at('hutatma-babu-genu-mandal');
const TULSHIBAUG = at('tulshibaug-ganpati');
// 41 m off the lane that branches west out of the main flow above
// Dagdusheth — the nearest mandal to it, and the one a walker steers by.
const GURUJI_TALIM = at('guruji-talim');
// 16 m from the far end of the lane that runs on south past Tulshibaug.
const JILBYA_MARUTI = at('jilbya-maruti-mandal');

describe('the catalogue these rules are written against', () => {
  it('still has both mandals sitting on the one-way stretch', () => {
    // If a coordinate is corrected and one of these walks out of the
    // corridor, every expectation below becomes a test of nothing.
    const southward = byName('Dagdusheth to Gotiram Bhaiya chowk').path;
    expect(metresToPath(DAGDUSHETH, southward)).toBeLessThan(FLOW_CORRIDOR_M);
    expect(metresToPath(HUTATMA, southward)).toBeLessThan(FLOW_CORRIDOR_M);

    const exit = byName('Guruji Talim to Tulshibaug').path;
    expect(metresToPath(TULSHIBAUG, exit)).toBeLessThan(FLOW_CORRIDOR_M);
  });
});

describe('a leg that runs against the crowd', () => {
  it('is named, walking north from Hutatma back up to Dagdusheth', () => {
    expect(legAgainstFlow(HUTATMA, DAGDUSHETH)).not.toBeNull();
  });

  it('is not named walking the other way, with the crowd', () => {
    expect(legAgainstFlow(DAGDUSHETH, HUTATMA)).toBeNull();
  });

  it('is not named for a leg that merely starts on the stretch', () => {
    // Dagdusheth to Tulshibaug leaves westwards. It touches the lane at one
    // end — which is true of most legs in the peths — and must not be
    // charged for walking up it.
    expect(legAgainstFlow(DAGDUSHETH, TULSHIBAUG)).toBeNull();
    expect(legAgainstFlow(TULSHIBAUG, DAGDUSHETH)).toBeNull();
  });

  it('leaves the branch between Dagdusheth and Guruji Talim open both ways', () => {
    // This ran as two one-way lanes through the Guruji Talim junction
    // until it was corrected on the ground: the whole 293 m of it, from
    // the west end at 18.514498, 73.853786 to the Dagdusheth end at
    // 18.515611, 73.856306, is two-way. Held here so it cannot quietly
    // come back — an ordering that sends people the long way round a
    // road they can simply walk up is worse than no rule at all.
    expect(legAgainstFlow(DAGDUSHETH, GURUJI_TALIM)).toBeNull();
    expect(legAgainstFlow(GURUJI_TALIM, DAGDUSHETH)).toBeNull();

    const westEnd = { lat: 18.514498, lng: 73.853786 };
    const dagdushethEnd = { lat: 18.515611, lng: 73.856306 };
    expect(legAgainstFlow(westEnd, dagdushethEnd)).toBeNull();
    expect(legAgainstFlow(dagdushethEnd, westEnd)).toBeNull();
  });

  it('sends walkers south out of Guruji Talim, not back north into it', () => {
    // The exit lane closes this junction: in from Dagdusheth, in from the
    // west, out southwards to Tulshibaug. Until that lane was known this
    // pair went uncharged, because the straight leg between them left the
    // corridor partway along — it now runs inside it the whole way.
    expect(legAgainstFlow(GURUJI_TALIM, TULSHIBAUG)).toBeNull();
    expect(legAgainstFlow(TULSHIBAUG, GURUJI_TALIM)?.name)
      .toBe('Guruji Talim to Tulshibaug');
  });

  it('follows a lane that turns, rather than averaging across the turn', () => {
    // This one bends 81° partway along — that is the road, not the way it
    // was drawn. A single bearing for the whole stretch would be wrong for
    // one half of it, so direction is read off the nearest segment.
    const lane = byName('Tulshibaug to Jilbya Maruti');
    const first = flowBearingAt({ lat: 18.514155, lng: 73.855167 }, lane.path)!;
    const second = flowBearingAt({ lat: 18.513766, lng: 73.855044 }, lane.path)!;
    expect(Math.abs(first - second)).toBeGreaterThan(45);

    expect(legAgainstFlow(TULSHIBAUG, JILBYA_MARUTI)).toBeNull();
    expect(legAgainstFlow(JILBYA_MARUTI, TULSHIBAUG)?.name)
      .toBe('Tulshibaug to Jilbya Maruti');
  });

  it('treats Tulshibaug as a fork, with two ways out and none back in', () => {
    // Two lanes leave Tulshibaug — south to Jilbya Maruti and east to the
    // main lane — and the lane down from Guruji Talim arrives there. A
    // walker can leave it two ways and return by neither.
    const out = ['Tulshibaug to Jilbya Maruti', 'Tulshibaug east to the main lane'];
    const TULSHIBAUG_END = { lat: 18.514183, lng: 73.855305 };
    for (const name of out) {
      expect(metresToPath(TULSHIBAUG_END, byName(name).path)).toBeLessThan(10);
    }
    expect(metresToPath(TULSHIBAUG_END, byName('Guruji Talim to Tulshibaug').path))
      .toBeLessThan(10);
  });

  it('leaves the rest of the city alone', () => {
    const shivajinagar = { lat: 18.5308, lng: 73.8478 };
    const kothrud = { lat: 18.5074, lng: 73.8077 };
    expect(legAgainstFlow(shivajinagar, kothrud)).toBeNull();
    expect(legAgainstFlow(kothrud, shivajinagar)).toBeNull();
  });
});

describe('what the walker is told', () => {
  it('names a stretch the route actually walks down', () => {
    const flows = flowsOnRoute([DAGDUSHETH, HUTATMA]);
    expect(flows).not.toHaveLength(0);
    expect(flows[0].note).toMatch(/one way/i);
  });

  it('says nothing about a stretch the route walks away from', () => {
    expect(flowsOnRoute([DAGDUSHETH, TULSHIBAUG])).toEqual([]);
  });

  it('says nothing about the branch out to Guruji Talim, which is two-way', () => {
    expect(flowsOnRoute([DAGDUSHETH, GURUJI_TALIM])).toEqual([]);
    expect(flowsOnRoute([GURUJI_TALIM, DAGDUSHETH])).toEqual([]);
  });

  it('still warns about the lane down from Guruji Talim to Tulshibaug', () => {
    const flows = flowsOnRoute([GURUJI_TALIM, TULSHIBAUG]);
    expect(flows.map((f) => f.name)).toEqual(['Guruji Talim to Tulshibaug']);
  });

  it('gives the two directions two different warnings', () => {
    // The southward pair share a note on purpose — one road above the
    // fork. The westward branch is a different road and must not be
    // folded into that warning by the deduplication.
    // One shared note for the two southward stretches (one road above the
    // fork); every other lane carries its own.
    const notes = new Set(PEDESTRIAN_ONE_WAYS.map((w) => w.note));
    expect(notes.size).toBe(PEDESTRIAN_ONE_WAYS.length - 1);
  });

  it('never repeats a warning, however many legs run along it', () => {
    // Both stretches cover this leg — they are one road above the fork —
    // and the walker must be told once, not twice.
    const flows = flowsOnRoute([DAGDUSHETH, HUTATMA, DAGDUSHETH, HUTATMA]);
    expect(new Set(flows.map((f) => f.note)).size).toBe(flows.length);
    expect(flows).toHaveLength(1);
  });

  it('carries a note that warns you cannot come back', () => {
    // Worded per direction — "back up" for the southward lanes, "back
    // east" for the westward branch — so this asserts on the substance
    // every one of them has to carry, not on one lane's phrasing.
    for (const w of PEDESTRIAN_ONE_WAYS) {
      expect(w.note).toMatch(/not be able to (walk|come) back/i);
      expect(w.note).toMatch(/one way|leaves the main lane/i);
    }
  });
});

describe('telling a walker which way to go', () => {
  /** The compass word the drawn path actually points in. */
  const headingOf = (w: { path: [number, number][] }) => {
    const [a] = w.path;
    const b = w.path[w.path.length - 1];
    const deg = bearingDeg({ lat: a[1], lng: a[0] }, { lat: b[1], lng: b[0] });
    if (deg >= 315 || deg < 45) return 'north';
    if (deg < 135) return 'east';
    if (deg < 225) return 'south';
    return 'west';
  };

  it('states a heading that matches the road as drawn', () => {
    // The word is written by hand and the line is not. This is what stops
    // the two from disagreeing — a lane labelled "walk south" that runs
    // north is worse than an unlabelled one, because a walker in a crowd
    // will act on it.
    for (const w of PEDESTRIAN_ONE_WAYS) {
      expect(w.heading).toBe(headingOf(w));
    }
  });

  it('names a destination a walker can see or ask for', () => {
    for (const w of PEDESTRIAN_ONE_WAYS) {
      expect(w.towards.length).toBeGreaterThan(0);
      // The destination is the far end of the lane, so it must not be the
      // place the walker is leaving.
      expect(w.name.startsWith(w.towards)).toBe(false);
    }
  });

  it('repeats the heading in the note, so the two cannot drift apart', () => {
    for (const w of PEDESTRIAN_ONE_WAYS) {
      expect(w.note.toLowerCase()).toContain(w.heading);
    }
  });
});

describe('the cost matrix', () => {
  it('leaves estimateMatrix itself as plain distance', () => {
    // The penalty deliberately does NOT live here. It lives in
    // optimizeOrder, which every ordering goes through — including the
    // one built from Google's matrix, which never touches this function.
    const m = estimateMatrix([DAGDUSHETH, HUTATMA], 'walk');
    expect(m[1][0]).toBeCloseTo(m[0][1], 5);
  });

  it('is asymmetric on foot once the flow is priced in', () => {
    const pts = [DAGDUSHETH, HUTATMA];
    const m = penaliseAgainstFlow(estimateMatrix(pts, 'walk'), pts, 'walk');
    // Asserted as a property, not as one constant. The gap is now set by
    // whichever rule has more to say — the corridor's flat factor, or the
    // graph's real walked length — and pinning the exact number would
    // make the test a restatement of the implementation.
    expect(m[1][0]).toBeGreaterThan(m[0][1]);
    expect(m[1][0] / m[0][1]).toBeGreaterThanOrEqual(AGAINST_FLOW_FACTOR);
  });

  it('is left symmetric for a rider', () => {
    // The crowd flow is a pedestrian measure. A two-wheeler is on the
    // diverted road network, and the closures already speak for that.
    const pts = [DAGDUSHETH, HUTATMA];
    const m = penaliseAgainstFlow(estimateMatrix(pts, 'two_wheeler'), pts, 'two_wheeler');
    expect(m[1][0]).toBeCloseTo(m[0][1], 5);
  });

  it('never invents a cost for an impassable leg', () => {
    const blocked = [[0, Infinity], [Infinity, 0]];
    const out = penaliseAgainstFlow(blocked, [DAGDUSHETH, HUTATMA], 'walk');
    expect(out[1][0]).toBe(Infinity);
  });

  it('leaves the diagonal at zero', () => {
    const pts = [DAGDUSHETH, HUTATMA];
    const m = penaliseAgainstFlow(estimateMatrix(pts, 'walk'), pts, 'walk');
    expect(m[0][0]).toBe(0);
    expect(m[1][1]).toBe(0);
  });
});

describe('the flow cannot be bypassed', () => {
  it('is priced by optimizeOrder itself, whatever matrix it is handed', () => {
    // The guard on the whole design. A caller that builds a matrix some
    // third way — Google's, a cached one, a hand-rolled one — still gets
    // an ordering that respects the lanes, because the pricing is in the
    // orderer rather than in one particular matrix builder.
    const origin = { lat: 18.5308, lng: 73.8478 };
    const points = [origin, HUTATMA, DAGDUSHETH];

    // A matrix that knows nothing about any of this: every leg costs the
    // same, so nothing but the flow can decide the order.
    const flat = points.map((_, i) => points.map((__, j) => (i === j ? 0 : 100)));

    const { order } = optimizeOrder(points, flat, 'walk');
    // Dagdusheth first, then south to Hutatma — with the crowd.
    expect(order).toEqual([1, 0]);

    // And on a two-wheeler the same flat matrix leaves the order alone,
    // because the lanes are a pedestrian measure.
    expect(optimizeOrder(points, flat, 'two_wheeler').totalCost).toBe(200);
  });
});

describe('a leg whose straight line touches no lane at all', () => {
  /**
   * The case the corridor rule cannot see, and the one that was actually
   * wrong on the map: Tulshibaug to Dagdusheth is 149 m apart with no
   * lane under the line between them, because the line cuts the block.
   * The real walk has to go round on lanes that run one way.
   */
  it('costs Dagdusheth to Tulshibaug at what walking it really takes', () => {
    const walk = laneWalk(DAGDUSHETH, TULSHIBAUG)!;
    expect(walk).not.toBeNull();
    // West along the two-way branch, then south down the one-way lane.
    expect(walk.metres).toBeGreaterThan(haversine(DAGDUSHETH, TULSHIBAUG));
    expect(legCostFactor(DAGDUSHETH, TULSHIBAUG, 'walk')).toBeGreaterThan(1.5);
  });

  it('finds no walk at all in the other direction', () => {
    // Out of Tulshibaug the lanes go south and east, and the main lane
    // runs south. There is no way back up to Dagdusheth.
    expect(laneWalk(TULSHIBAUG, DAGDUSHETH)).toBeNull();
    expect(legCostFactor(TULSHIBAUG, DAGDUSHETH, 'walk'))
      .toBeGreaterThan(legCostFactor(DAGDUSHETH, TULSHIBAUG, 'walk'));
  });

  it('puts Dagdusheth before Tulshibaug in a plan containing both', () => {
    // The whole point. Arriving from Shivajinagar, these two in either
    // input order come back the way the crowd allows.
    const origin = { lat: 18.5308, lng: 73.8478 };
    const stops = [TULSHIBAUG, DAGDUSHETH];
    expect(optimizeLocally(origin, stops, 'walk').order).toEqual([1, 0]);
  });

  it('leaves a rider alone, who is on the road network', () => {
    expect(legCostFactor(TULSHIBAUG, DAGDUSHETH, 'two_wheeler')).toBe(1);
  });
});

describe('the ordering a visitor actually gets', () => {
  it('sends them down the lane, not up it', () => {
    // Arriving from Shivajinagar, the same two mandals either way round.
    // Straight-line distance cannot separate the orderings; the flow can.
    const origin = { lat: 18.5308, lng: 73.8478 };
    const stops = [HUTATMA, DAGDUSHETH];
    const { order } = optimizeLocally(origin, stops, 'walk');
    expect(order).toEqual([1, 0]); // Dagdusheth first, then south to Hutatma
  });

  it('would have gone the other way without the flow', () => {
    // The guard on the test above: nearest-first from the north picks
    // Dagdusheth anyway only if the flow is doing the work. Check that the
    // raw geometry genuinely leaves the question open.
    const origin = { lat: 18.5308, lng: 73.8478 };
    const toDagdu = haversine(origin, DAGDUSHETH);
    const toHutatma = haversine(origin, HUTATMA);
    expect(Math.abs(toDagdu - toHutatma)).toBeLessThan(300);
  });
});

describe('making a drawn line obey the one-ways', () => {
  const lane = PEDESTRIAN_ONE_WAYS.find((w) => w.name === 'Dagdusheth to Gotiram Bhaiya chowk')!;

  it('leaves a line that already goes the right way exactly as it was', () => {
    // Southwards down the lane, which is the way the crowd walks.
    const withFlow: [number, number][] = [...lane.path];
    expect(enforceOneWays(withFlow)).toEqual(withFlow);
  });

  it('leaves a line nowhere near a lane alone', () => {
    const away: [number, number][] = [
      [73.8077, 18.5074],
      [73.8100, 18.5090],
      [73.8150, 18.5120],
    ];
    expect(enforceOneWays(away)).toEqual(away);
  });

  it('does not mangle a run it cannot legally replace', () => {
    // Northwards up the lane. There is no legal way back up it, and no
    // alternative anywhere in the data — so the honest thing is to leave
    // the line as the router drew it rather than invent one. What fixes
    // this leg is the ORDERING, which is tested separately.
    const against: [number, number][] = [...lane.path].reverse();
    const out = enforceOneWays(against);
    expect(out[0]).toEqual(against[0]);
    expect(out[out.length - 1]).toEqual(against[against.length - 1]);
  });

  it('never leaves two identical points behind', () => {
    const doubled: [number, number][] = [...lane.path, lane.path[lane.path.length - 1]];
    const out = enforceOneWays(doubled);
    for (let i = 1; i < out.length; i++) expect(out[i]).not.toEqual(out[i - 1]);
  });
});
