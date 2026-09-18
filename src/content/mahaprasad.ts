import type { Ganpati } from '@/types/ganpati';

/**
 * Mahaprasad, as told to us by the mandals.
 *
 * ---------------------------------------------------------------------
 * Where this came from, and what it therefore is.
 *
 * Supplied by the owner from what the mandals themselves have announced.
 * Nothing here is inferred, scraped or assumed: a mandal appears in this
 * list only because somebody was told it serves mahaprasad, and a time
 * appears only because somebody was told that time.
 *
 * That provenance is the whole value of the list and it sets the limits
 * too. This is an announcement, not an observation. It does not say
 * whether a queue has formed, whether the food has run out, or whether
 * today is different from yesterday. Mahaprasad ends when it ends, and
 * the page says so rather than implying a guarantee.
 *
 * `servesAt` is null where the mandal serves but has not said when. That
 * is a real and common state, and it is NOT the same as "no mahaprasad" —
 * the card prints "timings not announced" from the null and does not
 * guess. It must never be given a placeholder: a made-up hour sends
 * somebody across the peths to a closed counter.
 *
 * `note` carries whatever the mandal actually said, in their words where
 * possible. Anything the app adds on top belongs in the component, not
 * here, so a reader can always tell the announcement from the framing.
 *
 * Joined to the catalogue by slug. A slug that does not exist is a build
 * failure rather than a silently missing card — see the test.
 */

export interface MahaprasadEntry {
  /** Catalogue slug. Must match a published mandal. */
  readonly slug: string;
  /**
   * When it is served, or null if the mandal has not said.
   *
   * Free text rather than a time, because mandals announce it in their
   * own terms — "after the noon aarti", "12:00 to 15:00", "all day on
   * Anant Chaturdashi". Forcing that into a clock loses the meaning.
   */
  readonly servesAt: string | null;
  /** Which days, or null for every day of the festival. */
  readonly days: string | null;
  /** Whatever the mandal said that a visitor would want to know. */
  readonly note: string | null;
}

/**
 * The section renders nothing at all while this is empty — deliberately.
 * A mahaprasad page with invented timings is worse than no page: the cost
 * of being wrong is somebody elderly walking to a counter that is not
 * serving. Add a mandal here only when somebody has actually been told.
 */
export const MAHAPRASAD: readonly MahaprasadEntry[] = [
  {
    slug: 'nav-kiran-tarun-mandal',
    // As announced: 7pm to 11pm, every day. Written the way a visitor
    // reads a clock rather than as 19:00–23:00, because this field
    // carries the announcement and that is how it was made.
    servesAt: '7 pm to 11 pm',
    days: 'Every day',
    note: null,
  },
];

/** Entries joined to the catalogue, in catalogue order. Unknown slugs drop. */
export function mahaprasadFor(
  ganpatis: Ganpati[]
): Array<{ ganpati: Ganpati; entry: MahaprasadEntry }> {
  const bySlug = new Map(ganpatis.map((g) => [g.slug, g]));
  return MAHAPRASAD.flatMap((entry) => {
    const ganpati = bySlug.get(entry.slug);
    return ganpati ? [{ ganpati, entry }] : [];
  });
}
