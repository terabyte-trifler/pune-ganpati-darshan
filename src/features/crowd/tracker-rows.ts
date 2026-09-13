import type { CrowdLevel } from '@/types/crowd';
import { SOURCE_RANK, type CrowdSource } from './crowd-display';

/**
 * The order the Live Crowd Tracker lists mandals in.
 *
 * Pulled out of the component because it carries the one rule the whole
 * feature depends on, and a rule that lives inside a JSX file is a rule
 * that gets quietly re-sorted: **provenance outranks level, always.**
 *
 * Three tiers, in strict order:
 *
 *   reported   somebody said something. Any level, green amber or red.
 *   observed   nobody said anything, but enough devices were seen
 *              dwelling that the app is willing to say something.
 *   estimated  nobody said anything and nothing was seen; the clock.
 *
 * A heavy queue somebody is standing in front of is worth more than a
 * short one a model has an opinion about, so a red report is listed above
 * a green estimate. The tracker exists to say what is happening now; the
 * weaker tiers exist to fill the silence, and each only ever gets the
 * rows the tier above could not fill.
 */

/** Best queue first, within a group. Every level is listable. */
export const LEVEL_ORDER: CrowdLevel[] = ['short', 'moving', 'long'];

export interface Rankable {
  level: CrowdLevel;
  source: CrowdSource;
  /** Metres from the reader, or null when there is no position. */
  distanceM: number | null;
  /** Editorial weight, the tie-break when distance is unknown. */
  prominence: number;
}

function byQueue(a: Rankable, b: Rankable): number {
  const byLevel = LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level);
  if (byLevel !== 0) return byLevel;
  if (a.distanceM !== null && b.distanceM !== null) return a.distanceM - b.distanceM;
  return b.prominence - a.prominence;
}

/**
 * Each tier sorted, then concatenated in tier order.
 *
 * Separate sorted groups rather than one comparator with provenance as
 * its first key. Same result, but it cannot be undone by someone adding a
 * level comparison at the top of a comparator.
 */
export function rankTrackerRows<T extends Rankable>(all: T[], max: number): T[] {
  const tiers: CrowdSource[] = ['reported', 'observed', 'estimated'];
  return tiers
    .sort((a, b) => SOURCE_RANK[a] - SOURCE_RANK[b])
    .flatMap((tier) => all.filter((r) => r.source === tier).sort(byQueue))
    .slice(0, max);
}
