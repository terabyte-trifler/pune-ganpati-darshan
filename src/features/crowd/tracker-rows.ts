import type { CrowdLevel } from '@/types/crowd';

/**
 * The order the Live Crowd Tracker lists mandals in.
 *
 * Pulled out of the component because it carries the one rule the whole
 * feature depends on, and a rule that lives inside a JSX file is a rule
 * that gets quietly re-sorted: **anything a person reported outranks
 * anything the app estimated, at any level.**
 *
 * A heavy queue somebody is standing in front of is worth more than a
 * short one a model has an opinion about, so a red report is listed above
 * a green estimate. The tracker exists to say what is happening now; the
 * prior exists to fill the silence, and it only ever gets the rows
 * nothing reported could fill.
 */

/** Best queue first, within a group. Every level is listable. */
export const LEVEL_ORDER: CrowdLevel[] = ['short', 'moving', 'long'];

export interface Rankable {
  level: CrowdLevel;
  /** True when this came from the prior rather than from people. */
  estimated: boolean;
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
 * Reports first — all of them, in queue order — then estimates.
 *
 * Two sorted groups concatenated rather than one sort with provenance as
 * the first key. Same result, but it cannot be undone by someone adding a
 * level comparison at the top of a comparator.
 */
export function rankTrackerRows<T extends Rankable>(all: T[], max: number): T[] {
  const measured = all.filter((r) => !r.estimated).sort(byQueue);
  const estimated = all.filter((r) => r.estimated).sort(byQueue);
  return [...measured, ...estimated].slice(0, max);
}
