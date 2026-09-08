# Security checklist

Audited against the running build, not from intent. Every ✅ below was
verified by the command shown.

## Secrets and the client/server boundary

| Check | Status | Evidence |
|---|---|---|
| Service-role key never in a client bundle | ✅ | `grep -rl "SUPABASE_SERVICE_ROLE" .next/static` → no matches |
| Routes server key never in a client bundle | ✅ | same grep, clean |
| Public keys correctly inlined | ✅ | `NEXT_PUBLIC_SUPABASE_URL` present, as designed |
| Files reading secrets are `server-only` | ✅ | `admin.ts`, `routes.ts`, `env.server.ts`, `auth.ts`, `ganpati.ts`, `rate-limit.ts` |
| `serverEnv()` throws in the browser | ✅ | explicit `typeof window` guard |
| Env validated at import | ✅ | zod in `src/lib/env.ts`; build fails on malformed values |

**Finding fixed during the audit.** The server env *schema* (key names, not
values) was being bundled into a client chunk because it shared a module with
the public schema. No secret leaked, but it made the audit ambiguous. Split
into `src/lib/env.server.ts` (`server-only`) and re-verified clean.

## Database — Row Level Security

All 10 tables have RLS enabled with explicit policies:

| Table | Read | Write |
|---|---|---|
| `areas`, `categories`, `festival_config` | public | admin only |
| `ganpatis`, `ganpati_images` | published rows, or admin | admin only |
| `profiles` | own row, or admin | own row; `is_admin` blocked by trigger |
| `favorites` | `user_id = auth.uid()` | own rows only |
| `darshan_plans` | `is_public OR user_id = auth.uid()` | own rows only |
| `darshan_plan_stops` | via parent plan | via parent plan |
| `analytics_events` | **admin only** | insert-only |

- **Privilege escalation blocked at the database.** `profiles_no_self_admin`
  raises if an *authenticated* non-admin changes `is_admin`. A `WITH CHECK`
  clause cannot compare against the pre-update row, so this had to be a
  trigger.

  **Finding fixed during live testing.** The original guard raised whenever
  `is_admin` changed and the caller was not already an admin. Outside
  PostgREST `auth.uid()` is null, so `is_admin()` is false — which meant a
  direct database connection could not grant the *first* admin. The system
  was unbootstrappable, and this was invisible until an admin was actually
  created against a real project. The guard now applies only when
  `auth.uid() is not null`. This does not widen the boundary: `anon` cannot
  reach the table at all, because `profiles_update_own` requires
  `id = auth.uid()`, which matches no row without a JWT. Fixed in
  `20260908120000_fix_admin_bootstrap.sql` and re-verified by attempting
  escalation as a real signed-in user.
- **`is_admin()` is `SECURITY DEFINER`** so evaluating another table's policy
  cannot recurse through RLS on `profiles`.
- **Analytics is write-only to clients.** Events are inserted via the
  service-role client behind `/api/analytics`; nobody but an admin can read
  the stream back.

## Authorization

- `/admin` is gated **three times**: `proxy.ts` (fast edge rejection),
  `getSessionUser()`/`requireAdmin()` in the page, and RLS at the database.
  Hiding UI is never the boundary (§27).
- Server Actions re-check `requireAdmin()` on every call — a Server Action is
  a public HTTP endpoint.
- Auth uses `supabase.auth.getUser()` (revalidates the JWT server-side), never
  `getSession()` (reads an unverified cookie).
- ✅ Verified by E2E: `Flow 7 — admin is not reachable without authorization`.
- ✅ Verified with a **real admin session** against the live project
  (`tools/verify-admin.mjs`, 4/4): the admin list renders, a mandal is created
  through the actual server action, a rank on a non-manache mandal is
  rejected, and deletion works.
- ✅ Verified with a **real ordinary-user session** (`tools/verify-escalation.mjs`,
  6/6): cannot self-escalate, cannot modify or insert into the catalogue,
  cannot read the analytics stream, cannot read other users' profiles, cannot
  modify festival config.

## Input validation

- Every API route and Server Action validates with zod before use.
  ✅ `POST /api/routes` with `lat: 999` → **400**.
- Admin form schema mirrors the DB CHECK constraints, so invalid combinations
  fail with a readable message instead of a Postgres error.
- CSV/JSON import validates **every row before writing any row** — a partial
  import is never possible.
- Zero raw SQL string interpolation; all access goes through the typed query
  builder or parameterised RPCs.

## Web

| Control | Implementation |
|---|---|
| `X-Content-Type-Options: nosniff` | `next.config.ts` |
| `X-Frame-Options: DENY` | `next.config.ts` |
| `Referrer-Policy: strict-origin-when-cross-origin` | `next.config.ts` |
| `Permissions-Policy` | camera, mic, payment, FLoC all denied |
| XSS | One `dangerouslySetInnerHTML`, and it renders `JSON.stringify` of a server-built JSON-LD object — no user input reaches it |
| Open redirect | `/auth/callback` accepts only same-origin relative `next` values (rejects `//evil.com`) |
| Image sources | Explicit `remotePatterns`, never a wildcard host |
| Rate limiting | `/api/routes` 20/min, `/api/analytics` 60/min, keyed on platform-set forwarding headers only |
| Dependencies | `npm audit --omit=dev` → **0 vulnerabilities** |

## Privacy

- Geolocation is requested **only on explicit tap**, never on load.
- Coordinates never leave the device: nearby sorting is local haversine.
- Analytics stores no PII — no IP, no user id; the session id is a random
  value in `sessionStorage` that dies with the tab.
- `/saved` and `/admin` are `noindex` and disallowed in `robots.txt`.

## On writing these checks

Two of these assertions were initially **wrong in a way that produced false
passes**, and both failures shared a root cause: asserting on the *absence of
an error* rather than on *observed effect*.

1. *"anon reads 0 rows from `analytics_events`"* passes on an empty table — it
   would have passed with RLS switched off entirely. The check now inserts
   first (an insert that is known to succeed), then reads back, so a row
   provably exists and an empty read is real evidence.
2. *"an ordinary user updating `ganpatis` returns no error"* was briefly read
   as a **leak**. It is not: PostgREST returns success with 0 rows affected
   when a `USING` clause matches nothing. The check now reads the row back and
   compares the value.

Any future policy test must assert on state, not on status codes.

## Outstanding

1. **Rate limiter is per-instance** (`src/lib/rate-limit.ts`). On a
   multi-instance deploy the effective limit is N× configured. Back it with
   Redis/Upstash before launch.
2. **No CSP header yet.** Adding one requires nonce-based script handling for
   Next's inline bootstrap, plus allowances for the OpenFreeMap tile and
   glyph endpoints MapLibre fetches at runtime.
3. **Routing runs against a public OSRM instance by default.** It is
   rate-limited and has no uptime commitment; self-host and set
   `ROUTING_OSRM_URL` before launch. There is no map key to leak, because the
   tile provider needs none.
