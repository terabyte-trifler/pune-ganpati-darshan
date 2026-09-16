import { describe, it, expect } from 'vitest';
import {
  reportEligibility, REPORT_MAX_DISTANCE_M, WAIT_REPORT_MAX_DISTANCE_M,
  AT_MANDAL_RADIUS_M, AT_MANDAL_MAX_ACCURACY_M, GATE_MAX_ACCURACY_M,
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
    // Relative to the constant. Hard-coding 1.2 km made this a test of
    // nothing the moment the radius was tightened from 5 km to 1 km.
    const e = reportEligibility(ready(northOf(REPORT_MAX_DISTANCE_M / 2)), MANDAL);
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

  it('will not refuse on a fix too coarse to refuse with', () => {
    // The case the 1 km radius created. A phone standing AT the mandal on
    // a 1.5 km urban fix can compute as well outside the radius — so the
    // answer is "ask the GPS radio", not "you are too far".
    const e = reportEligibility(
      ready(northOf(REPORT_MAX_DISTANCE_M + 500), GATE_MAX_ACCURACY_M + 1),
      MANDAL
    );
    expect(e.kind).toBe('refining');
  });

  it('still refuses outright on a fix good enough to refuse with', () => {
    const e = reportEligibility(
      ready(northOf(REPORT_MAX_DISTANCE_M + 500), GATE_MAX_ACCURACY_M - 1),
      MANDAL
    );
    expect(e.kind).toBe('too-far');
  });

  it('keeps the leniency one-directional', () => {
    // Coarse and INSIDE the radius is still allowed outright: the safe
    // direction is admitting a borderline report, which is halved anyway,
    // rather than losing a real one.
    const e = reportEligibility(
      ready(northOf(REPORT_MAX_DISTANCE_M - 50), GATE_MAX_ACCURACY_M + 500),
      MANDAL
    );
    expect(e.kind).toBe('allowed');
  });

  it('never reports allowed without also deciding the weight', () => {
    // Guards a shape mistake: an 'allowed' result missing atMandal would
    // read as falsy and silently halve every report.
    for (const m of [0, 50, 99, 101, REPORT_MAX_DISTANCE_M / 2, REPORT_MAX_DISTANCE_M - 50]) {
      const e = reportEligibility(ready(northOf(m)), MANDAL);
      expect(e.kind).toBe('allowed');
      expect(typeof (e as { atMandal: boolean }).atMandal).toBe('boolean');
    }
  });
});

/**
 * The wait question carries its own radius.
 *
 * Wider than the colour vote, because it is asked on the way out rather
 * than at the gate — but it is a radius, where before there was none.
 */
describe('the wait report radius', () => {
  it('is wider than the vote, because the question is asked later', () => {
    expect(WAIT_REPORT_MAX_DISTANCE_M).toBeGreaterThan(REPORT_MAX_DISTANCE_M);
  });

  it('accepts somebody who has walked out of the vote radius', () => {
    const justOutsideTheVote = northOf(REPORT_MAX_DISTANCE_M + 200);
    expect(reportEligibility(ready(justOutsideTheVote), MANDAL).kind).toBe('too-far');
    expect(
      reportEligibility(ready(justOutsideTheVote), MANDAL, WAIT_REPORT_MAX_DISTANCE_M).kind
    ).toBe('allowed');
  });

  it('still refuses from beyond it', () => {
    const e = reportEligibility(
      ready(northOf(WAIT_REPORT_MAX_DISTANCE_M + 500)),
      MANDAL,
      WAIT_REPORT_MAX_DISTANCE_M
    );
    expect(e.kind).toBe('too-far');
  });

  /** The same escalation the vote makes: earn the refusal with a good fix. */
  it('refines rather than refusing on a fix too coarse to be sure', () => {
    const e = reportEligibility(
      ready(northOf(WAIT_REPORT_MAX_DISTANCE_M + 500), GATE_MAX_ACCURACY_M + 1),
      MANDAL,
      WAIT_REPORT_MAX_DISTANCE_M
    );
    expect(e.kind).toBe('refining');
  });

  it('leaves every existing caller on the vote radius', () => {
    const e = reportEligibility(ready(northOf(REPORT_MAX_DISTANCE_M + 200)), MANDAL);
    expect(e.kind).toBe('too-far');
  });
});
