import { describe, it, expect } from 'vitest';
import catalogue from '@/content/catalogue.json';
import {
  paceRadiusFor, paceZones, resolvePaceZone, classifyDwell,
  stepDwell, initialDwellState,
  PACE_MAX_RADIUS_M, PACE_MIN_RADIUS_M,
  DWELL_LINGERING_S, DWELL_QUEUEING_S, DWELL_EXIT_GRACE_S,
  type PaceMandal, type PaceZone, type DwellState,
} from '@/features/crowd/pace';

/**
 * The dwell signal.
 *
 * Two things are worth guarding here. The geometry gate, because its whole
 * purpose is to refuse to guess which mandal a fix belongs to — and a
 * regression there would silently attribute one mandal's queue to another.
 * And the exit grace, because without it a single wild fix discards the
 * observation, and wild fixes are the normal condition in a peth lane.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const ALL = ((catalogue as any).ganpatis ?? (catalogue as any).items) as any[];
/* eslint-enable @typescript-eslint/no-explicit-any */

const MANDALS: PaceMandal[] = ALL.map((g) => ({
  id: g.slug,
  lat: g.latitude,
  lng: g.longitude,
  prominence: g.prominence,
}));

const ZONES = paceZones(MANDALS);
const zoneOf = (slug: string) => ZONES.find((z) => z.mandalId === slug);

describe('the radius comes from geometry, not a constant', () => {
  it('caps however isolated the mandal is', () => {
    expect(paceRadiusFor(50_000)).toBe(PACE_MAX_RADIUS_M);
  });

  it('shrinks to half the gap, less a margin', () => {
    expect(paceRadiusFor(139)).toBeCloseTo(64.5, 1);
    expect(paceRadiusFor(110)).toBeCloseTo(50, 1);
  });

  it('refuses a mandal whose neighbour is too close', () => {
    // Kasba and Phani Ali are 30 m apart. There is no radius around
    // either that excludes the other, so neither ever reports.
    expect(paceRadiusFor(30)).toBeNull();
    expect(paceRadiusFor(37)).toBeNull();
    expect(paceRadiusFor(2 * PACE_MIN_RADIUS_M + 20)).not.toBeNull();
  });
});

describe('zones over the real catalogue', () => {
  it('admits every mandal except the two that are absorbed', () => {
    expect(MANDALS.length).toBe(29);
    expect(ZONES.length).toBe(27);
  });

  it('gives the zone to the prominent mandal of a too-close pair', () => {
    // Kasba (prominence 980) is 30 m from Phani Ali (300). No radius
    // separates them, so Kasba takes the zone and Phani Ali gets none —
    // rather than the first version's answer, which was to throw away the
    // gramdaivat to protect a record it is 30 m from.
    const kasba = zoneOf('kasba-ganpati');
    expect(kasba).toBeDefined();
    expect(zoneOf('phani-ali-ganesh-mandir')).toBeUndefined();
    expect(kasba!.absorbs).toContain('phani-ali-ganesh-mandir');

    // And its radius is measured against the nearest mandal that still
    // has a zone — Bhausaheb Rangari at 255 m — not against the one it
    // absorbed. That is why it is the full cap and not 10 m.
    expect(kasba!.radiusM).toBe(PACE_MAX_RADIUS_M);
  });

  it('does the same for Bhausaheb Rangari and Balvikas', () => {
    const bh = zoneOf('bhau-rangari-ganpati');
    expect(bh).toBeDefined();
    expect(bh!.absorbs).toContain('balvikas-mandal');
    expect(zoneOf('balvikas-mandal')).toBeUndefined();
    // Measured against Tambdi Jogeshwari at 118 m, not Balvikas at 37 m.
    expect(bh!.radiusM).toBeCloseTo(54, 0);
  });

  it('records absorption nowhere else', () => {
    // Two peers 30 m apart would still both be excluded; absorption is
    // only for a decisive prominence gap, and only two pairs qualify.
    const absorbing = ZONES.filter((z) => z.absorbs.length > 0);
    expect(absorbing).toHaveLength(2);
  });

  it('includes Dagdusheth, which a flat 75 m radius would have excluded', () => {
    // Its nearest neighbour is Hutatma Babu Genu at 139 m, so a global
    // 75 m radius would overlap and disqualify the most important mandal
    // on the site. The per-mandal radius keeps it, at about 65 m.
    const z = zoneOf('dagdusheth-halwai-ganpati');
    expect(z).toBeDefined();
    expect(z!.radiusM).toBeGreaterThan(60);
    expect(z!.radiusM).toBeLessThan(70);
  });

  it('never lets two zones overlap', () => {
    // The guarantee the whole design rests on. If this fails, a fix can
    // be attributed to the wrong mandal.
    for (const a of ZONES) {
      for (const b of ZONES) {
        if (a.mandalId === b.mandalId) continue;
        const m = MANDALS.find((x) => x.id === a.mandalId)!;
        const n = MANDALS.find((x) => x.id === b.mandalId)!;
        const d = Math.hypot(
          (m.lat - n.lat) * 111_320,
          (m.lng - n.lng) * 111_320 * Math.cos((m.lat * Math.PI) / 180)
        );
        expect(d, `${a.mandalId} and ${b.mandalId} overlap`).toBeGreaterThan(
          a.radiusM + b.radiusM
        );
      }
    }
  });
});

