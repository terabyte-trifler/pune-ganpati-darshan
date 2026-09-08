# Crowd intelligence

Crowdsourced queue reports: devotees say what a mandal looks like right now,
everyone else sees the consensus.

Everything below that says "measured" was measured. Everything that says
"expected" was not.

---

## 1. The traffic model, which decides the design

"10,000 concurrent users" is not 10,000 requests per second, and treating it
as such would produce a system built for traffic nobody is going to send.

The client polls every 20 seconds and pauses entirely when the tab is hidden,
backgrounded, or offline. So:

```
10,000 concurrent readers ÷ 20s poll = ~500 requests/second at the origin
```

before any CDN. That is the number the read path is designed and tested
against. The saturation run then finds where the origin actually breaks, so
the headroom is known rather than assumed.

Writes are a different shape entirely: a few hundred over an evening, from
people physically standing at a mandal. Low volume, high consequence — every
one of them is security-sensitive and must be correct under concurrency.

---

## 2. Read path

```
browser (one poller for the whole app)
   ↓  20s, paused when hidden/offline
CDN            Cache-Control: public, s-maxage=15, stale-while-revalidate=60
   ↓  miss
route handler
   ↓
per-mandal cache (CrowdCache)          15s TTL
   ↓  miss
single-flight guard                    ← collapses concurrent misses into one
   ↓
ONE query for every mandal in the city
   ↓
Postgres
```

**Why one query for the whole city.** The catalogue is ~23 mandals, so
aggregating all of them costs barely more than aggregating one. This makes
the hot-key problem in the brief (§25) disappear rather than need solving:
Dagdusheth's status is computed by the same query as everyone else's, so it
needs no special caching. One cache miss warms the entire city.

**Why single-flight.** Without it, a cache expiry under 10,000 concurrent
readers means 10,000 simultaneous misses and 10,000 database queries — a
stampede at exactly the moment the database is least able to absorb one. With
it, one query runs and every other request awaits the same promise. This is
the single most important line of code in the read path, and the load test
below measures its effect directly.

**No materialised `crowd_status` table.** It was considered and rejected: it
would add write amplification and a second staleness window to save work that
measurement shows is not expensive. If the catalogue grows by an order of
magnitude, revisit — the seam to change is `computeSnapshot()`.

---

## 3. Aggregation

Pure functions in `crowd-aggregation.ts`, no I/O, injected clock. 29 unit
tests.

**Freshness.** Exponential decay, `w = 2^(-age/30min)`, hard zero past 90
minutes. The brief suggested step buckets (1.0 / 0.8 / 0.5 / 0.25); steps have
a defect that matters here — a report's influence falls off a cliff as it
crosses a boundary, so a mandal near a tie flips its displayed status when a
clock ticks past 15 minutes with no new information. Users read that as the
app being unreliable. Decay tracks the intended curve without the cliff:

| age (min) | steps | decay |
|-----------|-------|-------|
| 0         | 1.00  | 1.00  |
| 15        | 1.00  | 0.71  |
| 30        | 0.80  | 0.50  |
| 60        | 0.50  | 0.25  |
| 90        | 0.25  | 0.125 |

Because the weight is zero past 90 minutes, expiry needs no cron job — an old
report cannot influence the result even if a caller forgets to filter it.

**Consensus.** Sum of weights per level; highest wins. Ties break toward the
more recent report, not the more severe one — biasing ties to "heavy" would
systematically overstate crowds, and the feature is only useful if people
trust it in both directions.

**Confidence.** Two independent quantities, both required:

- `mass` — total weighted evidence (30 stale reports ≠ 1 fresh one)
- `agreement` — the winner's share of that mass (10 reports split three ways
  tell you nothing, however fresh)

```
low     mass < 2  OR  agreement < 0.5
high    mass ≥ 6  AND agreement ≥ 0.7
medium  otherwise
```

**Trend.** Mean severity in the last 20 minutes vs the 20–60 minute band.
Needs ≥2 reports in each window, else `unknown`. A difference below 0.25 is
`stable`. It returns `unknown` freely — a trend derived from two reports is a
coin flip presented as insight.

**Unknown stays unknown.** `status` is nullable. "Nobody has reported
recently" is a real, common state and is not the same as "short". Collapsing
them would make the app invent a calm queue for every mandal no one has
visited — the most misleading thing this feature could do.

**No claimed queue times.** `long` renders as "Heavy" with the detail
"Devotees report a heavy crowd — 30+ min waits". The duration is attributed to
reports, never asserted as measured fact. A unit test enforces that any
duration in a label is accompanied by attribution.

---

## 4. Write path

One RPC, `submit_crowd_report()`, executable by `service_role` only. The
browser holds the anon key and **cannot call it** — verified: a direct call
with the anon key returns `42501 permission denied`. That is what makes the
application's validation, IP throttle and idempotency handling
non-bypassable.

