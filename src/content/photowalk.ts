/**
 * The Ganpati photowalk, as published by Photowalks in Pune.
 *
 * ---------------------------------------------------------------------
 * Where this came from, and what it therefore is.
 *
 * Taken from pwip.in's own listing for the walk, which is the page this
 * card sends people to. Registration, spot count and any change of plan
 * all live there; nothing about the walk is administered by this app, so
 * this file holds the least it can and links out for the rest.
 *
 * `time` is null on purpose. pwip.in says "To be announced", and that is
 * the honest state of it — a start time invented here to make the card
 * look complete would send people to Shivaji Nagar at the wrong hour.
 * The card renders the words "Time to be announced" from this null; it
 * does not guess, and it must not be given a placeholder.
 *
 * The meeting point is Shivaji Nagar. pwip.in's listing says "Old city
 * mandals", which describes the walk rather than where it starts; the
 * specific point came from the organiser direct. If the two ever
 * disagree again, pwip.in is the page the walkers will be reading on the
 * morning, so it wins — update this file to match rather than the other
 * way round.
 *
 * The walk is free and open to any camera, which is worth stating on the
 * card because both are the first thing people ask.
 */

export interface Photowalk {
  /** Event date, IST, as YYYY-MM-DD. */
  readonly date: string;
  /** Human label for the day, matching how pwip.in writes it. */
  readonly dateLabel: string;
  /** Start time, or null while pwip.in still says "to be announced". */
  readonly time: string | null;
  readonly meetingPoint: string;
  readonly title: string;
  readonly blurb: string;
  readonly registerUrl: string;
  readonly cost: string;
}

export const PHOTOWALK: Photowalk = {
  date: '2026-09-19',
  dateLabel: 'Saturday 19 September',
  time: null,
  meetingPoint: 'Shivaji Nagar',
  title: 'Ganpati photowalk',
  blurb:
    'The mandals through the old peths in festival week, photographed in '
    + 'the middle of the crowd.',
  registerUrl: 'https://pwip.in',
  cost: 'Free · all cameras welcome',
};

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Is the walk still ahead of us?
 *
 * Compared as IST days, not instants, so the card stays up for the whole
 * of the 19th for someone standing in Pune — including at 23:00, when a
 * UTC comparison would already have called it past. It disappears on the
 * 20th rather than lingering as an advert for a walk that has happened.
 */
export function photowalkIsUpcoming(
  walk: Photowalk = PHOTOWALK,
  now: Date = new Date()
): boolean {
  const today = Math.floor((now.getTime() + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS;
  const eventDay = Date.parse(`${walk.date}T00:00:00.000Z`) - IST_OFFSET_MS;
  return today <= eventDay;
}
