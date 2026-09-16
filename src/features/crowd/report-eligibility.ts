import { haversine, type LatLng } from '@/lib/geo';
import type { GeoState } from '@/hooks/useGeolocation';

/**
 * Who may report a queue.
 *
 * A report is only worth something if the person making it can see the
 * queue. Reporting used to be open to anyone from anywhere, with distance
 * expressed as weight — a report from across town counted half. That is
 * fair arithmetic and a poor rule: half of a guess is still a guess, and
 * enough of them outvote the people at the gate.
 *
 * So there is now a radius, and outside it the controls are not offered.
 *
 * ---------------------------------------------------------------------
 * This is a UI rule, not enforcement, and the difference matters.
 *
 * The server is never sent a position — only a boolean saying whether the
 * client believed it was at the mandal — because a coordinate in a request
 * log is a record of where somebody stood, and the app promises not to
 * keep one. That promise is worth more than the small population of people
 * who would hand-craft a POST to fake a queue report.
 *
 * The rules that actually bound abuse are unchanged and live in the
 * database: one report per device per mandal per hour, a per-device hourly
 * cap, and a shared per-IP throttle. This radius removes the honest
 * mistake — someone rating a mandal they are nowhere near — which is the
 * common case, not the adversarial one.
 * ---------------------------------------------------------------------
 */

/**
 * How far away a report is still accepted.
 *
 * Tightened to 1 km on the owner's decision, from 5 km. 5 km covered most
 * of central Pune, so a report could come from somebody who saw the queue
 * on their way home an hour ago; 1 km is roughly the peth walk, which is
 * close enough that you could go and look.
 *
 * This number is load-bearing for GPS as well as for trust — see
 * GATE_MAX_ACCURACY_M. A 5 km question can be settled by a coarse
 * wifi/cell fix; a 1 km question sometimes cannot.
 */
export const REPORT_MAX_DISTANCE_M = 1_000;

/**
 * A fix coarser than this cannot decide a 1 km question.
 *
 * Acquisition asks for a coarse fix first, because it returns in under a
 * second where the GPS radio takes seconds — and at 5 km that was free,
 * since a fix good to 2 km still answers a 5 km question. At 1 km it is
 * not free: a phone standing AT the mandal on a 1.5 km fix can compute as
 * 1.2 km away and be refused.
 *
 * So when the fix is this coarse AND the raw distance would refuse, the
 * answer is not "too far" — it is "ask the GPS radio and decide properly".
 * The refusal has to be earned by a fix that can support it.
 */
export const GATE_MAX_ACCURACY_M = 250;

/** Inside this you are AT the mandal, and the report carries full weight. */
export const AT_MANDAL_RADIUS_M = 100;

/**
 * A fix coarser than this cannot support the stronger claim.
 *
 * It gates only `atMandal`, never eligibility. A coarse fix should cost
 * someone the extra weight, not their ability to report at all.
 */
export const AT_MANDAL_MAX_ACCURACY_M = 100;

export type ReportEligibility =
  /** Close enough. `atMandal` decides the weight the report carries. */
  | { kind: 'allowed'; atMandal: boolean; distanceM: number }
  /** A fix is being acquired; show the wait rather than the refusal. */
  | { kind: 'locating' }
  /** Never asked, or asked and not yet answered. Offer the request. */
  | { kind: 'needs-location' }
  /** Refused or broken. Say what it costs and leave it alone. */
  | { kind: 'no-location'; reason: 'denied' | 'unavailable' }
  /** Located, and genuinely too far. */
  | { kind: 'too-far'; distanceM: number }
  /**
   * Too far on a fix too coarse to be sure. Ask for a precise one rather
   * than refusing somebody who may be standing right there.
   */
  | { kind: 'refining'; distanceM: number }
  /** The mandal has no coordinate, so no distance can be computed. */
  | { kind: 'unknown-mandal' };

/**
 * Decides eligibility from a geolocation state and the mandal's position.
 *
 * Pure, and separate from the component, because this is the rule that
 * decides whose reports the whole tracker is built from — it should be
 * pinned by tests rather than inferred from a rendered button.
 *
 * Distance is compared raw, without widening it by the fix's accuracy,
 * and that leniency runs one way only: a coarse fix inside the radius is
 * accepted, while a coarse fix outside it is sent to refine rather than
 * refused. Blocking a real reporter during the festival costs more than
 * admitting a borderline one, whose report is halved anyway for not being
 * at the mandal.
 */
export function reportEligibility(
  geo: GeoState,
  mandal: LatLng | undefined
): ReportEligibility {
  if (!mandal) return { kind: 'unknown-mandal' };

  switch (geo.status) {
    case 'idle':
      return { kind: 'needs-location' };
    case 'locating':
      return { kind: 'locating' };
    case 'denied':
      return { kind: 'no-location', reason: 'denied' };
    case 'unavailable':
      return { kind: 'no-location', reason: 'unavailable' };
    case 'ready': {
      const distanceM = haversine(geo.position, mandal);
      if (distanceM > REPORT_MAX_DISTANCE_M) {
        // Refuse only on a fix good enough to refuse on. Note the
        // asymmetry, and that it is deliberate: a coarse fix INSIDE the
        // radius is still allowed, because the lenient direction is the
        // safe one — a borderline report is halved for not being at the
        // gate, while a wrongly refused one is lost.
        return geo.accuracyM > GATE_MAX_ACCURACY_M
          ? { kind: 'refining', distanceM }
          : { kind: 'too-far', distanceM };
      }
      return {
        kind: 'allowed',
        distanceM,
        atMandal:
          geo.accuracyM <= AT_MANDAL_MAX_ACCURACY_M &&
          distanceM <= AT_MANDAL_RADIUS_M,
      };
    }
  }
}
