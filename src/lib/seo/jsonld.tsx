import { env } from '@/lib/env';

/**
 * Structured data, in one place.
 *
 * The rule this module exists to enforce: schema describes what is
 * visibly on the page, and nothing else. Google's guidelines are explicit
 * that markup contradicting the page is a manual-action risk, and the
 * cost of getting caught is not this page — it is every rich result on
 * the site being dropped at once.
 *
 * Three things are therefore deliberately absent and should stay absent:
 *
 *   aggregateRating / review — there are no reviews to aggregate.
 *   openingHours — 0 of the 29 mandals have confirmed timings, and every
 *     page says "Not announced yet". Publishing hours we do not have
 *     would be the one lie a visitor could act on and be stranded by.
 *   LocalBusiness for the site itself — this is a free non-commercial
 *     project with no premises. Claiming otherwise to win a local pack is
 *     exactly the misrepresentation that gets structured data ignored.
 *
 * Crowd reports are the other trap. They are real, useful and
 * crowdsourced, and they expire after ninety minutes. They belong in the
 * visible page, never in schema, because no schema property can carry
 * "two people said so in the last hour" without asserting more than we
 * know.
 */

const BASE = env.NEXT_PUBLIC_APP_URL;

/** Stable @ids, so the graph nodes can reference each other. */
export const ORG_ID = `${BASE}/#organization`;
export const SITE_ID = `${BASE}/#website`;

/** Escapes the one sequence that can break out of a JSON-LD script tag. */
function serialise(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serialise(data) }}
    />
  );
}

/**
 * Organization and WebSite, emitted once from the root layout.
 *
 * There is no SearchAction. The convention is to point it at a search
 * URL, but /explore has no `q` parameter — it reads `focus` and filters
 * on the client — so a SearchAction would advertise a URL that does not
 * search. A sitelinks searchbox that returns an unfiltered list is worse
 * than none, and Google no longer shows it for most sites anyway.
 *
 * The contact details and social profiles are the owner's own, published
 * on /about at their request. `sameAs` is only honest because those
 * profiles genuinely belong to this project.
 */
export function siteGraph() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': ORG_ID,
        name: 'Pune Ganpati Darshan',
        alternateName: 'GanpatiPune',
        url: `${BASE}/`,
        logo: {
          '@type': 'ImageObject',
          url: `${BASE}/icons/apple-touch-icon.png`,
        },
        description:
          'Live queue reports from devotees and walkable darshan routes ' +
          'through Pune’s Ganpati mandals. Free and non-commercial.',
        email: 'singhgurnoor080@gmail.com',
        telephone: '+91-6283031102',
        founder: { '@type': 'Person', name: 'Gurnoor Singh' },
        areaServed: { '@type': 'City', name: 'Pune' },
        sameAs: [
          'https://x.com/singhgurnoor080',
          'https://www.instagram.com/terabyte_trifler/',
          'https://fennrstudio.com',
        ],
      },
      {
        '@type': 'WebSite',
        '@id': SITE_ID,
        name: 'Pune Ganpati Darshan',
        url: `${BASE}/`,
        publisher: { '@id': ORG_ID },
        inLanguage: ['en-IN', 'mr-IN'],
      },
    ],
  };
}

export type Crumb = { name: string; url?: string };

/**
 * BreadcrumbList for a trail that is also rendered visibly.
 *
 * The last crumb intentionally has no `item`: it is the current page, and
 * a self-link there is the most common way this markup gets flagged.
 */
export function breadcrumbList(crumbs: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      ...(c.url ? { item: c.url.startsWith('http') ? c.url : `${BASE}${c.url}` } : {}),
    })),
  };
}

/**
 * ItemList for a page that renders an ordered list of links.
 *
 * Carries names and URLs only. Repeating each entity's full description
 * here would duplicate what the linked page already says and inflate the
 * payload on a listing that can run to twenty-nine items.
 */
export function itemList(
  name: string,
  items: { name: string; url: string }[]
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      url: it.url.startsWith('http') ? it.url : `${BASE}${it.url}`,
    })),
  };
}
