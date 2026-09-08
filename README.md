# Pune Ganpati Darshan

A mobile-first web app for Ganeshotsav in Pune: find mandals, see what's near
you, and plan a walkable darshan route through the old peths.

**Stack:** Next.js 16 (App Router, RSC) · TypeScript strict · Tailwind v4 ·
Supabase Postgres + RLS · MapLibre GL + OpenFreeMap · OSRM routing · PWA

**No map billing.** The map needs no API key, no account and no card: tiles
come from OpenFreeMap (OpenStreetMap data) and routing from OSRM. Search,
distances and route ordering were already local, so nothing here bills.

---

## Status

| Check | Result |
|---|---|
| `npm run build` | 45 pages, 0 errors |
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 problems |
| `npm test` (Vitest) | 34 passed |
| `npm run test:e2e` (Playwright) | 23 passed, mobile + desktop |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Live RLS checks (real anon JWT) | 9 passed |
| Live privilege-escalation probe | 6 passed |
| Live admin CRUD (real session) | 4 passed |
| Curated routes + wizard (E2E) | budget fit asserted |
| Map renders real tiles (E2E) | asserted via MapLibre `idle` |
| Lighthouse mobile (home / explore / routes) | **93–97** perf · **100** a11y · **100** BP · **100** SEO |
| Lighthouse mobile (mandal detail) | **88** perf · **100** a11y · **100** BP · **100** SEO |
| Lighthouse desktop | **100** across all four |

---

## Quick start

```bash
npm install
cp .env.example .env.local     # works with everything blank
npm run dev                    # http://localhost:3000
```

The app runs with **no credentials at all**. With no Supabase it serves the
generated catalogue in `src/content/catalogue.json`; with no Maps key the map
surface shows an explicit "Map isn't configured" state instead of a fake map.
Nothing is stubbed — every feature either works or says why it cannot.

---

## Environment variables

