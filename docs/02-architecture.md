# Phase 1 — Architecture, Route Map & Roadmap

## Layering rule
`app/` (routing + RSC) → `features/` (composed UI) → `services/` (business logic) → `db/` + `lib/maps/`
Dependencies point downward only. UI never imports the Supabase client directly; it goes through a
service. Nothing outside `lib/maps/` touches `google.maps.*`.

```
src/
  app/                     routes only — thin, mostly Server Components
    (marketing)/           home, guides, info      SSG/ISR
    (app)/                 explore, map, plan, saved   app shell + bottom nav
    ganpati/[slug]/        detail — generateStaticParams + generateMetadata
    area/[slug]/  category/[slug]/
    admin/                 server-guarded CRUD
    api/                   route handlers (server-only secrets live here)
  features/                map/ planner/ discovery/ search/ favorites/ admin/
  components/ui/           primitives (Button, Sheet, Chip, Skeleton, Dialog)
  services/                ganpati.ts plans.ts favorites.ts analytics.ts search.ts
  lib/
    maps/                  maps-client · places · routes · geocoding · markers · dark-style
    supabase/              client(browser) · server(RSC) · admin(service-role, server-only)
    env.ts                 zod-validated, throws at import
    geo.ts                 haversine, bbox, formatting — pure, unit-tested
  db/                      generated types + query builders
  types/  hooks/  content/
supabase/migrations/       versioned SQL
supabase/seed.sql          18 real Pune mandals
```

### Client/server boundary (security-critical)
- `lib/supabase/admin.ts` and `lib/maps/routes.ts` begin with `import 'server-only'`.
- `SUPABASE_SERVICE_ROLE_KEY` and `GOOGLE_MAPS_SERVER_API_KEY` are read **only** inside those files.
- Routes API is never called from the browser — a `/api/routes` handler proxies it, so the server
  key is restricted by IP and never shipped. The browser key is referrer-restricted and used only
  for Maps JS + Places autocomplete.

## Route map
| Route | Render | Notes |
|---|---|---|
| `/` | RSC + ISR | hero, countdown, nearby (client island), iconic, Manache Paach, areas |
| `/explore` | RSC + client filters | list + filter chips, URL-synced state |
| `/map` | client island | full-viewport map, bottom sheet, clustering |
| `/ganpati/[slug]` | SSG + `generateMetadata` | gallery, info, directions, add-to-darshan, JSON-LD |
| `/area/[slug]` · `/category/[slug]` | SSG | SEO landing pages from DB metadata |
| `/plan` | client | multi-stop builder, travel mode, optimise, start |
| `/plan/[id]` | RSC | shareable saved plan, OG metadata |
| `/saved` | client | localStorage, DB-synced when signed in |
| `/about`, `/info/*` | static | |
| `/admin`, `/admin/ganpati/[id]`, `/admin/import` | RSC + server actions | role-gated in DB, not UI |
| `/api/routes`, `/api/plans`, `/api/analytics`, `/api/revalidate` | route handlers | zod-validated, rate-limited |

## Data flow: "Ganpati near me"
1. Client asks for geolocation **only on explicit tap** ("Near me"), never on load (§14).
2. Coordinates stay on the device. Sorting uses local haversine against already-loaded mandals —
   **zero API calls, works offline** (D3).
3. Distance renders as "1.2 km away". No ETA is claimed until Routes is actually called.
4. Denied/unavailable → silently fall back to Pune centre, list still renders.

## Roadmap (execution order)
| Phase | Deliverable | Gate |
|---|---|---|
| 1 | Audit, architecture, schema, design system, env | this document |
| 2 | Design tokens, app shell, bottom nav, home, cards | renders at 320–1440px |
| 3 | Supabase schema + RLS + seed + services | `db push`, RLS tests pass |
| 4 | Detail pages, search, filters, areas/categories | every seed slug resolves |
| 5 | Maps: dark style, markers, clustering, sheet, sync | 60fps pan on mid-tier |
| 6 | Planner: stops, modes, optimiser, Routes proxy | route math unit-tested |
| 7 | Favourites, share, saved plans, auth | anonymous path never blocked |
| 8 | Admin CRUD + CSV import | RLS denies non-admin |
| 9 | PWA, offline, performance | Lighthouse ≥90/95/95/95 |
| 10 | SEO: metadata, sitemap, robots, JSON-LD | |
| 11 | Security audit + Playwright QA | `npm audit`, 8 flows green |
