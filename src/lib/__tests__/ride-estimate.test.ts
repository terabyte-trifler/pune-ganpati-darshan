import { describe, it, expect } from 'vitest';
import { estimateRideSeconds, rideSpeedMps, haversine, estimateDurationSeconds } from '@/lib/geo';

/**
 * Riding in to the peths.
 *
 * Reported from use: two-wheeler plans said 26 minutes for a short hop
 * and two hours from Hinjewadi. Both came from applying the peth walking
 * detour factor and a flat 13 km/h to a ride that is mostly arterial.
 *
 * These tests are sanity bounds rather than precise claims — the numbers
 * are judgements until someone times a real ride — but they pin the
 * shape: plausible for a scooter in festival traffic, and never again a
 * two-hour estimate for a fifteen-kilometre ride.
 */

const PETHS = { lat: 18.5150, lng: 73.8530 };
const PLACES = {
  Hinjewadi: { lat: 18.5913, lng: 73.7389 },
  Kothrud: { lat: 18.5074, lng: 73.8077 },
  Baner: { lat: 18.5590, lng: 73.7868 },
  Swargate: { lat: 18.5010, lng: 73.8580 },
};

const minutes = (from: { lat: number; lng: number }) =>
  estimateRideSeconds(haversine(from, PETHS)) / 60;

describe('the ride estimate', () => {
  it('is plausible from the places people actually ride in from', () => {
    // Generous bands on purpose: the claim is "a scooter could do this",
    // not a promise to the minute.
    expect(minutes(PLACES.Hinjewadi)).toBeGreaterThan(35);
    expect(minutes(PLACES.Hinjewadi)).toBeLessThan(75);

    expect(minutes(PLACES.Kothrud)).toBeGreaterThan(12);
    expect(minutes(PLACES.Kothrud)).toBeLessThan(30);

    expect(minutes(PLACES.Baner)).toBeGreaterThan(20);
    expect(minutes(PLACES.Baner)).toBeLessThan(45);

    // Already at the edge of the peths: minutes, not half an hour.
    expect(minutes(PLACES.Swargate)).toBeLessThan(15);
  });

  it('is much faster than the old walking-detour model', () => {
    // The regression this replaces, stated as a number: the old model
    // put Hinjewadi near two hours.
    const old = estimateDurationSeconds(haversine(PLACES.Hinjewadi, PETHS), 'two_wheeler') / 60;
    expect(old).toBeGreaterThan(100);
    expect(minutes(PLACES.Hinjewadi)).toBeLessThan(old * 0.6);
  });

  it('rides a longer distance faster per kilometre', () => {
    // A short hop is all festival traffic; a long ride is mostly
    // arterial. One flat speed cannot describe both.
    expect(rideSpeedMps(500)).toBeLessThan(rideSpeedMps(12_000));
    expect(rideSpeedMps(500)).toBeCloseTo(rideSpeedMps(1_000), 6);
    expect(rideSpeedMps(12_000)).toBeCloseTo(rideSpeedMps(40_000), 6);
  });

  it('never goes backwards as the distance grows', () => {
    // A ramp done carelessly can make a longer ride take less time.
    let previous = 0;
    for (let km = 0.5; km <= 30; km += 0.5) {
      const s = estimateRideSeconds(km * 1000);
      expect(s, `${km} km`).toBeGreaterThan(previous);
      previous = s;
    }
  });
});