describe('resolving a fix', () => {
  const dag = () => zoneOf('dagdusheth-halwai-ganpati')!;

  it('accepts a tight fix at the centre', () => {
    const z = dag();
    const hit = resolvePaceZone({ lat: z.lat, lng: z.lng }, 20, ZONES);
    expect(hit?.zone.mandalId).toBe('dagdusheth-halwai-ganpati');
  });

  it('rejects a fix whose error circle does not fit the radius', () => {
    // The test a naive distance check gets wrong, and the reason the
    // signal is rare. Standing at the centre with 120 m of error is not
    // being in a 65 m zone; it is being somewhere in a 120 m blur.
    const z = dag();
    expect(resolvePaceZone({ lat: z.lat, lng: z.lng }, 120, ZONES)).toBeNull();
    expect(resolvePaceZone({ lat: z.lat, lng: z.lng }, z.radiusM + 1, ZONES)).toBeNull();
    expect(resolvePaceZone({ lat: z.lat, lng: z.lng }, z.radiusM - 1, ZONES)).not.toBeNull();
  });

  it('rejects a fix outside every zone', () => {
    // Shivajinagar, well away from the peths.
    expect(resolvePaceZone({ lat: 18.531, lng: 73.848 }, 10, ZONES)).toBeNull();
  });

  it('returns nothing when two zones somehow both qualify', () => {
    // Synthetic, because the real catalogue cannot produce it. Guards the
    // case where a coordinate correction moves two mandals together and
    // nobody recomputes the radii.
    const a: PaceZone = { mandalId: 'a', lat: 18.5, lng: 73.85, radiusM: 70, nearestNeighbourM: 500, absorbs: [] };
    const b: PaceZone = { mandalId: 'b', lat: 18.5, lng: 73.85, radiusM: 70, nearestNeighbourM: 500, absorbs: [] };
    expect(resolvePaceZone({ lat: 18.5, lng: 73.85 }, 10, [a, b])).toBeNull();
  });
});

describe('dwell classes', () => {
  it('maps seconds to the three classes', () => {
    expect(classifyDwell(0)).toBe('passing');
    expect(classifyDwell(DWELL_LINGERING_S - 1)).toBe('passing');
    expect(classifyDwell(DWELL_LINGERING_S)).toBe('lingering');
    expect(classifyDwell(DWELL_QUEUEING_S - 1)).toBe('lingering');
    expect(classifyDwell(DWELL_QUEUEING_S)).toBe('queueing');
  });
});

