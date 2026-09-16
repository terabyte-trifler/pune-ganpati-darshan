import { describe, it, expect } from 'vitest';
import { METRO_STATIONS, LINE_ORDER } from '@/lib/metro';
import { haversine } from '@/lib/geo';

/**
 * A metro station in the wrong place sends somebody to the wrong platform.
 *
 * Reported from Civil Court: the app told a rider standing there to board
 * from Mangalwar Peth. Civil Court was 529 m from where it stands, which
 * put the two stations almost equidistant, and the nearest-station search
 * picked the other one. Twenty of twenty-nine stations were over 150 m
 * out, several over half a kilometre, the worst by a kilometre.
 *
 * Coordinates cannot be unit-tested against reality, but a line's stations
 * are in a known order, and a station that has drifted usually breaks it.
 * That is what these check: the shape of each line, not the truth of any
 * one point.
 */
describe('metro station coordinates', () => {
  const byId = new Map(METRO_STATIONS.map((s) => [s.id, s]));

  it('has every station listed in a line order', () => {
    for (const [line, ids] of Object.entries(LINE_ORDER)) {
      for (const id of ids) {
        expect(byId.get(id), `${line} lists ${id}, which is not a station`).toBeDefined();
      }
    }
  });

  /**
   * Consecutive stations sit between 400 m and 3 km apart on these lines.
   * Anything outside that is either a typo or a station in the wrong city.
   */
  it('spaces consecutive stations plausibly', () => {
    for (const [line, ids] of Object.entries(LINE_ORDER)) {
      for (let i = 1; i < ids.length; i++) {
        const a = byId.get(ids[i - 1])!;
        const b = byId.get(ids[i])!;
        const d = haversine({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });
        expect(d, `${line}: ${a.name} to ${b.name} is ${Math.round(d)} m`).toBeGreaterThan(400);
        expect(d, `${line}: ${a.name} to ${b.name} is ${Math.round(d)} m`).toBeLessThan(3000);
      }
    }
  });

  /**
   * A line runs broadly one way. Each station should be further along it
   * than the last — checked on whichever axis the line actually travels,
   * so an east-west line is judged on longitude and not on latitude.
   */
  it('keeps each line running in one direction', () => {
    for (const [line, ids] of Object.entries(LINE_ORDER)) {
      const pts = ids.map((id) => byId.get(id)!);
      const dLat = Math.abs(pts[pts.length - 1].lat - pts[0].lat);
      const dLng = Math.abs(pts[pts.length - 1].lng - pts[0].lng);
      const axis: 'lat' | 'lng' = dLat > dLng ? 'lat' : 'lng';
      const sign = Math.sign(pts[pts.length - 1][axis] - pts[0][axis]);
      // One reversal is tolerated — a line can kink — two is a drift.
      let backwards = 0;
      for (let i = 1; i < pts.length; i++) {
        if (Math.sign(pts[i][axis] - pts[i - 1][axis]) !== sign) {
          backwards++;
        }
      }
      expect(backwards, `${line} doubles back ${backwards} times along ${axis}`).toBeLessThanOrEqual(1);
    }
  });

  it('puts every station inside greater Pune', () => {
    for (const s of METRO_STATIONS) {
      expect(s.lat, s.name).toBeGreaterThan(18.4);
      expect(s.lat, s.name).toBeLessThan(18.75);
      expect(s.lng, s.name).toBeGreaterThan(73.7);
      expect(s.lng, s.name).toBeLessThan(74.0);
    }
  });
});
