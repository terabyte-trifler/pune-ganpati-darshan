import { describe, it, expect } from 'vitest';
import {
  METRO_STATIONS, DARSHAN_STATIONS, ARRIVAL_STATIONS, EXIT_ONLY_STATIONS,
  PRIMARY_STATIONS, LINE_ORDER, ANCHOR_MAX_M, PRIMARY_PREFERENCE_M,
  nearestStation, nearestBoardingStation, stationForRoute, stationById,
  planMetroJourney, primaryLine, blockedNearerStation, returnStation,
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

/**
 * Real positions from the catalogue, copied exactly.
 *
 * These were approximations until the station coordinates were corrected
 * and every expectation built on them turned out to be measuring my own
 * guesses rather than the product. Distances quoted in the tests below are
 * the true ones, so a coordinate change breaks them loudly.
 */
const DAGDUSHETH = { lat: 18.51514, lng: 73.856379 };
const KASBA_GANPATI = { lat: 18.51903, lng: 73.857241 };
/** Out west by the river, where the Aqua Line genuinely wins. */
const GARUD = { lat: 18.5137, lng: 73.8456 };
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
    // Kasba Peth is 771 m from Dagdusheth; PMC is 908 m and the Aqua Line
    // stations over a kilometre. Mandai is 295 m and excluded — it is
    // boarding-only.
    const found = nearestStation(DAGDUSHETH);
    expect(found?.station.id).toBe('kasba-peth');
    expect(found!.distanceM).toBeCloseTo(771, -2);
  });

  it('never sends anyone to get off at Mandai', () => {
    // The whole reason this rule exists. Mandai is the nearest station to
    // thirteen of the twenty-three mandals and runs one-way during the
    // festival, so it wins on distance and is still the wrong answer. The
    // fixture is Akhil Mandai Mandal, 64 m from the platform — if the
    // filter ever fails, it fails here first.
    const near = { lat: 18.511852, lng: 73.856135 };
    expect(nearestStation(near)?.station.id).not.toBe('mandai');
    expect(nearestStation(DAGDUSHETH)?.station.id).not.toBe('mandai');
    expect(ARRIVAL_STATIONS.map((s) => s.id)).not.toContain('mandai');
  });

  it('keeps the primary station when the two are comparably far', () => {
    // Tulshibaug: Kasba Peth 909 m, Sambhaji Udyan 1,017 m. Inside the
    // margin, so the peth station wins even though it is not the nearest
    // by a strict reading of the numbers.
    const tulshibaug = { lat: 18.514268, lng: 73.855306 };
    const found = nearestStation(tulshibaug)!;
    expect(found.station.id).toBe('kasba-peth');
    expect(found.station.tier).toBe('primary');
  });

  it('gives up the primary station when a secondary is clearly closer', () => {
    // Garud Ganpati: Deccan Gymkhana 318 m, PMC 1,290 m. The old rule
    // preferred a primary station at any distance and would have sent
    // someone the best part of a kilometre out of their way; it was
    // calibrated against station coordinates that were 330–470 m wrong.
    const found = nearestStation(GARUD)!;
    expect(found.station.id).toBe('deccan-gymkhana');
    expect(found.distanceM).toBeCloseTo(318, -2);
  });

  it('draws the line at the stated margin, not at whichever is nearest', () => {
    // The preference is deliberately not "nearest wins". A secondary has to
    // beat the primary by more than PRIMARY_PREFERENCE_M to be chosen, so
    // the behaviour is a documented judgement rather than an accident of
    // straight-line arithmetic near a river.
    expect(PRIMARY_PREFERENCE_M).toBeGreaterThan(0);

    const tulshibaug = { lat: 18.514268, lng: 73.855306 };
    const kept = nearestStation(tulshibaug)!;
    const secondaryGap = 1017 - kept.distanceM;
    expect(secondaryGap).toBeLessThan(PRIMARY_PREFERENCE_M);
  });

  it('still returns a secondary station when no primary is in range', () => {
    // Standing on the Sambhaji Udyan platform, with the search tightened so
    // that no primary station qualifies. The radius is pinned in the test
    // rather than relying on Pune's geography putting the peth stations far
    // enough away — the branch under test is "no primary in range", and it
    // should be exercised directly.
    const atSambhajiUdyan = { lat: 18.520226794497926, lng: 73.84798920582429 };
    const found = nearestStation(atSambhajiUdyan, 300);
    expect(found?.station.id).toBe('sambhaji-udyan');
    expect(found?.station.tier).toBe('secondary');
  });

  it('returns null rather than a station too far to walk from', () => {
    // Morya Gosavi in Chinchwad. The only route that was ever a driving one
    // is now metro, and this is what stops it claiming a Mandai start.
    expect(nearestStation(MORYA_GOSAVI)).toBeNull();
  });
});

