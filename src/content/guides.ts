/**
 * Long-form guides.
 *
 * These exist because the catalogue answers "where is it" and nothing
 * answers "what is this". Searches like *what is manache paach* or *which
 * mandals are famous in Pune* currently land on travel-agency listicles
 * and, genuinely, on e-commerce blogs selling lights — none of which have
 * a map, coordinates, or a single live figure.
 *
 * ---------------------------------------------------------------------
 * The rule for everything in this file.
 *
 * A guide may only state what the catalogue already states, or what is
 * documented well enough to cite. It must never invent a date, a timing,
 * a founder or a route. The catalogue's own descriptions are the
 * canonical source here — they are owner-verified, and a guide that
 * contradicts the mandal page it links to is worse than no guide.
 *
 * Anything not yet verified belongs in `unverified`, which renders
 * visibly as an open question rather than quietly as a fact.
 */

export type GuideSection = {
  heading: string;
  /** Paragraphs. Plain strings — no markup, no HTML injection surface. */
  body: string[];
  /** Mandal slugs to link inline beneath the section. */
  mandals?: string[];
};

export type Guide = {
  slug: string;
  title: string;
  /** Shown as the H1. May differ from the <title>, which targets the SERP. */
  heading: string;
  headingMr?: string;
  description: string;
  /** ISO date. Bumped by hand when the content actually changes. */
  updated: string;
  intro: string[];
  sections: GuideSection[];
  /** Open questions, shown to the reader rather than guessed at. */
  unverified?: string[];
  related?: { label: string; href: string }[];
};

export const GUIDES: Guide[] = [
  {
    slug: 'manache-paach-ganpati-pune',
    title: 'Manache Paach: Pune’s five ceremonial Ganpati mandals',
    heading: 'The Manache Paach',
    headingMr: 'मानाचे पाच गणपती',
    description:
      'The five mandals that lead Pune’s visarjan procession, in ceremonial ' +
      'order — Kasba, Tambdi Jogeshwari, Guruji Talim, Tulshibaug and ' +
      'Kesariwada — and why the order matters.',
    updated: '2026-09-11',
    intro: [
      'Five of Pune’s sarvajanik mandals are called the Manache Paach — the ' +
      'five that carry mān, the honour of leading. On Anant Chaturdashi the ' +
      'visarjan procession moves through the city in their order, and no ' +
      'other mandal sets out before them.',
      'The honour is traditional rather than earned each year. It does not go ' +
      'to the largest mandal, the richest one or the one with the biggest ' +
      'crowd — Dagdusheth, which draws by far the longest queue in the city, ' +
      'is not one of the five.',
    ],
    sections: [
      {
        heading: 'Why there is an order at all',
        body: [
          'Ganeshotsav became a public festival in Pune in 1893, when Lokmanya ' +
          'Tilak encouraged household Ganpati worship to be held in shared, ' +
          'sarvajanik mandaps. Mandals formed across the peths within a few ' +
          'years, and with them the question of who would go first on the day ' +
          'of immersion.',
          'The order that settled is the one still followed. It is why the ' +
          'visarjan miravnuk has a fixed shape rather than being a matter of ' +
          'who arrives at the road first, and why Kasba setting out is the ' +
          'signal the rest of the city waits for.',
        ],
      },
      {
        heading: 'The five, in order',
        body: [
          'First is Shri Kasba Ganpati in Kasba Peth, Pune’s gramdaivat — the ' +
          'presiding deity of the city. Visarjan across Pune begins only after ' +
          'this mandal’s procession sets out.',
          'Second is Tambdi Jogeshwari in Budhwar Peth, set beside the ' +
          'Jogeshwari temple that gives it its name.',
          'Third is Guruji Talim, established in 1887 and founded in a talim — ' +
          'a traditional wrestling gymnasium. It is long associated with ' +
          'Hindu–Muslim collaboration in the festival’s early years.',
          'Fourth is Tulshibaug Ganpati, known for its tall silver idol, in the ' +
          'market lanes of Budhwar Peth.',
          'Fifth is Kesariwada Ganpati, held at Kesari Wada — Tilak’s residence ' +
          'and the office of his newspaper, Kesari.',
        ],
        mandals: [
          'kasba-ganpati',
          'tambdi-jogeshwari',
          'guruji-talim',
          'tulshibaug-ganpati',
          'kesariwada-ganpati',
        ],
      },
      {
        heading: 'Seeing all five in one walk',
        body: [
          'The five sit close together — Kasba, Budhwar and Narayan Peth are ' +
          'adjacent, and the whole set is comfortably walkable in a morning. ' +
          'The queues are steady rather than punishing, which is the opposite ' +
          'of the Dagdusheth problem.',
          'Go early if you can. The peth lanes are narrowest and quietest in ' +
          'the first hours after sunrise, and every one of these five is ' +
          'easier then than it will be by evening.',
        ],
      },
      {
        heading: 'A note on timings',
        body: [
          'Mandals set their own darshan timings each year and most confirm ' +
          'them only a few days before the festival. This site does not ' +
          'publish a timing until the mandal has announced one, which is why ' +
          'those fields currently read “Not announced yet” rather than ' +
          'carrying a number someone could be stranded by.',
          'What the site does carry is what people standing in the lane report ' +
          'right now — short, moving or heavy — which is the part that ' +
          'actually decides how your evening goes.',
        ],
      },
    ],
    unverified: [
      'Founding years for Tambdi Jogeshwari, Tulshibaug and Kesariwada are not ' +
      'yet cross-checked against a primary source and are therefore not stated ' +
      'here.',
    ],
    related: [
      { label: 'All Manache Paach mandals', href: '/category/maanache' },
      { label: 'Every mandal, from Kasba — the full walking circuit', href: '/routes/every-mandal-from-kasba' },
      { label: 'Curated darshan routes', href: '/routes' },
      { label: 'All Ganpati mandals in Pune', href: '/explore' },
    ],
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
