# 06 — Search

What was implemented, what was deliberately not, and why. Written after
the work, against the live site.

## The honest framing

Nothing here ranks for the 2026 festival. It started three days after this
was written and Google needs weeks to months to crawl, index and rank. The
sitemap fix may get 21 previously-invisible URLs discovered in time to
matter slightly. **2027 is the actual target**, and nobody should be told
otherwise.

## What was already right

Worth recording, because it is the expensive half and it was done before
any of this:

- Content is genuinely server-rendered. `/` is 172 KB of HTML with a real
  `<h1>`; a mandal page is 88 KB with the name in markup. `revalidate =
  3600` and `generateStaticParams` throughout.
- `robots.ts` allows all, disallows `/admin`, `/api`, `/saved`, declares
  the sitemap.
- `/saved` is `noindex` and absent from the sitemap.
- Mandal pages already carried `Place` with `geo` and `address`.
- Route pages already carried `TouristTrip` with a full `itinerary` — the
  richest schema on the site, and better than the audit assumed.
- Mandal pages already had "Nearby mandals", real descriptions on all 29,
  and a provenance note.

## What changed

**Sitemap.** 47 URLs → 68. `/routes` and all 17 route pages were absent
entirely; `/licences` and the new `/guides` pages were added. `lastmod`
stopped being `new Date()` on every URL — which tells a crawler everything
changed on every build and teaches it to ignore the field. It now comes
from `CATALOGUE_GENERATED_AT` for catalogue-derived pages, from the
guide's own edit date for guides, and is **omitted** where nothing is
known. Omitted is a legitimate answer; wrong is not.

**Structured data.** `Organization` + `WebSite` once from the root layout.
`BreadcrumbList` plus a **visible** trail on mandal, area, category, route
and guide pages. `ItemList` on `/explore`, `/routes`, `/guides`, `/area`
and `/category`. `Article` on guides.

**Canonicals.** The homepage had none — the one page most likely to be
reached several ways at once (trailing slash, `utm_source` from Instagram
or X, a Discover referrer).

**Titles.** Mandal titles ran to 94 characters against Google's ~60
truncation, so the layout's `· Pune Ganpati Darshan` suffix was eating the
words searchers were looking for. Mandal, area, category, route and guide
pages now set absolute titles; the suffix stays on short pages where 22
characters of brand are affordable.

**Guides.** `/guides` plus the first one, `manache-paach-ganpati-pune`.

## Schema by page type

| Page | Types |
|---|---|
| All pages (layout) | `Organization`, `WebSite` |
| `/ganpati/[slug]` | `Place`, `BreadcrumbList` |
| `/routes/[slug]` | `TouristTrip` (with `itinerary`), `BreadcrumbList` |
| `/guides/[slug]` | `Article`, `BreadcrumbList` |
| `/explore`, `/routes`, `/guides`, `/area/[slug]`, `/category/[slug]` | `ItemList`, `BreadcrumbList` |

## What is deliberately absent

Each of these would be easy and each is a lie:

- **`aggregateRating` / `review`** — there are no reviews.
- **`openingHours`** — 0 of 29 mandals have a confirmed timing. Every page
  says "Not announced yet". Hours we do not have is the one lie a visitor
  could act on and be stranded by. "timings" was removed from mandal
  titles for the same reason.
- **`LocalBusiness` for the site** — it has no premises. Claiming
  otherwise to reach a local pack is the misrepresentation that gets
  structured data discounted site-wide.
- **Crowd reports in any schema** — they are real, useful and
  crowdsourced, and they expire after 90 minutes. No property carries
  "two people said so in the last hour" without asserting more than we
  know. They stay in the visible page.
- **`SearchAction`** — the convention points it at a search URL, but
  `/explore` has no `q` parameter; it reads `focus` and filters on the
  client. It would advertise a URL that does not search.
- **`FAQPage`** — no page yet has a genuine visible FAQ. Adding one to
  reach for a rich result would mean inventing the questions.

## Indexation policy

**Indexed:** `/`, `/explore`, `/map`, `/routes` and every route,
`/guides` and every guide, all 29 mandals, 8 areas, 4 categories,
`/about`, `/licences`, `/how-to-use`, `/plan`.

**Not indexed:** `/saved` (per-device list, `noindex`), `/admin` and
`/api` (robots), `/start` (an interactive builder with no standalone
content — allowed but not submitted).

Verified live: all 68 sitemap URLs return 200, none carries `noindex`,
and no `noindex` URL appears in the sitemap.

## Not done, and why

- **The other seven guides.** Drafted only after the first is
  fact-checked. A wrong visarjan route is worse than no page.
- **Marathi pages.** The opportunity is real — पुण्यातील गणपती,
  पुणे गणपती मंडळ — but a machine-translated mirror is worse than none.
  Two authored Marathi guides with real `hreflang` pairs, later.
- **Image sitemap.** Not until there is enough original photography to
  justify one.
- **Per-row `updatedAt`.** The catalogue mapper sets it to `''`. Wiring it
  through would give real per-mandal `lastmod`; the snapshot date is the
  honest stand-in until then.

## The weekly loop

| Signal | Action |
|---|---|
| Impressions up, CTR down | Title and description — the query is not what the title promises |
| Position 8–15 | Content depth and internal links, not more pages |
| High impressions, no clicks | The intent is wrong; check what the query actually wants |
| Indexed, no impressions | Topically thin — is there a reason for the page to exist |
| Crawled, not indexed | Quality or duplication; check against a sibling page |

One thing to watch specifically: `/explore` has an `sr-only` `<h1>`. That
is right for the interface — it is a search UI, not an article — but it
means the page has no visible heading for a crawler to weigh. If it
underperforms in GSC, that is the first thing to revisit.