### Atomic cooldown — the mechanism and why

A conditional upsert against a primary key:

```sql
insert into crowd_report_cooldowns (device_id, mandal_id, last_report_at)
values (...)
on conflict (device_id, mandal_id) do update
  set last_report_at = now()
  where c.last_report_at <= now() - p_cooldown
returning last_report_at;
```

Postgres takes a row lock resolving the conflict, evaluates the `WHERE`
against the committed row, and either updates and returns a row or does
neither. A concurrent caller blocks on that lock and re-evaluates against the
committed value. One statement, no lock held across statements, no cleanup
path.

Rejected alternatives:

- **Advisory locks** — correct, but held for the whole transaction and leak if
  the function raises before release.
- **Unique index on `(device_id, mandal_id, date_trunc('hour', created_at))`**
  — cheap, but implements a *fixed* hourly window: reports at 19:59 and 20:01
  would both be accepted, two minutes apart. The rule is a rolling hour.
- **SELECT then INSERT** — the exact race this table exists to prevent.

**Measured:** 30 truly parallel psql connections, same device and mandal →
**1 success, 29 cooldown, 1 row**. Through the full HTTP stack, 100 concurrent
requests → **1 success, 99 cooldown, 1 row**.

### Idempotency

`(device_id, request_id)` unique, partial. A retried request returns the
original result rather than a cooldown error for its own write. The check runs
before the cooldown claim, again after a failed claim (closing the window
where the original landed between the two), and once more in the
`unique_violation` handler.

**Measured:** 50 concurrent requests with an identical idempotency key → all
50 reported success, **1 row**.

### Defence layers

| Layer | Scope | Where |
|---|---|---|
| Per-IP, in-process | one instance | `rate-limit.ts`, 20/min |
| Per-IP, shared | all instances | `crowd_ip_throttle`, 60 / 10 min |
| Per-device global | all instances | 20 reports/hour, any mandal |
| Per-device per-mandal | all instances | 1/hour, atomic |

Blocked devices are told `rate_limited`, identical to any other throttle, so a
blocked abuser cannot detect that they were singled out and start cycling
device ids.

### ⚠️ X-Forwarded-For is only trustworthy behind a proxy

Both IP layers read `X-Forwarded-For`. Behind Vercel or Cloudflare this header
is **overwritten** and is sound. If this app is ever exposed directly to the
internet, a client can set it freely and both IP layers become bypassable.
This is why IP limiting is the outermost layer and never the only one: the
per-device cap and the atomic cooldown do not depend on it.

---

## 5. Privacy

`device_id` is a random UUID in `localStorage`. No account, no email, no
fingerprinting.

`crowd_reports` has **no public read policy at all** — only admins can select
from it. A public feed of "device X reported mandal Y at time T" is a movement
log for an anonymous person. Everyone else reads the aggregate through a
security-definer function that returns three columns, none of them
identifying.

**Verified:** anon `select device_id from crowd_reports` returns `[]`. E2E
asserts no device id and no `device` substring appears in any public API
response.

IP addresses are never stored — only a salted SHA-256 digest, and only for
throttling. Set `CROWD_IP_SALT` in production: IPv4 has ~4 billion values, so
an unsalted digest is reversible by anyone who obtains the table.

Admin surfaces show a 12-character digest rather than a raw device id.

---

## 6. Load test results

Run: `k6 v1.7.1`, MacBook (11 cores), Next.js production build, single Node
process, Supabase Postgres over the public internet, **no CDN in front**. The
load generator and the server shared the same machine.

### Read path

| Scenario | Rate | Requests | p95 | Failures | **DB queries** |
|---|---|---|---|---|---|
| Steady (models 10k users) | 500/s, 60s | 29,746 | **55.6 ms** | 0 | **4** |
| Hot mandal (§25) | 500/s, 45s | 22,416 | **63.1 ms** | 0 | **3** |
| Spike to 2,000/s | ramp, 60s | 79,122 | **61.7 ms** | 6 (0.008%) | **4** |
| Saturation | ramp to 8,000/s | 172,667 | 499 ms | 0.18% | 8 |

The headline result: **29,746 requests produced 4 database queries.** Sixty
seconds divided by a 15-second TTL is four cache windows — 701 concurrent
misses collapsed into exactly one query each. Cumulative cache hit ratio
across all runs: **98.3%**.

The hot-mandal scenario is the same story: 22,416 requests aimed at a single
popular mandal, **3 database queries**. §25 is satisfied structurally, not by
special-casing.

### Write path

| Scenario | Result |
|---|---|
| 300 reports over 5s, different devices | **301 accepted, 0 failures, p95 224 ms** |
| 100 concurrent, same device + mandal | **1 accepted, 99 cooldown, 1 row** |
| 50 concurrent, same idempotency key | **50 success, 1 row** |
| Invariant: any device with >1 report on one mandal in an hour | **0 violations** |