describe('stationForRoute', () => {
  it('anchors to the first stop, not the average of them', () => {
    // A route walked north to south: you get off where it begins. Kasba
    // Ganpati is 357 m from Kasba Peth station; the later stops are much
    // further from it, so a centroid would answer differently.
    const stops = [
      { location: KASBA_GANPATI },
      { location: DAGDUSHETH },
      { location: { lat: 18.5100, lng: 73.8555 } },
    ];
    const found = stationForRoute(stops)!;
    expect(found.station.id).toBe('kasba-peth');
    expect(found.distanceM).toBeCloseTo(357, -2);
  });

  it('would answer differently from the last stop, which is the point', () => {
    // Guards the choice of the first stop over the centroid or the end.
    const stops = [{ location: GARUD }, { location: KASBA_GANPATI }];
    expect(stationForRoute(stops)?.station.id).toBe('deccan-gymkhana');
    expect(stationForRoute([...stops].reverse())?.station.id).toBe('kasba-peth');
  });

  it('returns null for an empty route', () => {
    expect(stationForRoute([])).toBeNull();
  });

  it('returns null for a route nowhere near the line', () => {
    expect(stationForRoute([{ location: MORYA_GOSAVI }])).toBeNull();
  });
});

describe('station data', () => {
  it('offers the four arrival stations, ranked, and Mandai in none of them', () => {
    expect(ARRIVAL_STATIONS.map((s) => s.id).sort()).toEqual(
      ['deccan-gymkhana', 'kasba-peth', 'pmc', 'sambhaji-udyan']
    );
    expect(PRIMARY_STATIONS.map((s) => s.id).sort()).toEqual(
      ['kasba-peth', 'pmc']
    );
    expect(EXIT_ONLY_STATIONS.map((s) => s.id)).toEqual(['mandai']);
    expect(
      DARSHAN_STATIONS.filter((s) => s.tier === 'secondary').map((s) => s.id).sort()
    ).toEqual(['deccan-gymkhana', 'sambhaji-udyan']);
  });

  it('keeps every arrival station inside the anchor radius of the peth core', () => {
    // Not a coordinate check — those are approximate by design — but a
    // guard against a typo putting one of the five in another district.
    // Network stations are excluded on purpose: Ramwadi is nowhere near
    // the peths, which is exactly why you do not get off there.
    for (const s of ARRIVAL_STATIONS) {
      const d = nearestStation({ lat: s.lat, lng: s.lng }, ANCHOR_MAX_M);
      expect(d, `${s.id} is unreachable from itself`).not.toBeNull();
    }
  });

  it('never offers a network station as somewhere to get off', () => {
    // Standing on the Shivajinagar platform, one stop from Civil Court.
    // It is by far the nearest station, and it is still the wrong answer:
    // you do not get off at Shivajinagar for Dagdusheth.
    const atShivajinagar = { lat: 18.5310, lng: 73.8480 };
    expect(nearestStation(atShivajinagar)?.station.tier).not.toBe('network');
  });

  it('lists every station in exactly the lines it claims', () => {
    for (const s of METRO_STATIONS) {
      expect(s.lines.length, `${s.id} has no line`).toBeGreaterThan(0);
      for (const line of s.lines) {
        expect(
          LINE_ORDER[line].includes(s.id),
          `${s.id} claims the ${line} line but is not in its order`
        ).toBe(true);
      }
    }
  });

  it('has no station in a line order that is missing from the catalogue', () => {
    for (const [line, ids] of Object.entries(LINE_ORDER)) {
      for (const id of ids) {
        expect(stationById(id), `${line} lists unknown station ${id}`).not.toBeNull();
      }
    }
  });

  it('resolves stations by id and rejects unknown ones', () => {
    expect(stationById('mandai')?.name).toBe('Mandai');
    // Swargate used to stand in for "unknown" here and is now a real
    // station on the Purple Line, which is the point of the whole network
    // addition — use something genuinely not on either line.
    expect(stationById('shaniwar-wada')).toBeNull();
  });
});

