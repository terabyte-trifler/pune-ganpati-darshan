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
 * Widened from 1.5 km to 5 km on the owner's decision. The trade is real
 * and worth stating: 5 km covers the whole peth core and most of central
 * Pune, so a report can now come from someone who saw the queue an hour
 * ago on their way home rather than from someone who can see it now.
 *
 * Two things already contain that. Anything beyond AT_MANDAL_RADIUS_M
 * counts at OFFSITE_WEIGHT, half of a report made at the gate, so the
 * people actually there still outweigh the people who were. And a status
 * needs two devices agreeing inside ninety minutes, which a single distant
 * guess cannot produce on its own.
 */
export const REPORT_MAX_DISTANCE_M = 5_000;

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
  /** The mandal has no coordinate, so no distance can be computed. */
  | { kind: 'unknown-mandal' };

/**
 * Decides eligibility from a geolocation state and the mandal's position.
 *
 * Pure, and separate from the component, because this is the rule that
 * decides whose reports the whole tracker is built from — it should be
 * pinned by tests rather than inferred from a rendered button.
 *
 * Distance is compared raw, without widening it by the fix's accuracy.
 * That is deliberate and it is the lenient direction: someone genuinely
 * 1.4 km away on a poor urban fix keeps their report, and someone 1.6 km
 * away is refused. Blocking a real reporter during the festival costs more
 * than admitting a borderline one, whose report is halved anyway for not
 * being at the mandal.
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
      if (distanceM > REPORT_MAX_DISTANCE_M) return { kind: 'too-far', distanceM };
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