| Variable | Required | Scope | Purpose |
|---|---|---|---|
| *(map tiles)* | **none** | — | OpenFreeMap needs no key |
| `ROUTING_OSRM_URL` | optional | **server only** | OSRM endpoint; defaults to the public demo |
| `ROUTING_OSRM_HAS_PROFILES` | optional | **server only** | `true` only if your OSRM serves real foot/bike profiles |
| `OPENROUTESERVICE_API_KEY` | optional | **server only** | better routing; free tier, no card |
| `NEXT_PUBLIC_SUPABASE_URL` | for the DB | browser | project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | for the DB | browser | anon key (RLS enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | for admin | **server only** | bypasses RLS |
| `NEXT_PUBLIC_APP_URL` | yes | both | canonical URLs, sitemap, OG |

Validated by zod at import (`src/lib/env.ts`). A blank value means "feature
off", not "invalid" — the build fails loudly on a genuinely malformed value.

### Map and routing providers

**Tiles — OpenFreeMap.** OpenStreetMap vector tiles, no key, no account, no
quota. The dark style in `src/lib/maps/map-style.ts` is written from scratch
against the same pigment palette as the rest of the app rather than
recolouring an off-the-shelf theme. OSM attribution is rendered on the map
and is a licence requirement — do not remove it.

**Routing — OSRM by default.** No key. Two cautions before launch:

1. The public demo at `router.project-osrm.org` is **not for production** —
   self-host and set `ROUTING_OSRM_URL`.
2. The demo hosts only the **car profile** and ignores the profile in the
   URL: `/foot`, `/bike` and `/driving` return identical distances *and*
   durations (measured: 7.6 m/s for all of them). Its distances are real road
   distances and worth using; its walking durations are car durations. So
   unless you self-host with real profiles and set
   `ROUTING_OSRM_HAS_PROFILES=true`, the app keeps the routed distance and
   derives the time from measured mode speed, and labels it
   *"from routed distance"* rather than claiming a routed ETA.

**OpenRouteService (optional).** Set `OPENROUTESERVICE_API_KEY` for genuine
per-mode profiles and a real quota. Free tier, signup, no card.

---

## Supabase setup

One command applies the schema, RLS, functions and seed, then verifies the
result. It tries the direct (IPv6) host first and falls back to the Mumbai
session poolers, so it works with or without IPv6 egress:

```bash
PGPASSWORD='<db password>' PROJECT_REF='<ref>' REGION=ap-south-1 \
  ./scripts/setup-supabase.sh
```

Then enable **Google** and/or **Email (magic link)** in Authentication →
Providers, and add `<your-domain>/auth/callback` to the redirect allow-list.

**Create the first admin.** Sign in through `/signin` once, then:

```bash
PGPASSWORD='<db password>' psql -h db.<ref>.supabase.co -U postgres -d postgres \
  -c "update profiles set is_admin = true where id =
      (select id from auth.users where email = 'you@example.com');"
```

### Verifying a deployment

All three take configuration from the environment — nothing project-specific
is committed.

```bash
export SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_ANON_KEY=<anon key>

# 9 policy checks with a real anon JWT
node tools/verify-rls.mjs

# 6 escalation attempts as an ordinary signed-in user; all must fail
EMAIL=<throwaway user> PASSWORD=<password> node tools/verify-escalation.mjs

# Admin CRUD with a real session
EMAIL=<throwaway admin> PASSWORD=<password> node tools/verify-admin.mjs
```

The last two need throwaway accounts you create for the run and delete
afterwards. Never point them at a real user.

Enable **Google** and/or **Email (magic link)** providers in
Authentication → Providers, and add `<your-domain>/auth/callback` to the
redirect allow-list.

### Migrations

| File | Contents |
|---|---|
| `20260908090000_init.sql` | 10 tables, enums, constraints, indexes, `updated_at` triggers |
| `20260908090100_rls.sql` | RLS policies for every table + admin self-grant guard |
| `20260908090200_functions.sql` | `search_ganpatis()`, `nearby_ganpatis()` |

The schema was validated end-to-end against PostgreSQL 17 before shipping:
all three migrations apply cleanly, the seed loads, both RPCs return correct
results, and the integrity constraints (`manache_rank_matches_category`,
unique `manache_rank`, `timings_paired`) were each confirmed to reject bad
input.

### Regenerating the offline catalogue

`src/content/catalogue.json` is **generated**, never hand-edited:

```bash
./scripts/export-catalogue.sh "$SUPABASE_DB_URL"
```

The SQL seed is the single source of truth; this keeps the offline snapshot
from drifting from the database.

---

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | dev server |
| `npm run build` / `npm start` | production build / serve |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright, mobile + desktop |
| `npm run lint` | ESLint |
| `npm run typecheck` | tsc --noEmit |
| `npm run visual` | screenshot + horizontal-overflow sweep |

---

## Deployment

Vercel is the intended target (the app is a standard Next 16 App Router build).

1. Import the repo, set all environment variables from the table above.
2. Set `NEXT_PUBLIC_APP_URL` to the production origin — sitemap, canonicals
   and OG tags derive from it.
3. Add the production domain to the browser key's referrer restrictions, and
   the deployment's egress IPs to the server key's IP restrictions.
4. `supabase db push` against the production project.

**Before going live**, replace the in-memory rate limiter
(`src/lib/rate-limit.ts`) with a shared store — it protects one instance
only. See *Known limitations*.

---

## Architecture

```
src/
  app/          routes only — thin, mostly Server Components
  features/     composed UI by domain (map, planner, discovery, search, …)
  components/   reusable primitives
  services/     business logic — the only layer that talks to the DB
  lib/
    maps/       the ONLY place that touches google.maps.*
    supabase/   client (browser) · server (RSC) · admin (service-role)
    env.ts      zod-validated
    geo.ts      pure, unit-tested
  db/           typed schema bindings
  content/      generated catalogue snapshot
```

Dependencies point downward only. UI never imports a Supabase client
directly. See `docs/02-architecture.md`.

Full write-ups: `docs/01-product-audit.md` (reference audit + product
decisions), `docs/02-architecture.md`, `docs/03-security.md`,
`docs/04-performance.md`.

---

## Route surfaces

| Route | What it does |
|---|---|
| `/start` | Three-step builder: time budget → darshan pace → interests → a route that fits |
| `/routes` | 16 curated routes, with "good for right now" chosen by Pune local time |
| `/routes/[slug]` | Numbered stops on a map, per-stop queue time, "Use this route" |
| `/plan` | Your own stops: reorder, optimise, route line on a map, hand off to navigation |
| `/map` | Full-screen map, clustered pins, filters, draggable sheet |

Maps are embedded throughout — mandal pages show location, route and plan
pages draw the ordered stops — not confined to `/map`.

### Curated routes

16 routes, from a four-hour full circuit down to a genuine one-hour dash.
Shapes are the ones a Pune visitor actually asks for; the titles, copy and
stop lists are this project's own, built from its 18 mandals and their
measured dwell times.

Where a route makes a time claim in its name, that claim is checked against
the computed total rather than asserted — "One hour from Mandai" came out at
1 hr 4 min on first build, so the route was trimmed (Tulshibaug from a queued
darshan to a roadside look) until it genuinely fits in 59 minutes.

### Why queue time is modelled

`darshan_minutes` per mandal is what makes a time budget honest. Dagdusheth
alone is ~45 minutes typical and ~150 at peak, while the walk from Tulshibaug
is six. A planner that counts only travel will cheerfully claim nine mandals
fit in two hours and be wrong by a factor of three. Every generated plan shows
queuing and walking separately, and the E2E suite asserts the total never
exceeds the budget the user chose.

## Photographs

23 photographs cover 9 of the 18 mandals, all from
[Wikimedia Commons](https://commons.wikimedia.org) under CC BY / CC BY-SA.
Every image records its photographer and licence, the UI renders that credit,
and `/licences` lists all of them and discloses that images were resized —
which is what the licences require.

**The other 9 mandals deliberately have no photograph.** No freely-licensed
image of them exists, and using a generic Ganesha stock photo would imply it
shows that specific mandal. Photographs found elsewhere online are almost all
all-rights-reserved and are not used.

Those entries render a drawn Ganpati silhouette (`GanpatiGlyph`) on a gradient
keyed to the mandal's name. A drawn symbol is honest in a way a borrowed photo
is not — it is plainly an illustration, so it decorates the card without
claiming to depict that mandal. It replaced the mandal's initial letter, which
read as a missing asset rather than a considered placeholder. The same
silhouette is used for map pins, so the visual language is consistent.

To add more: drop rows into `ganpati_images` (or use `/admin`). The UI needs
no change.

## Data policy

Three things are deliberate, and matter more than they look:

1. **No invented darshan timings.** Mandals announce them days before the
   festival. The schema models timings fully and the UI renders them when
   present, but the seed ships `null` and the page says *"Not announced yet"*.
   A confident wrong time sends a real person across the city for nothing.
2. **Every record carries a `confidence` value** — `verified`, `community`
   or `demo` — and the UI shows it. A visitor deciding whether to cross Pune
   deserves to know which claims are checked.
3. **`prominence` is a sort weight, not a rating.** It is never rendered as
   stars, and there are no invented review scores anywhere in the product.

---

## Known limitations

| # | Limitation | Impact | Fix |
|---|---|---|---|
| 1 | **Rate limiter is per-instance and in-memory** | On multi-instance deploys the effective limit is N× the configured one | Back `src/lib/rate-limit.ts` with Upstash/Redis |
| 2 | **No mandal photography** | Cards render a generated gradient fallback | Add rows to `ganpati_images`; the UI already handles them, no code change |
| 3 | **Public OSRM demo is dev-only** | Rate-limited, no SLA, car profile only | Self-host OSRM (or set an ORS key) before launch |
| 3b | **No admin user exists yet** | `/admin` is unreachable until one is created | Sign in once, then run the SQL under *Supabase setup* |
| 3c | **maplibre-gl pinned to v5** | v6 constructs the map but never fires `load` — no tiles, no errors | Re-test v6 on a later release; v5 is stable and current |
| 3d | **No Places autocomplete** | Search covers the catalogue only, not arbitrary Pune addresses | Add Photon/Nominatim (both free) if address search is wanted |
| 4 | **Favourites do not yet sync to the DB on sign-in** | Anonymous favourites stay device-local | Merge `localStorage` into `favorites` in the auth callback |
| 5 | **Saved plans are local only** | `/plan` state is device-local; `darshan_plans` is schema-ready but unwired | Persist on "Share" and serve `/plan/[shareId]` |
| 6 | **Transit mode depends on Google coverage** | Routes may return no transit route in Pune | UI already surfaces "route unavailable" |
| 7 | **18 mandals seeded** | Pune has thousands | Use `/admin/import` — CSV/JSON import is built, validated and verified against the live database |
| 8 | **Analytics has no dashboard** | Events are stored but only queryable via SQL | Build `/admin/analytics` over `analytics_events` |

---

## Recommended next features

1. **Live crowd signal** — the single highest-value addition. Queue length is
   what actually decides where a visitor goes next; even coarse
   crowd-sourced reporting beats none.
2. **Sync favourites and plans on sign-in** (limitations 4 and 5) — the
   schema and RLS are already in place.
3. **Visarjan-day mode** — procession routes and road closures; the day the
   app is most used and most useless without closure data.
4. **Real photography with a rights model** — mandal-submitted images via the
   existing `ganpati_images` table.
5. **Marathi UI locale** — content is already bilingual; the chrome is not.
   Add `next-intl` and a `LocaleProvider`.
6. **Timings ingestion** — a small admin flow for entering timings as mandals
   announce them, so the honest gap closes during festival week.