describe('planMetroJourney', () => {
  const MANDAI = stationById('mandai')!;
  const KASBA = stationById('kasba-peth')!;
  const PMC = stationById('pmc')!;

  it('rides one line when the traveller is already on it', () => {
    // Swargate is one stop south of Mandai on the Purple Line.
    const atSwargate = { lat: 18.5010, lng: 73.8580 };
    const j = planMetroJourney(atSwargate, MANDAI)!;

    expect(j.board.id).toBe('swargate');
    expect(j.legs).toHaveLength(1);
    expect(j.legs[0].line).toBe('purple');
    expect(j.legs[0].stops).toBe(1);
    expect(j.interchange).toBeNull();
  });

  it('names the terminus so the platform is unambiguous', () => {
    // Northbound and southbound on the same line must not read the same.
    const atPcmc = { lat: 18.6285, lng: 73.8000 };
    const fromNorth = planMetroJourney(atPcmc, MANDAI)!;
    expect(fromNorth.legs[0].towards).toBe('Swargate');

    const atSwargate = { lat: 18.5010, lng: 73.8580 };
    const fromSouth = planMetroJourney(atSwargate, KASBA)!;
    expect(fromSouth.legs[0].towards).toBe('PCMC');
  });

  it('changes at Civil Court when the lines differ', () => {
    // Kalyani Nagar is on the Aqua Line; Mandai is on the Purple. The only
    // place they meet is Civil Court.
    const atKalyaniNagar = { lat: 18.5480, lng: 73.9010 };
    const j = planMetroJourney(atKalyaniNagar, MANDAI)!;

    expect(j.board.id).toBe('kalyani-nagar');
    expect(j.legs).toHaveLength(2);
    expect(j.interchange?.id).toBe('civil-court');
    expect(j.legs[0].line).toBe('aqua');
    expect(j.legs[1].line).toBe('purple');
    expect(j.legs[1].towards).toBe('Swargate');
    expect(j.totalStops).toBe(j.legs[0].stops + j.legs[1].stops);
  });

  it('does not invent a change when both stations are on the Aqua Line', () => {
    // PMC is on the Aqua Line, so someone from Vanaz rides straight there.
    const atVanaz = { lat: 18.5075, lng: 73.8065 };
    const j = planMetroJourney(atVanaz, PMC)!;

    expect(j.legs).toHaveLength(1);
    expect(j.interchange).toBeNull();
    expect(j.legs[0].towards).toBe('Ramwadi');
  });

  it('says you are already there rather than printing a zero-stop ride', () => {
    const atMandai = { lat: MANDAI.lat, lng: MANDAI.lng };
    const j = planMetroJourney(atMandai, MANDAI)!;

    expect(j.alreadyThere).toBe(true);
    expect(j.legs).toHaveLength(0);
    expect(j.totalStops).toBe(0);
  });

  it('returns null when no station is within walking distance', () => {
    // Lonavala, 60 km west. The network is two lines and most of the
    // district is on neither.
    expect(planMetroJourney({ lat: 18.7546, lng: 73.4062 }, MANDAI)).toBeNull();
  });

  it('boards wherever you are, including at a network station', () => {
    // Unlike alighting, boarding has no tier preference — you get on where
    // you stand.
    const atRubyHall = { lat: 18.5340, lng: 73.8790 };
    expect(nearestBoardingStation(atRubyHall)?.station.id).toBe('ruby-hall-clinic');
  });

  it('colours the interchange by the line that reaches the peths', () => {
    expect(primaryLine(stationById('civil-court')!)).toBe('purple');
  });
});

describe('Mandai is one-way during the festival', () => {
  const MANDAI = stationById('mandai')!;
  /**
   * Tulshibaug, from the catalogue. Chosen over Dagdusheth deliberately:
   * Mandai is genuinely the nearest station to Tulshibaug (346 m against
   * Kasba Peth's 491 m), whereas Dagdusheth is a near tie that falls the
   * other way by about forty metres. Thirteen of the twenty-three mandals
   * are nearest to Mandai, which is what makes the one-way rule matter.
   */
  const TULSHIBAUG = { lat: 18.514268, lng: 73.855306 };

  it('is still where you board to go home', () => {
    // The asymmetry is the point. Boarding is never restricted, so the
    // station you could not arrive at is very often the one you leave from
    // — and a visitor told only half of that walks back to Kasba Peth for
    // no reason.
    const home = returnStation([{ location: TULSHIBAUG }]);
    expect(home?.station.id).toBe('mandai');
    expect(home!.station.canAlight).toBe(false);
  });

  it('is named as the closer station you cannot use, so the app explains itself', () => {
    const alight = nearestStation(TULSHIBAUG)!.station;
    const blocked = blockedNearerStation(TULSHIBAUG, alight)!;

    expect(blocked.station.id).toBe('mandai');
    expect(blocked.distanceM).toBeLessThan(
      nearestStation(TULSHIBAUG)!.distanceM
    );
    expect(blocked.station.alightNote).toBeTruthy();
  });

  it('says nothing when the chosen station is already the nearest', () => {
    // No explanation where none is needed: from PMC's doorstep there is no
    // closer blocked station, so the note must not appear.
    const atPmc = { lat: 18.5272, lng: 73.8502 };
    expect(blockedNearerStation(atPmc, stationById('pmc')!)).toBeNull();
  });

  it('can still be ridden through without stopping', () => {
    // Swargate is south of Mandai on the Purple Line, so a journey north
    // passes through it. Passing through is not alighting, and the leg
    // must still be planned.
    const atSwargate = { lat: 18.5010, lng: 73.8580 };
    const j = planMetroJourney(atSwargate, stationById('kasba-peth')!)!;
    expect(j.legs[0].stops).toBe(2);
    expect(j.alight.id).toBe('kasba-peth');
  });

  it('carries a note that names the alternative', () => {
    // The message is user-facing, and "you cannot get off here" without
    // "get off at Kasba Peth instead" leaves someone stuck on a train.
    expect(MANDAI.alightNote).toMatch(/Kasba Peth/);
  });
});
