import { describe, it, expect } from 'vitest';
import {
  legAgainstFlow, flowsOnRoute, penaliseAgainstFlow,
  FLOW_CORRIDOR_M, AGAINST_FLOW_FACTOR,
} from '@/services/pedestrian-flow';
import { PEDESTRIAN_ONE_WAYS } from '@/content/diversions';
import { estimateMatrix, optimizeLocally } from '@/services/route-optimizer';
import { haversine, metresToPath, type LatLng } from '@/lib/geo';
import catalogue from '@/content/catalogue.json';

/**
 * Walking against the crowd.
 *
 * The police make two stretches one-directional during the festival, and
 * no router knows it — these are not OSM one-ways, they exist for twelve
 * days. So the app prices them itself, and everything below is checked
 * against real mandals on the real stretches rather than invented points.
 */

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

describe('the catalogue these rules are written against', () => {
  it('still has both mandals sitting on the one-way stretch', () => {
    // If a coordinate is corrected and one of these walks out of the
    // corridor, every expectation below becomes a test of nothing.
    const southward = PEDESTRIAN_ONE_WAYS.find((w) => w.bearingDeg === 187)!.path;
    expect(metresToPath(DAGDUSHETH, southward)).toBeLessThan(FLOW_CORRIDOR_M);
    expect(metresToPath(HUTATMA, southward)).toBeLessThan(FLOW_CORRIDOR_M);

    const westward = PEDESTRIAN_ONE_WAYS.find((w) => w.bearingDeg === 242)!.path;
    expect(metresToPath(GURUJI_TALIM, westward)).toBeLessThan(FLOW_CORRIDOR_M);
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

  it('is named walking east from Guruji Talim back towards Dagdusheth', () => {
    // The westward branch. A separate lane from the southward flow, with
    // its own bearing and its own warning.
    const w = legAgainstFlow(GURUJI_TALIM, DAGDUSHETH);
    expect(w?.name).toMatch(/Guruji Talim/);
  });

  it('is not named walking west out to Guruji Talim', () => {
    expect(legAgainstFlow(DAGDUSHETH, GURUJI_TALIM)).toBeNull();
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

  it('closes the junction the two westward lanes converge on', () => {
    // Two lanes point into it and one points out. If an inbound lane is
    // ever added without an outbound one, the app can route people to a
    // junction it cannot route them out of — so the shape is asserted.
    const into = PEDESTRIAN_ONE_WAYS.filter((w) => [242, 68].includes(w.bearingDeg));
    const outOf = PEDESTRIAN_ONE_WAYS.filter((w) => w.bearingDeg === 163);
    expect(into).toHaveLength(2);
    expect(outOf).toHaveLength(1);
    // Every one of them touches the same point, within a junction's width.
    const junction = { lat: 18.515006, lng: 73.855047 };
    for (const w of [...into, ...outOf]) {
      expect(metresToPath(junction, w.path)).toBeLessThan(10);
    }
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

  it('warns separately about the westward branch', () => {
    const flows = flowsOnRoute([DAGDUSHETH, GURUJI_TALIM]);
    expect(flows.map((f) => f.name)).toEqual(['Dagdusheth to Guruji Talim']);
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

describe('the cost matrix', () => {
  it('is asymmetric on foot where the flow is', () => {
    const pts = [DAGDUSHETH, HUTATMA];
    const m = estimateMatrix(pts, 'walk');
    expect(m[1][0]).toBeGreaterThan(m[0][1]);
    expect(m[1][0] / m[0][1]).toBeCloseTo(AGAINST_FLOW_FACTOR, 5);
  });

  it('is left symmetric for a rider', () => {
    // The crowd flow is a pedestrian measure. A two-wheeler is on the
    // diverted road network, and the closures already speak for that.
    const m = estimateMatrix([DAGDUSHETH, HUTATMA], 'two_wheeler');
    expect(m[1][0]).toBeCloseTo(m[0][1], 5);
  });

  it('never invents a cost for an impassable leg', () => {
    const blocked = [[0, Infinity], [Infinity, 0]];
    const out = penaliseAgainstFlow(blocked, [DAGDUSHETH, HUTATMA], 'walk');
    expect(out[1][0]).toBe(Infinity);
  });

  it('leaves the diagonal at zero', () => {
    const m = estimateMatrix([DAGDUSHETH, HUTATMA], 'walk');
    expect(m[0][0]).toBe(0);
    expect(m[1][1]).toBe(0);
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
