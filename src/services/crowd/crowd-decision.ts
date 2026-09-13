import type { CrowdLevel, CrowdStatus } from '@/types/crowd';
import type { CrowdExpectation } from './crowd-prior';

/**
 * Which rule decided what a visitor sees for one mandal.
 *
 * Pure, so the admin page and the tests share one answer. It takes the
 * live status (dwell included when switched on), the same status computed
 * from human reports alone, and the prior — and names the lane.
 *
 *   measured      Lane A. Two or more devices agreed; dwell either had no
 *                 samples or did not change the winner.
 *   dwell-tipped  Lane A, but the humans alone would have produced a
 *                 different colour. Dwell decided it.
 *   dwell-only    Nobody reported. Enough distinct devices were seen
 *                 dwelling that the mandal takes a colour anyway, shown
 *                 as "Observed" and half-filled, never as a report.
 *   unconfirmed   One device reported. No colour; the prior speaks
 *                 alongside "Not confirmed yet".
 *   prior         Nobody reported. Lane B speaks: "Usually …".
 *   silent        Nobody reported and the prior declines — before or
 *                 after the festival, or visarjan afternoon.
 *
 * Where a colour appears differs by lane, and the admin should know it:
 * a measured colour shows filled on the map pin, the explore badge and
 * the panel; a dwell-only colour shows in the same places half-filled and
 * labelled "Observed"; the prior shows everywhere too, but hollow and
 * labelled "Estimated", and it is the only one of the three that is not a
 * measurement of anything.
 */

export type Decider =
  | 'measured' | 'dwell-tipped' | 'dwell-only' | 'unconfirmed' | 'prior' | 'silent';

export interface Decision {
  decider: Decider;
  /** The level a visitor is shown, from whichever lane decided. */
  level: CrowdLevel | null;
  /** True when that level is a filled colour on pins and badges. */
  onMapAndBadges: boolean;
  /** What the humans alone would have produced, for comparison. */
  humanOnlyLevel: CrowdLevel | null;
}

export function decide(
  live: CrowdStatus,
  humanOnly: CrowdStatus,
  prior: CrowdExpectation | null
): Decision {
  if (live.status) {
    return {
      decider:
        live.source === 'observed'
          ? 'dwell-only'
          : humanOnly.status !== live.status
            ? 'dwell-tipped'
            : 'measured',
      level: live.status,
      onMapAndBadges: true,
      humanOnlyLevel: humanOnly.status,
    };
  }
  if (live.reportCount > 0) {
    return { decider: 'unconfirmed', level: prior?.level ?? null, onMapAndBadges: false, humanOnlyLevel: null };
  }
  if (prior) {
    return { decider: 'prior', level: prior.level, onMapAndBadges: false, humanOnlyLevel: null };
  }
  return { decider: 'silent', level: null, onMapAndBadges: false, humanOnlyLevel: null };
}
