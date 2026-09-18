/**
 * Mahaprasad, as announced by the mandals.
 *
 * ---------------------------------------------------------------------
 * Where this came from, and what it therefore is.
 *
 * Supplied by the owner from what the mandals themselves have announced.
 * Nothing here is inferred or assumed: a mandal appears only because
 * somebody was told it serves mahaprasad, and a time appears only because
 * somebody was told that time.
 *
 * That provenance is the whole value of the list and it sets the limits.
 * This is an announcement, not an observation. It does not say whether a
 * queue has formed, whether the food has run out, or whether today is
 * different from yesterday. Mahaprasad ends when it ends, and the section
 * says so rather than implying a guarantee.
 *
 * ---------------------------------------------------------------------
 * STANDALONE, and deliberately not joined to the catalogue.
 *
 * The first version keyed each entry to a mandal slug, which meant a
 * mandal had to be added to the catalogue before its mahaprasad could be
 * listed. That is the wrong dependency: serving food is not the same
 * claim as being a darshan destination, and a mandal that feeds people at
 * 9pm does not thereby need a page, a darshan time, a crowd tracker and a
 * dwell zone. Owner's decision — mahaprasad carries its own name and
 * coordinate, and the card offers directions to it.
 *
 * `servesAt` is null where the mandal serves but has not said when. That
 * is a real state and NOT the same as "no mahaprasad" — the card prints
 * "Timings not announced" from the null. It must never be given a
 * placeholder: a made-up hour sends somebody across the peths to a closed
 * counter.
 *
 * Free text rather than a time, because mandals announce it in their own
 * terms — "after the noon aarti", "7 pm to 11 pm", "all day on Anant
 * Chaturdashi". Forcing that into a clock loses the meaning.
 */

export interface MahaprasadEntry {
  readonly name: string;
  readonly nameMr?: string | null;
  /** Where it is served. Directions are built from this. */
  readonly at: { readonly lat: number; readonly lng: number };
  /** When, in the mandal's own words, or null if they have not said. */
  readonly servesAt: string | null;
  /** Which days, or null if not stated. */
  readonly days: string | null;
  /** Anything else the mandal said that a visitor would want to know. */
  readonly note: string | null;
}

export const MAHAPRASAD: readonly MahaprasadEntry[] = [
  {
    name: 'Nav Kiran Tarun Mandal',
    at: { lat: 18.511004564636526, lng: 73.86894440717653 },
    // As announced: 7pm to 11pm, every day. Written the way a visitor
    // reads a clock rather than as 19:00–23:00, because this field
    // carries the announcement and that is how it was made.
    servesAt: '7 pm to 11 pm',
    days: 'Every day',
    note: null,
  },
];

/**
 * Walking directions to where it is served.
 *
 * Walking, not driving: every entry so far is inside the peth core, which
 * is closed to traffic during the festival — and the same reasoning
 * DirectionsButton applies for a core-area mandal.
 */
export function mahaprasadDirections(entry: MahaprasadEntry): string {
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set('destination', `${entry.at.lat},${entry.at.lng}`);
  url.searchParams.set('travelmode', 'walking');
  return url.toString();
}
