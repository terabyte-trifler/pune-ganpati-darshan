# Phase 1 — Product & Technical Audit

## 1. Reference audit — puneganpati.in

Observed by fetching the live site's HTML shell, RSC payload, `sitemap.xml` and `robots.txt`
(the pages are client-rendered, so the visible DOM was not scraped and no source was copied).

### Stack signature
| Signal | Finding |
|---|---|
| Framework | Next.js App Router (RSC flight payload, `/_next/static/chunks/app/*`) |
| Styling | Tailwind + shadcn/ui token names (`bg-primary`, `text-primary-foreground`, `ring`) |
| Providers | `LocaleProvider`, `PlanProvider`, `PwaInstallProvider`, `InstallUIProvider`, `AnalyticsProvider`, `PointerCaptureGuard` |
| Analytics | Google Analytics + Vercel Insights |
| PWA | `manifest.json`, `mobile-web-app-capable`, apple touch icons |
| Theme colour | `#D35400` (pumpkin orange) |
| i18n | `LocaleProvider` + `og:locale=en_IN` → English/Marathi toggle |

### Information architecture (from sitemap)
```
/                     priority 1.00  weekly
/mandals              0.90  weekly     directory
/journey              0.90  daily      ← daily changefreq = the live/stateful surface
/routes               0.90  weekly     curated itineraries
/find                 0.85  weekly     search  (?q= per SearchAction schema)
/start                0.60  monthly    3-step JourneyWizard
/guides/{ganeshotsav-2026, manache-paach, first-time}   0.88  editorial SEO
/areas/{kasba, budhwar, sadashiv, narayan, shukrawar, …} 0.75  area landing pages
/info/{terms, privacy, disclaimer}     0.35
/walk/                Disallowed in robots.txt  ← live turn-by-turn walk mode, deliberately deindexed
```

### What the reference gets right (worth keeping)
1. **The wizard is the front door.** `/start` is a 3-step builder (time → interests → plan), not a
   feature list. The product's job is producing an itinerary, and the IA says so.
2. **Area pages as first-class SEO surfaces.** Peth-level landing pages capture the real search
   demand ("Budhwar Peth Ganpati").
3. **Editorial guides alongside the app.** `manache-paach` / `first-time` are the queries a visitor
   actually types before the festival.
4. **A deindexed live mode.** `/walk/` being `Disallow`ed shows a stateful navigation surface
   separated from the indexable content surface. Correct instinct.
5. **PWA from day one.** Right call for an outdoor, patchy-network audience.

### Weaknesses we deliberately improve on
| # | Reference weakness | Our decision |
|---|---|---|
| W1 | **No interactive map in the IA.** There is no `/map` route; the map is not the primary object. For "which Ganpati next and how do I get there", a map-first surface is the answer. | `/map` is a first-class tab with a full-viewport Google map + draggable bottom sheet. |
| W2 | **Wizard-first funnel gates discovery.** A 3-step form stands between arrival and value. | Homepage answers the question immediately (nearby list + map). The wizard becomes an *optional* accelerator at `/plan`, never a gate. |
| W3 | **Route builder is preset-driven, not spatial.** Choosing "time + interests" yields a canned plan. | Real multi-stop optimisation over user-chosen mandals via Routes API + a 2-opt/held-karp solver, with live distance/ETA. |
| W4 | **Client-rendered shell.** The `/start` HTML ships an empty `<main>`; content arrives after hydration — costly on 4G mid-range Android. | Server Components render mandal content in the initial HTML. Map JS loads lazily and only on map surfaces. |
| W5 | **Content appears build-time static.** No admin surface; data changes require a redeploy. | Supabase Postgres + `/admin` CRUD, CSV/JSON import, festival config as data. |
| W6 | **No visible personalisation.** No favourites/saved surface in the sitemap. | `/saved` with localStorage for anonymous users, DB sync on sign-in. |

## 2. Product decisions taken

**D1 — Map-first, wizard-optional.** Inverts the reference funnel. §3 of the brief
("which Ganpati should I visit next, and how do I get there?") is a *spatial* question.

**D2 — Honest data over complete-looking data.** The seed dataset carries no darshan timings.
Mandals announce timings days before the festival; a confident wrong time sends someone across
the city for nothing. The schema models timings fully and the UI renders them when present, but we
ship `null` rather than invented hours. Every record carries a `confidence` enum
(`verified` / `community` / `demo`) surfaced in the UI — this satisfies brief §41's requirement to
distinguish verified from community from placeholder data, and §61's ban on fake functionality.

**D3 — Distance is computed, ETA is labelled.** Straight-line haversine × a road-detour factor is
used for list sorting (free, instant, offline-capable). Google Routes is called only when the user
commits to a route. List cards say "1.2 km away", not a fabricated turn-by-turn ETA.

**D4 — Two-wheeler mode.** Google Routes exposes `TWO_WHEELER` and it is the dominant Pune
festival vehicle. Included alongside walk/drive; transit is offered only where Routes returns it.

**D5 — Peth-core walkability is the product's spine.** 16 of 18 seed mandals sit inside a
~2.5 km box across the old peths. Walking is the default travel mode.

## 3. Risk register
| Risk | Mitigation |
|---|---|
| Maps API key absent in dev | Real integration + explicit `MapUnavailable` state; never a fake screenshot (§12) |
| Maps billing runaway | Field masks, session tokens, server-side Routes proxy, cached matrices, lazy loader (§58) |
| Crowd/network failure outdoors | Cache-first mandal metadata in SW; favourites in localStorage; app usable with Maps down (§35) |
| Wrong information sent to a real pilgrim | `confidence` enum + timings omitted rather than guessed (D2) |
| Service-role key leaking to browser | Server-only module guard + env validation that throws at import (§30, §59) |
