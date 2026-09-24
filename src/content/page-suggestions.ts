/**
 * Pages the search box should be able to find.
 *
 * ---------------------------------------------------------------------
 * Why this exists: it was measured, not guessed.
 *
 * 788 of 2,326 searches on 22 September returned nothing — a third of
 * them. Reading the failures, a good share were not misspelled mandals at
 * all but people asking the search box for a part of the site: "visarjan"
 * on the eve of the procession, "parking" while looking for somewhere to
 * leave a two-wheeler, area names the catalogue has no mandal in.
 *
 * Every one of those got "No Ganpati found", which is true and useless —
 * the app had the answer on another page the whole time.
 *
 * Deliberately not a route table. Only pages a visitor would plausibly
 * type a word for are here; a suggestion for something nobody searches is
 * noise in the one place that must stay fast to read.
 */

export interface PageSuggestion {
  href: string;
  title: string;
  /** Why this page answers the query, in a few words. */
  blurb: string;
  /** Lowercase terms, matched as prefixes against each word typed. */
  terms: string[];
}

export const PAGE_SUGGESTIONS: PageSuggestion[] = [
  {
    href: '/visarjan',
    title: 'Visarjan day',
    blurb: 'The procession route, the timings, and the roads that close',
    terms: [
      'visarjan', 'visarjn', 'immersion', 'miravnuk', 'miravnook', 'mirvnuk',
      'procession', 'anant', 'chaturdashi', 'विसर्जन', 'मिरवणूक',
    ],
  },
  {
    href: '/parking',
    title: 'Parking & road closures',
    blurb: 'Where the police say you can park, and what is shut after 17:00',
    terms: ['parking', 'park', 'vehicle', 'car', 'bike', 'twowheeler', 'closure', 'closed', 'पार्किंग'],
  },
  {
    href: '/map',
    title: 'Map',
    blurb: 'Every mandal, with live queues and the way in',
    terms: ['map', 'nakasha', 'नकाशा', 'nearby', 'near'],
  },
  {
    href: '/start',
    title: 'Build my route',
    blurb: 'A walkable darshan for the time you have',
    terms: ['route', 'plan', 'walk', 'itinerary', 'darshan', 'trail'],
  },
  {
    href: '/routes',
    title: 'Curated walks',
    blurb: 'Ready-made darshan routes through the peths',
    terms: ['routes', 'walks', 'curated', 'trail', 'trails'],
  },
];

/**
 * Pages matching a query, best first.
 *
 * Matches a whole typed word against the start of a term, so "park"
 * finds parking and "vis" finds visarjan, while a stray letter inside a
 * mandal's name does not drag a page into a search that is going fine.
 */
export function suggestPages(rawQuery: string, limit = 2): PageSuggestion[] {
  const words = rawQuery.toLowerCase().trim().split(/\s+/).filter((w) => w.length >= 3);
  if (words.length === 0) return [];

  return PAGE_SUGGESTIONS.filter((p) =>
    words.some((w) => p.terms.some((t) => t.startsWith(w) || w.startsWith(t)))
  ).slice(0, limit);
}