### Failure behaviour (§40)

Database pointed at an unreachable host:

| Endpoint | Result |
|---|---|
| `GET /api/crowd` | 503 `{"error":"Crowd information temporarily unavailable"}` |
| `POST .../report` | 503 `{"success":false,"reason":"unavailable"}` |
| `/`, `/map`, `/routes`, `/ganpati/[slug]` | **200, full content** |

No raw database error reaches a client. The mandal page renders its real
content with the crowd panel showing the unavailable message.

---

## 7. Bottlenecks found, and what they were

**The load generator, not the app.** The saturation run reported 59,808
dropped iterations — k6 could not generate the requested rate while sharing 11
cores with the server it was testing. The measured 1,559 rps ceiling is the
laptop's, not the architecture's.

**`kern.ipc.somaxconn = 128` (macOS default).** The first write burst fired
300 cold connections in the same instant; ~122 SYNs were dropped before Node
saw them, showing up as k6 status 0 with **no corresponding server error** —
the signature of a transport-level drop rather than a rejected request. Traffic
does not actually arrive that way; reshaped to 300 reports over 5 seconds, the
result was 301 accepted and zero failures.

**Remote database latency dominates the miss path.** DB p95 is ~1 s under
concurrency because Supabase is across the public internet from the test
machine. This is why p95 (55 ms) is so far above p50 (0.6 ms): the handful of
requests that miss the cache wait on that round trip. In production, `s-maxage`
plus `stale-while-revalidate` means the CDN serves the old copy while
revalidating, so a miss is not user-visible.

---

## 8. What is proven, and what is not

**Proven by measurement**, on one instance with no CDN:

- 500 rps sustained — the modelled 10,000-user read load — at p95 55 ms with
  zero failures and 4 database queries per minute.
- 2,000 rps spike absorbed with p95 62 ms.
- Cache absorbs 98.3% of reads; the database is not touched per visitor.
- The cooldown cannot be raced, through SQL or through HTTP.
- Retries cannot duplicate a report.
- The public API exposes no device identifier.
- A database outage does not take the app down.

**Not proven, and not claimed:**

- Behaviour with a real CDN in front. Every measurement above is
  origin-direct, so it is a *lower* bound: a CDN honouring `s-maxage=15`
  would reduce origin traffic by roughly another order of magnitude.
- 10,000 genuinely distinct devices on genuinely distinct connections. The
  test used ~1,500 k6 VUs on loopback.
- Multi-instance behaviour. The in-process cache and the in-process rate
  limiter are per-instance; on N instances expect N database queries per TTL
  window instead of one, and the in-process IP limit to be effectively N×.
  Neither is a correctness problem — the shared throttle table and the atomic
  cooldown are cluster-wide — but both are documented limits, not oversights.

**Scaling recommendation, in order:**

1. Put a CDN in front. Nothing else comes close for the money; the headers are
   already correct.
2. Deploy behind a proxy that overwrites `X-Forwarded-For` (§4).
3. Self-host or pin a closer Postgres — the miss path is dominated by round
   trip time, not query time.
4. Only if measurement demands it, implement `CrowdCache` against a shared
   store. The interface exists precisely so this is a new class and one line
   in `getCrowdCache()`. Do not add Redis before that measurement exists.

---

## 9. Operations

**Retention.** `cleanup_crowd_data()` deletes reports older than 30 days and
abuse signals older than 90. Not scheduled automatically — run it off-peak
from pg_cron or the admin console. Deleting during the evening peak would
compete with the write path for the same rows.

```sql
select cron.schedule('crowd-cleanup', '17 3 * * *', $$select cleanup_crowd_data()$$);
```

**Metrics.** `/api/crowd/metrics` returns counters, cache hit ratio and
latency percentiles. It 404s unless `CROWD_METRICS_TOKEN` is set *and*
supplied — an endpoint that answers "unauthorised" has confirmed it exists.
Figures are per-instance.

**Admin.** `/admin/crowd` shows volume, the current consensus per mandal,
flagged patterns, and controls to disable reporting per mandal or block a
device for 7 days. Blocks are time-boxed by default: an indefinite block on an
identifier the owner can regenerate in one tap is mostly theatre.

**Running the load tests:**

```bash
npx next start -p 3153
k6 run -e SCENARIO=steady   -e BASE=http://127.0.0.1:3153 tools/load/crowd-read.js
k6 run -e SCENARIO=hot -e HOT_MANDAL=<uuid> -e BASE=... tools/load/crowd-read.js
k6 run -e SCENARIO=burst -e MANDAL=<uuid>   -e BASE=... tools/load/crowd-write.js
```
