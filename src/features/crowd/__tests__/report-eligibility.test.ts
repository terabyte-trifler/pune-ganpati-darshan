import { describe, it, expect } from 'vitest';
import {
  reportEligibility, REPORT_MAX_DISTANCE_M,
  AT_MANDAL_RADIUS_M, AT_MANDAL_MAX_ACCURACY_M,
} from '@/features/crowd/report-eligibility';
import type { GeoState } from '@/hooks/useGeolocation';

/**
 * Who may report a queue.
 *
 * This decides what the whole tracker is built from, so it is pinned here
 * rather than inferred from whether a button rendered.
 */

/** Dagdusheth, from the catalogue. */
const MANDAL = { lat: 18.51514, lng: 73.856379 };

/** Roughly metres north, which is precise enough at this latitude. */
const northOf = (m: number) => ({ lat: MANDAL.lat + m / 111_320, lng: MANDAL.lng });
const ready = (position: { lat: number; lng: number }, accuracyM = 20): GeoState =>
  ({ status: 'ready', position, accuracyM });

describe('report eligibility', () => {
  it('allows a report from the gate, at full weight', () => {
    const e = reportEligibility(ready(MANDAL), MANDAL);
    expect(e.kind).toBe('allowed');
    expect(e.kind === 'allowed' && e.atMandal).toBe(true);
  });

  it('allows a report from anywhere inside the radius, at half weight', () => {
    const e = reportEligibility(ready(northOf(1_200)), MANDAL);
    expect(e.kind).toBe('allowed');
    // Inside the report radius but outside 100 m: worth having, not as much.
    expect(e.kind === 'allowed' && e.atMandal).toBe(false);
  });

  it('refuses a report from beyond the radius', () => {
    // Relative to the constant, so widening the radius cannot silently
    // turn this into a test of nothing.
    const e = reportEligibility(ready(northOf(REPORT_MAX_DISTANCE_M + 100)), MANDAL);
    expect(e.kind).toBe('too-far');
    expect(e.kind === 'too-far' && Math.round(e.distanceM)).toBeGreaterThan(REPORT_MAX_DISTANCE_M);
  });

  it('draws the line at the stated radius, not near it', () => {
    // A boundary that drifts is a rule nobody can explain to a user.
    expect(reportEligibility(ready(northOf(REPORT_MAX_DISTANCE_M - 20)), MANDAL).kind)
      .toBe('allowed');
    expect(reportEligibility(ready(northOf(REPORT_MAX_DISTANCE_M + 20)), MANDAL).kind)
      .toBe('too-far');
  });

  it('costs a coarse fix the extra weight, never the report', () => {
    // Standing at the mandal with a poor urban fix. The stronger claim is
    // refused; the report is not — blocking a real reporter mid-festival
    // is worse than accepting one at half weight.
    const e = reportEligibility(ready(MANDAL, AT_MANDAL_MAX_ACCURACY_M + 50), MANDAL);
    expect(e.kind).toBe('allowed');
    expect(e.kind === 'allowed' && e.atMandal).toBe(false);
  });

  it('claims at-mandal only inside the tighter radius', () => {
    expect(
      reportEligibility(ready(northOf(AT_MANDAL_RADIUS_M - 10)), MANDAL)
    ).toMatchObject({ kind: 'allowed', atMandal: true });
    expect(
      reportEligibility(ready(northOf(AT_MANDAL_RADIUS_M + 10)), MANDAL)
    ).toMatchObject({ kind: 'allowed', atMandal: false });
  });

  it('distinguishes never-asked from refused', () => {
    // One of these is worth offering a button for and the other is not.
    expect(reportEligibility({ status: 'idle' }, MANDAL).kind).toBe('needs-location');
    expect(reportEligibility({ status: 'denied' }, MANDAL)).toMatchObject({
      kind: 'no-location', reason: 'denied',
    });
    expect(reportEligibility({ status: 'unavailable' }, MANDAL)).toMatchObject({
      kind: 'no-location', reason: 'unavailable',
    });
    expect(reportEligibility({ status: 'locating' }, MANDAL).kind).toBe('locating');
  });

  it('refuses when the mandal has no position of its own', () => {
    // Nothing can be decided, so nothing is claimed.
    expect(reportEligibility(ready(MANDAL), undefined).kind).toBe('unknown-mandal');
  });

  it('never reports allowed without also deciding the weight', () => {
    // Guards a shape mistake: an 'allowed' result missing atMandal would
    // read as falsy and silently halve every report.
    for (const m of [0, 50, 99, 101, 500, 1_499]) {
      const e = reportEligibility(ready(northOf(m)), MANDAL);
      expect(e.kind).toBe('allowed');
      expect(typeof (e as { atMandal: boolean }).atMandal).toBe('boolean');
    }
  });
});
