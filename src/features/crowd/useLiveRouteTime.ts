'use client';

import { useMemo } from 'react';
import { useCrowdState } from './useCrowd';
import { dwellMinutes } from '@/services/itinerary';
import type { Ganpati } from '@/types/ganpati';

/**
 * A route's queuing time, re-derived against live reports.
 *
 * Curated route totals are computed at build time, so a route claimed the
 * same two hours whether its mandals were empty or an hour deep. Those
 * pages are prerendered and that is worth keeping, so the published figure
 * renders first and is corrected once the tracker has an opinion — rather
 * than making the page dynamic to say the same thing.
 *
 * This lives in one hook because the number appears twice on a route page:
 * once as the headline stat and once in the breakdown beneath it. Computing
 * it separately in each place is how a page ends up claiming "about 2 hr"
 * above a sentence that adds to 1 hr 50.
 *
 * `adjusted` is false when nobody has reported any stop, and the caller
 * then shows its published estimate untouched. No reports is not good
 * news, and quietly assuming short queues would be wrong in the expensive
 * direction.
 */
export function useLiveRouteTime(
  mandals: Ganpati[],
  publishedDarshanS: number
): { darshanS: number; adjusted: boolean } {
  const crowdState = useCrowdState();

  return useMemo(() => {
    let total = 0;
    let anyReported = false;

    for (const g of mandals) {
      const level = crowdState.byMandalId[g.id]?.status ?? null;
      if (level) anyReported = true;
      total += dwellMinutes(g, 'balanced', level) * 60;
    }

    return anyReported
      ? { darshanS: total, adjusted: true }
      : { darshanS: publishedDarshanS, adjusted: false };
  }, [mandals, crowdState, publishedDarshanS]);
}
