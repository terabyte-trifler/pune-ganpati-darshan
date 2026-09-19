/**
 * When a mandal is allowed to look red.
 *
 * ---------------------------------------------------------------------
 * Why this is per mandal and not one number.
 *
 * "Heavy" is a claim about a queue relative to the mandal it is at, and
 * the app was deciding it on one flat threshold for all twenty-nine.
 * Thirty minutes at Shanipar, whose curated peak is fifteen, is a bad
 * evening; thirty minutes at Dagdusheth, which runs to a hundred and
 * fifty, is a good one. The same badge was being used for both.
 *
 * What made it visible was the live snapshot: Dagdusheth showed Heavy
 * beside a reported wait of 25 minutes and Shanipar Heavy beside 20,
 * because the colour comes from the level votes and the minutes come from
 * the wait votes, and nothing stopped the two contradicting each other.
 *
 * Owner's decision, and the numbers are theirs rather than derived.
 * Shanipar was set to 30 and Dagdusheth to 35; Dagdusheth has since been
 * brought down to 30 as well, on the owner's call that half an hour in
 * that queue is heavy whatever the mandal's peak says. They were close
 * together on purpose and are now equal: this is a correction to a flat
 * rule, not a switch to scaling everything off each mandal's peak, which
 * would change what red means across the map, the planner and every
 * route card at once.
 *
 * Anything not listed keeps the flat threshold it already had, so adding
 * a mandal here is a deliberate act and the default is never a surprise.
 */

/** The flat threshold every unlisted mandal keeps. */
export const DEFAULT_RED_THRESHOLD_MIN = 30;

/**
 * Minimum reported wait, in minutes, before a mandal may show red.
 *
 * Keyed by slug rather than id: a slug survives a re-seed and can be read
 * in a diff, and this file is edited by a person deciding a product
 * question, not generated.
 *
 * Both entries now hold the same value as DEFAULT_RED_THRESHOLD_MIN, so
 * deleting them would not change a single reading today. They stay
 * because they are not the default — they are two decisions that happen
 * to agree with it, made about these two mandals by name. Whoever next
 * moves the default should have to move these deliberately rather than
 * carry them along by accident.
 */
export const RED_THRESHOLD_BY_SLUG: Readonly<Record<string, number>> = {
  'shanipar-mandal': 30,
  'dagdusheth-halwai-ganpati': 30,
};

export function redThresholdFor(slug: string | null | undefined): number {
  if (!slug) return DEFAULT_RED_THRESHOLD_MIN;
  return RED_THRESHOLD_BY_SLUG[slug] ?? DEFAULT_RED_THRESHOLD_MIN;
}
