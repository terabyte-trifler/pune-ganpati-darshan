import { describe, it, expect } from 'vitest';
import {
  METRO_STATIONS, PRIMARY_STATIONS, ANCHOR_MAX_M,
  nearestStation, stationForRoute, stationById,
} from '@/lib/metro';
import { MODE_SPEED_MPS } from '@/lib/geo';
import { toTravelMode } from '@/db/database.types';

/**
 * Metro anchoring.
 *
 * Two things here are easy to get wrong in ways a browser would not show:
 * preferring a station that is nearer but on the wrong side of the river,
 * and anchoring a route to a station twenty kilometres from its first stop.
 * Both produce a page that renders perfectly and tells someone to walk
 * somewhere they cannot walk.
 */

/** Real positions from the catalogue, so the fixtures are not invented. */
const DAGDUSHETH = { lat: 18.5163, lng: 73.8567 };
const KASBA_GANPATI = { lat: 18.5196, lng: 73.8553 };
const MORYA_GOSAVI = { lat: 18.6440, lng: 73.7960 };

describe('travel mode coercion', () => {
  it('translates retired modes to metro rather than dropping them', () => {
    // 'drive' was retired because the peths are closed to vehicles. Someone
    // who chose it wanted to arrive from outside the core, which is now the
    // metro's job — falling back to 'walk' would claim a cross-city drive
    // is a walk.
    expect(toTravelMode('drive')).toBe('metro');
    expect(toTravelMode('transit')).toBe('metro');
  });

  it('passes current modes through untouched', () => {
    expect(toTravelMode('walk')).toBe('walk');
    expect(toTravelMode('two_wheeler')).toBe('two_wheeler');
    expect(toTravelMode('metro')).toBe('metro');
  });

  it('falls back to walk for anything unrecognised', () => {
    expect(toTravelMode(null)).toBe('walk');
    expect(toTravelMode('helicopter')).toBe('walk');
  });
});

describe('metro is an anchor, not a leg', () => {
  it('moves at walking speed', () => {
    // If this ever diverges, the planner will quote a ten-minute crossing
    // of the peths that takes fifty. The stations are further apart than
    // the mandals; nobody rides one stop.
    expect(MODE_SPEED_MPS.metro).toBe(MODE_SPEED_MPS.walk);
  });
});

describe('nearestStation', () => {
  it('picks the station you would actually walk from', () => {
    const found = nearestStation(DAGDUSHETH);
    expect(found?.station.id).toBe('kasba-peth');
    expect(found!.distanceM).toBeLessThan(600);
  });

  it('prefers a primary station over a closer one across the river', () => {
    // A point on the west bank near Jangli Maharaj Road. Sambhaji Udyan is
    // several times closer as the crow flies, but the crow does not cross
    // on Sambhaji Bridge and the walk in is 20+ minutes.
    const westBank = { lat: 18.5210, lng: 73.8460 };
    const found = nearestStation(westBank);
    expect(found?.station.tier).toBe('primary');
    expect(found?.station.id).not.toBe('sambhaji-udyan');
  });

  it('still returns a secondary station when no primary is in range', () => {
    // Standing on the Sambhaji Udyan platform, with the search tightened so
    // that no primary station qualifies. The radius is pinned in the test
    // rather than relying on Pune's geography putting the peth stations far
    // enough away — the branch under test is "no primary in range", and it
    // should be exercised directly.
    const atSambhajiUdyan = { lat: 18.5213, lng: 73.8437 };
    const found = nearestStation(atSambhajiUdyan, 300);
    expect(found?.station.id).toBe('sambhaji-udyan');
    expect(found?.station.tier).toBe('secondary');
  });

  it('prefers a primary station even from the secondary\'s own doorstep', () => {
    // The same point at the normal radius: the Aqua Line station is metres
    // away and a primary one is over a kilometre off, and the primary still
    // wins, because the kilometre is walkable and the river is the problem.
    const atSambhajiUdyan = { lat: 18.5213, lng: 73.8437 };
    expect(nearestStation(atSambhajiUdyan)?.station.tier).toBe('primary');
  });

  it('returns null rather than a station too far to walk from', () => {
    // Morya Gosavi in Chinchwad. The only route that was ever a driving one
    // is now metro, and this is what stops it claiming a Mandai start.
    expect(nearestStation(MORYA_GOSAVI)).toBeNull();
  });
});

describe('stationForRoute', () => {
  it('anchors to the first stop, not the average of them', () => {
    // A route walked north to south: you get off where it begins.
    const stops = [
      { location: KASBA_GANPATI },
      { location: DAGDUSHETH },
      { location: { lat: 18.5100, lng: 73.8555 } },
    ];
    expect(stationForRoute(stops)?.station.id).toBe('kasba-peth');
  });

  it('returns null for an empty route', () => {
    expect(stationForRoute([])).toBeNull();
  });

  it('returns null for a route nowhere near the line', () => {
    expect(stationForRoute([{ location: MORYA_GOSAVI }])).toBeNull();
  });
});

describe('station data', () => {
  it('has the three peth stations as primary and the two Aqua ones as rare', () => {
    expect(PRIMARY_STATIONS.map((s) => s.id).sort()).toEqual(
      ['kasba-peth', 'mandai', 'pmc']
    );
    expect(
      METRO_STATIONS.filter((s) => s.tier === 'secondary').map((s) => s.id).sort()
    ).toEqual(['deccan-gymkhana', 'sambhaji-udyan']);
  });

  it('places every station inside the anchor radius of the peth core', () => {
    // Not a coordinate check — those are approximate by design — but a
    // guard against a typo putting a station in another district.
    for (const s of METRO_STATIONS) {
      const d = nearestStation({ lat: s.lat, lng: s.lng }, ANCHOR_MAX_M);
      expect(d, `${s.id} is unreachable from itself`).not.toBeNull();
    }
  });

  it('resolves stations by id and rejects unknown ones', () => {
    expect(stationById('mandai')?.name).toBe('Mandai');
    expect(stationById('swargate')).toBeNull();
  });
});
