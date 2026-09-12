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
 *   unconfirmed   One device reported. No colour; the prior speaks
 *                 alongside "Not confirmed yet".
 *   prior         Nobody reported. Lane B speaks: "Usually …".
 *   silent        Nobody reported and the prior declines — before or
 *                 after the festival, or visarjan afternoon.
 *
 * Where a colour appears differs by lane, and the admin should know it:
 * a measured colour shows on the map pin, the explore badge and the
 * panel; a prior shows ONLY inside the mandal page's panel, hollow and
 * labelled "Usually", never on a pin or a badge.
 */

export type Decider = 'measured' | 'dwell-tipped' | 'unconfirmed' | 'prior' | 'silent';

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
      decider: humanOnly.status !== live.status ? 'dwell-tipped' : 'measured',
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
