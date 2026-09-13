import { describe, it, expect } from 'vitest';
import { chooseParking } from '@/services/parking-plan';
import { buildItinerary } from '@/services/itinerary';
import type { ParkingSpot } from '@/content/parking';
import catalogue from '@/content/catalogue.json';
import type { Ganpati } from '@/types/ganpati';

/**
 * Two-wheeler mode: ride to parking, then walk.
 *
 * The behaviour worth pinning is the trade-off. "Nearest to me" and
 * "nearest to the mandals" are both wrong on their own, and a plan that
 * picks either will look reasonable while sending someone to the wrong
 * end of the peths.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const ALL = ((catalogue as any).ganpatis ?? (catalogue as any).items) as any[];
/* eslint-enable @typescript-eslint/no-explicit-any */

const mandal = (slug: string) => {
  const g = ALL.find((x) => x.slug === slug);
  return { location: { lat: g.latitude, lng: g.longitude } };
};

const spot = (no: number, name: string, lat: number, lng: number): ParkingSpot => ({
  no, name, sourceName: name, kind: 'lot', lat, lng,
});

describe('choosing where to park', () => {
  it('says nothing when there is nothing to plan', () => {
    expect(chooseParking({ lat: 18.52, lng: 73.85 }, [])).toBeNull();
    expect(chooseParking({ lat: 18.52, lng: 73.85 }, [mandal('kasba-ganpati')], [])).toBeNull();
  });

  it('prefers a slightly longer ride that saves a long walk', () => {
    // The whole reason this is scored on the total journey. `near` is
    // right beside the rider but two kilometres from the mandals; `far`
    // is a little further to ride and sits among them.
    const rider = { lat: 18.5400, lng: 73.8300 };
    const near = spot(1, 'Beside the rider', 18.5395, 73.8305);
    const far = spot(2, 'Among the mandals', 18.5180, 73.8560);

    const mandals = [
      mandal('kasba-ganpati'),
      mandal('tambdi-jogeshwari'),
      mandal('tulshibaug-ganpati'),
    ];

    const choice = chooseParking(rider, mandals, [near, far])!;
    expect(choice.spot.no).toBe(2);
  });

  it('prefers the closer ride when the walk is the same either way', () => {
    // The mirror case: two parkings equally placed for the walk, so the
    // ride decides. Without this the scoring could ignore the rider.
    const rider = { lat: 18.5300, lng: 73.8550 };
    const mandals = [mandal('kasba-ganpati')];
    const k = mandal('kasba-ganpati').location;

    const north = spot(1, 'North of Kasba', k.lat + 0.0045, k.lng);
    const south = spot(2, 'South of Kasba', k.lat - 0.0045, k.lng);

    // The rider is north, so the northern spot should win on ride time.
    expect(chooseParking(rider, mandals, [north, south])!.spot.no).toBe(1);
  });

  it('reports the ride and the walk separately', () => {
    const choice = chooseParking(
      { lat: 18.5900, lng: 73.7700 }, // well outside the peths
      [mandal('kasba-ganpati'), mandal('tulshibaug-ganpati')]
    )!;
    expect(choice.rideMinutes).toBeGreaterThan(0);
    expect(choice.walkMinutes).toBeGreaterThan(0);
    // The total is the sum, so the UI can show a breakdown that adds up.
    expect(choice.travelMinutes).toBe(
      Math.round(choice.rideMinutes + choice.walkMinutes)
    );
    expect(choice.order).toHaveLength(2);
  });
});

describe('a two-wheeler itinerary', () => {
  const mandals = ALL.slice(0, 12).map((g) => ({
    id: g.id, slug: g.slug, name: g.name,
    location: { lat: g.latitude, lng: g.longitude },
    isTemple: g.is_temple, prominence: g.prominence,
    darshanMinutes: g.darshan_minutes, peakDarshanMinutes: g.peak_darshan_minutes,
    category: g.category, manacheRank: g.manache_rank, tags: g.tags ?? [],
  })) as unknown as Ganpati[];

  const base = {
    budgetMinutes: 240,
    interests: ['famous' as const],
    pace: 'balanced' as const,
    origin: { lat: 18.5600, lng: 73.7800 },
    mandals,
  };

  it('plans a ride to parking, and walks from there', () => {
    const plan = buildItinerary({ ...base, mode: 'two_wheeler' });
    expect(plan.stops.length).toBeGreaterThan(0);
    expect(plan.parking).not.toBeNull();
    expect(plan.parking!.rideMinutes).toBeGreaterThan(0);
  });

  it('never claims a two-wheeler is ridden between mandals', () => {
    // The bug this replaces: every leg was costed at riding speed through
    // peths the police have barricaded. Legs are now walking legs, so the
    // same stops take longer on a two-wheeler than they used to claim.
    const plan = buildItinerary({ ...base, mode: 'two_wheeler' });
    const walk = buildItinerary({ ...base, mode: 'walk' });

    const ridden = plan.stops.slice(1).reduce((s, x) => s + x.travelMinutesFromPrevious, 0);
    const walked = walk.stops.slice(1).reduce((s, x) => s + x.travelMinutesFromPrevious, 0);
    // Same kind of legs now: neither is faster per stop than the other by
    // a factor of the riding speed.
    if (plan.stops.length === walk.stops.length) {
      expect(ridden).toBeGreaterThan(walked * 0.5);
    }
  });

  it('leaves every other mode alone', () => {
    for (const mode of ['walk', 'metro'] as const) {
      expect(buildItinerary({ ...base, mode }).parking).toBeNull();
    }
  });

  it('counts the ride against the budget', () => {
    // A rider 20 km out should fit fewer mandals than one already in the
    // peths, because the ride is time like any other.
    const near = buildItinerary({ ...base, origin: { lat: 18.5170, lng: 73.8560 }, mode: 'two_wheeler' });
    const far = buildItinerary({ ...base, origin: { lat: 18.6800, lng: 73.7200 }, mode: 'two_wheeler' });
    expect(far.parking!.rideMinutes).toBeGreaterThan(near.parking!.rideMinutes);
    expect(far.stops.length).toBeLessThanOrEqual(near.stops.length);
  });
});