describe('the dwell tracker', () => {
  const z = () => zoneOf('dagdusheth-halwai-ganpati')!;
  const at = (s: number) => 1_700_000_000_000 + s * 1000;
  const inside = () => ({ lat: z().lat, lng: z().lng });

  /** Walk the reducer through a sequence of (seconds, position) fixes. */
  function run(steps: [number, ReturnType<typeof inside> | null][], acc = 15) {
    let state: DwellState = initialDwellState;
    const emits: { mandalId: string; dwell: string; dwellSeconds: number; isFinal: boolean }[] = [];
    for (const [s, pos] of steps) {
      const out = stepDwell(state, at(s), pos, pos ? acc : null, ZONES);
      state = out.state;
      if (out.emit) emits.push(out.emit);
    }
    return { state, emits };
  }

  it('emits nothing for someone walking past', () => {
    const { emits } = run([[0, inside()], [30, inside()], [60, null]]);
    expect(emits).toEqual([]);
  });

  it('emits lingering, then queueing, once each', () => {
    const { emits } = run([
      [0, inside()], [60, inside()], [120, inside()], [200, inside()],
      [400, inside()], [500, inside()], [900, inside()],
    ]);
    expect(emits.map((e) => e.dwell)).toEqual(['lingering', 'queueing']);
    expect(emits[0].mandalId).toBe('dagdusheth-halwai-ganpati');
  });

  it('survives a single wild fix without losing the dwell', () => {
    // The exit grace. Without it, one bad reading at 200s resets the
    // clock and the queue observation at 400s never happens — and bad
    // readings are the normal condition in these lanes.
    const { emits } = run([
      [0, inside()], [120, inside()],
      [200, null],            // one wild fix
      [230, inside()],        // back, inside the grace period
      [400, inside()],
    ]);
    expect(emits.map((e) => e.dwell)).toEqual(['lingering', 'queueing']);
  });

  it('forgets the visit once the departure persists', () => {
    const { state } = run([
      [0, inside()], [120, inside()],
      [200, null], [200 + DWELL_EXIT_GRACE_S + 1, null],
    ]);
    expect(state.mandalId).toBeNull();
    expect(state.enteredAtMs).toBeNull();
  });

  it('writes a final sample with the REAL duration when the visit ends', () => {
    // The bug this guards. The real clock (useClockMs) ticks on exact 30s
    // boundaries and both thresholds are multiples of 30, so a threshold
    // marker ALWAYS reads exactly 90 or 360 — a 14-minute queue and a
    // 6-minute one are indistinguishable from those rows alone. The final
    // sample is the only one carrying a real duration.
    const ticks: [number, ReturnType<typeof inside> | null][] = [];
    for (let t = 0; t <= 840; t += 30) ticks.push([t, inside()]);   // inside
    for (let t = 870; t <= 990; t += 30) ticks.push([t, null]);     // then gone

    const { emits } = run(ticks);
    const markers = emits.filter((e) => !e.isFinal);
    const final = emits.filter((e) => e.isFinal);

    // Pinned exactly, because this is the claim: the markers are constants.
    expect(markers.map((e) => e.dwellSeconds)).toEqual([90, 360]);
    expect(markers.map((e) => e.dwell)).toEqual(['lingering', 'queueing']);

    expect(final).toHaveLength(1);
    // Measured to the first fix seen OUTSIDE (870s), so the 120s grace
    // period is not counted as time spent in a queue.
    expect(final[0].dwellSeconds).toBe(870);
    expect(final[0].dwell).toBe('queueing');
  });

  it('writes no final sample for a walk-past', () => {
    const { emits } = run([
      [0, inside()], [30, inside()],
      [60, null], [60 + DWELL_EXIT_GRACE_S + 1, null],
    ]);
    expect(emits).toEqual([]);
  });

  it('restarts the clock when the device moves to another mandal', () => {
    const other = zoneOf('akhil-mandai-mandal') ?? ZONES.find((x) => x.mandalId !== z().mandalId)!;
    let state = initialDwellState;
    state = stepDwell(state, at(0), inside(), 15, ZONES).state;
    state = stepDwell(state, at(400), inside(), 15, ZONES).state;
    const moved = stepDwell(state, at(420), { lat: other.lat, lng: other.lng }, 15, ZONES);
    expect(moved.state.mandalId).toBe(other.mandalId);
    expect(moved.state.lastEmittedAtS).toBeNull();
    expect(moved.emit).toBeNull();
  });

  it('emits nothing at all when the fix is too coarse', () => {
    // A whole evening standing at Dagdusheth with a 130 m fix produces
    // no records. That is intended: unattributable is unusable.
    const { emits } = run(
      [[0, inside()], [120, inside()], [400, inside()], [900, inside()]],
      130
    );
    expect(emits).toEqual([]);
  });

  it('emits nothing without a position at all', () => {
    const { emits, state } = run([[0, null], [120, null], [900, null]]);
    expect(emits).toEqual([]);
    expect(state).toEqual(initialDwellState);
  });

  it('attributes a dwell at Phani Ali to Kasba, and says so', () => {
    // The declared cost of absorption. Standing at Phani Ali, 30 m from
    // Kasba, records dwell against Kasba — because no radius can tell the
    // two apart and Kasba is 3.3x the prominence. The zone names what it
    // absorbed so a later comparison reads it as "Kasba and Phani Ali".
    const phani = ALL.find((g) => g.slug === 'phani-ali-ganesh-mandir')!;
    const pos = { lat: phani.latitude, lng: phani.longitude };
    let state = initialDwellState;
    const emits: { mandalId: string }[] = [];
    for (const sec of [0, 120, 400, 900]) {
      const out = stepDwell(state, at(sec), pos, 10, ZONES);
      state = out.state;
      if (out.emit) emits.push(out.emit);
    }
    expect(emits.length).toBeGreaterThan(0);
    for (const e of emits) expect(e.mandalId).toBe('kasba-ganpati');
    expect(zoneOf('kasba-ganpati')!.absorbs).toContain('phani-ali-ganesh-mandir');
  });
});
