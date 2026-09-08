-- =====================================================================
-- Crowdsourced crowd intelligence.
--
-- Devotees report what the queue looks like right now; everyone else sees
-- the consensus. The whole design question is that reads outnumber writes
-- by orders of magnitude during the festival, so this schema is shaped to
-- make the read path a single cheap indexed query and the write path
-- atomic and abuse-resistant.
--
-- Deliberately NOT here: a materialised `crowd_status` table. The
-- catalogue is ~23 mandals, so aggregating every active report in the city
-- is one small query. A derived table would add write amplification and a
-- staleness window to save work that is not currently expensive. The load
-- test in tools/load/ is what should decide that, not a guess — see
-- docs/07-crowd.md.
-- =====================================================================

create type crowd_level as enum ('short', 'moving', 'long');

-- ---------------------------------------------------------------------
-- Reports
--
-- `device_id` is a random client-generated UUID. It is a de-duplication
-- signal, not an identity and not a security boundary: anyone can mint a
-- new one. It is never exposed to other users (see RLS below), which is
-- why there is no policy granting anon SELECT on this table at all.
-- ---------------------------------------------------------------------
create table crowd_reports (
  id          uuid primary key default gen_random_uuid(),

  mandal_id   uuid not null references ganpatis(id) on delete cascade,

  device_id   text not null check (device_id ~ '^[0-9a-fA-F-]{36}$'),

  status      crowd_level not null,

  -- Idempotency key for mobile retries. Null is allowed so a client that
  -- does not send one still works; when present it must be unique per
  -- device, which is what makes a retried request return the original
  -- result instead of creating a second report.
  request_id  text check (request_id is null or length(request_id) between 8 and 64),

  created_at  timestamptz not null default now()
);

-- The read path: active reports for a set of mandals. Leading mandal_id
-- means the aggregator issues one range scan per mandal rather than a
-- table scan, which is why every read query passes an explicit id list.
create index idx_crowd_reports_mandal_created
  on crowd_reports (mandal_id, created_at desc);

-- The write path: cooldown and per-device abuse checks.
create index idx_crowd_reports_device_mandal_created
  on crowd_reports (device_id, mandal_id, created_at desc);

-- Idempotency. Partial so rows without a key cost nothing.
create unique index idx_crowd_reports_device_request
  on crowd_reports (device_id, request_id)
  where request_id is not null;

-- ---------------------------------------------------------------------
-- Cooldown ledger
--
-- This table exists so the cooldown can be claimed ATOMICALLY. Checking
-- crowd_reports with a SELECT and then INSERTing is two statements: two
-- concurrent requests both read "no recent report" and both insert, and
-- the one-per-hour rule is silently broken under exactly the load where
-- it matters. See claim_crowd_cooldown() below.
--
-- One row per (device, mandal) forever rather than one per report, so it
-- stays small and the primary key is the lock target.
-- ---------------------------------------------------------------------
create table crowd_report_cooldowns (
  device_id      text not null,
  mandal_id      uuid not null references ganpatis(id) on delete cascade,
  last_report_at timestamptz not null default now(),
  primary key (device_id, mandal_id)
);

-- ---------------------------------------------------------------------
-- Abuse signals
--
-- Recorded, not acted on automatically. A burst of reports is more often
-- a group of friends at the same mandal than an attacker, and silently
-- dropping honest reports would corrupt the consensus we are trying to
-- protect. Admins review these.
-- ---------------------------------------------------------------------
create table crowd_abuse_signals (
  id         uuid primary key default gen_random_uuid(),
  device_id  text not null,
  signal     text not null,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_crowd_abuse_signals_created
  on crowd_abuse_signals (created_at desc);

-- ---------------------------------------------------------------------
-- Device blocks (admin action, §58)
-- ---------------------------------------------------------------------
create table crowd_device_blocks (
  device_id     text primary key,
  reason        text not null,
  -- Null means indefinite.
  blocked_until timestamptz,
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null
);

-- ---------------------------------------------------------------------
-- Cross-instance IP throttle
--
-- The in-process limiter in src/lib/rate-limit.ts protects one instance.
-- On a horizontally scaled deployment that is exactly wrong for a write
-- endpoint: N instances multiply the effective limit by N. This table is
-- the shared counter. It is cheap because it is only touched on writes,
-- which are the low-volume side of this system, and it avoids adding
-- Redis before load testing shows it is needed.
--
-- Fixed windows, not sliding: a sliding window needs per-request rows,
-- and the burst tolerance at a window edge is irrelevant next to the
-- product cooldown that sits behind it.
-- ---------------------------------------------------------------------
create table crowd_ip_throttle (
  ip_hash      text not null,
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (ip_hash, window_start)
);

-- ---------------------------------------------------------------------
-- Per-mandal kill switch (admin action, §58)
-- ---------------------------------------------------------------------
alter table ganpatis
  add column crowd_reporting_enabled boolean not null default true;

-- =====================================================================
-- Row Level Security
--
-- Raw reports are NEVER readable by the public: they carry device ids,
-- and a public feed of "device X reported mandal Y at time T" is a
-- movement log for an anonymous person. Only admins can read them, and
-- everyone else reads the aggregate through a security-definer function.
--
-- There is no anon INSERT policy either. Writes go through
-- submit_crowd_report(), which is executable only by service_role, so the
-- browser cannot reach this table even with the anon key in hand.
-- =====================================================================
alter table crowd_reports           enable row level security;
alter table crowd_report_cooldowns  enable row level security;
alter table crowd_abuse_signals     enable row level security;
alter table crowd_device_blocks     enable row level security;
alter table crowd_ip_throttle       enable row level security;

create policy crowd_reports_admin_read on crowd_reports
  for select using (is_admin());

create policy crowd_abuse_signals_admin_read on crowd_abuse_signals
  for select using (is_admin());

create policy crowd_device_blocks_admin_all on crowd_device_blocks
  for all using (is_admin()) with check (is_admin());

-- crowd_report_cooldowns and crowd_ip_throttle get RLS enabled and no
-- policies at all: nothing but the service role has any business reading
-- them, and an empty policy set denies everyone else by default.

-- =====================================================================
-- Atomic cooldown claim
--
-- Chosen mechanism: a conditional upsert against a primary key.
--
--   insert ... on conflict (device_id, mandal_id) do update
--     set last_report_at = now()
--     where last_report_at <= now() - cooldown
--   returning ...
--
-- Postgres takes a row lock when it resolves the conflict, evaluates the
-- WHERE against the existing row, and either updates and returns a row or
-- updates nothing and returns none. A concurrent caller blocks on that
-- row lock and then re-evaluates against the committed value, so exactly
-- one of two simultaneous requests can win. It is a single statement,
-- holds no lock across statements, and needs no advisory-lock bookkeeping.
--
-- Considered and rejected:
--   * Advisory locks — correct, but they are held for the whole
--     transaction and leak if a function raises before release. This
--     needs no cleanup path.
--   * A unique index on (device_id, mandal_id, date_trunc('hour', ...)) —
--     cheap, but it implements a FIXED hourly window: a report at 19:59
--     and another at 20:01 would both be accepted, two minutes apart.
--     The rule is a rolling hour.
--   * SELECT-then-INSERT in a transaction — the race this whole table
--     exists to prevent, unless escalated to SERIALIZABLE, which turns a
--     hot mandal into a stream of serialisation failures.
-- =====================================================================
create or replace function claim_crowd_cooldown(
  p_device_id text,
  p_mandal_id uuid,
  p_cooldown  interval
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed timestamptz;
begin
  insert into crowd_report_cooldowns as c (device_id, mandal_id, last_report_at)
  values (p_device_id, p_mandal_id, now())
  on conflict (device_id, mandal_id) do update
    set last_report_at = now()
    where c.last_report_at <= now() - p_cooldown
  returning c.last_report_at into v_claimed;

  return v_claimed is not null;
end $$;

-- =====================================================================
-- Report submission
--
-- Every rule is enforced here, server-side, in one transaction. The
-- browser cannot call this: execute is granted to service_role only, so
-- the only path in is through the application's own route handler.
--
-- Returns a structured jsonb result rather than raising, so the caller
-- never has to translate a Postgres error into a user-facing message and
-- no database detail can leak into a response (§29).
-- =====================================================================
create or replace function submit_crowd_report(
  p_mandal_id      uuid,
  p_device_id      text,
  p_status         crowd_level,
  p_request_id     text default null,
  p_ip_hash        text default null,
  p_cooldown       interval default '1 hour',
  p_device_hourly_limit integer default 20,
  p_ip_window      interval default '10 minutes',
  p_ip_limit       integer default 60
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing        crowd_reports%rowtype;
  v_report_id       uuid;
  v_last_report     timestamptz;
  v_retry_after     integer;
  v_device_count    integer;
  v_distinct_recent integer;
  v_ip_count        integer;
  v_window_start    timestamptz;
  v_enabled         boolean;
begin
  -- ---- Validate the mandal -------------------------------------------
  -- Also the cache-key guard (§53): an id that is not a published mandal
  -- never reaches the rest of the system.
  select crowd_reporting_enabled into v_enabled
  from ganpatis
  where id = p_mandal_id and published;

  if not found then
    return jsonb_build_object('success', false, 'reason', 'invalid_request');
  end if;

  if not v_enabled then
    return jsonb_build_object('success', false, 'reason', 'reporting_disabled');
  end if;

  -- ---- Device block --------------------------------------------------
  if exists (
    select 1 from crowd_device_blocks
    where device_id = p_device_id
      and (blocked_until is null or blocked_until > now())
  ) then
    -- Deliberately indistinguishable from an ordinary rate limit, so a
    -- blocked abuser cannot probe for whether they have been caught.
    return jsonb_build_object('success', false, 'reason', 'rate_limited');
  end if;

  -- ---- Idempotency (§41) ---------------------------------------------
  -- A mobile client whose response was lost retries with the same key.
  -- That must return the original outcome, not "cooldown".
  if p_request_id is not null then
    select * into v_existing from crowd_reports
    where device_id = p_device_id and request_id = p_request_id;

    if found then
      return jsonb_build_object(
        'success', true,
        'status', v_existing.status,
        'reportId', v_existing.id,
        'idempotent', true
      );
    end if;
  end if;

  -- ---- Layer 3: shared IP throttle -----------------------------------
  if p_ip_hash is not null then
    v_window_start := to_timestamp(
      floor(extract(epoch from now()) / extract(epoch from p_ip_window))
      * extract(epoch from p_ip_window)
    );

    insert into crowd_ip_throttle (ip_hash, window_start, count)
    values (p_ip_hash, v_window_start, 1)
    on conflict (ip_hash, window_start) do update
      set count = crowd_ip_throttle.count + 1
    returning count into v_ip_count;

    if v_ip_count > p_ip_limit then
      return jsonb_build_object('success', false, 'reason', 'rate_limited');
    end if;
  end if;

  -- ---- Layer 2: per-device global limit ------------------------------
  -- Stops one device from spraying every mandal in the city. Uses the
  -- (device_id, mandal_id, created_at) index.
  select count(*) into v_device_count
  from crowd_reports
  where device_id = p_device_id
    and created_at >= now() - interval '1 hour';

  if v_device_count >= p_device_hourly_limit then
    return jsonb_build_object('success', false, 'reason', 'rate_limited');
  end if;

  -- ---- Layer 1: the product rule, claimed atomically -----------------
  if not claim_crowd_cooldown(p_device_id, p_mandal_id, p_cooldown) then
    -- Lost the claim. If this is a retry of a request whose response was
    -- lost, the original row now exists — check again before reporting a
    -- cooldown, or an honest retry gets an error for its own success.
    if p_request_id is not null then
      select * into v_existing from crowd_reports
      where device_id = p_device_id and request_id = p_request_id;

      if found then
        return jsonb_build_object(
          'success', true,
          'status', v_existing.status,
          'reportId', v_existing.id,
          'idempotent', true
        );
      end if;
    end if;

    select last_report_at into v_last_report
    from crowd_report_cooldowns
    where device_id = p_device_id and mandal_id = p_mandal_id;

    v_retry_after := greatest(
      0,
      ceil(extract(epoch from (v_last_report + p_cooldown - now())))::integer
    );

    return jsonb_build_object(
      'success', false,
      'reason', 'cooldown',
      'retryAfter', v_retry_after
    );
  end if;

  -- ---- Insert ---------------------------------------------------------
  begin
    insert into crowd_reports (mandal_id, device_id, status, request_id)
    values (p_mandal_id, p_device_id, p_status, p_request_id)
    returning id into v_report_id;
  exception when unique_violation then
    -- Two retries of the same request raced past the idempotency check.
    -- The other one won; report its result rather than an error.
    select * into v_existing from crowd_reports
    where device_id = p_device_id and request_id = p_request_id;

    return jsonb_build_object(
      'success', true,
      'status', v_existing.status,
      'reportId', v_existing.id,
      'idempotent', true
    );
  end;

  -- ---- Abuse signal (§34) ---------------------------------------------
  -- Reporting many different mandals within a few minutes is physically
  -- impossible: they are minutes apart on foot at best. Recorded for
  -- admin review; the report itself still stands.
  select count(distinct mandal_id) into v_distinct_recent
  from crowd_reports
  where device_id = p_device_id
    and created_at >= now() - interval '10 minutes';

  if v_distinct_recent >= 6 then
    insert into crowd_abuse_signals (device_id, signal, detail)
    values (
      p_device_id,
      'rapid_multi_mandal',
      jsonb_build_object('distinctMandals', v_distinct_recent, 'windowMinutes', 10)
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'status', p_status,
    'reportId', v_report_id,
    'idempotent', false
  );
end $$;

-- =====================================================================
-- Read path
--
-- Returns only the three columns the aggregator needs (§26) for the
-- active window, for an explicit list of mandals so the composite index
-- is used. Device ids never leave the database.
--
-- Security definer because crowd_reports has no public read policy: this
-- function is the only sanctioned way to see report data, and it exposes
-- no identifier.
-- =====================================================================
create or replace function crowd_active_reports(
  p_mandal_ids uuid[],
  p_window     interval default '90 minutes'
) returns table (
  mandal_id  uuid,
  status     crowd_level,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.mandal_id, r.status, r.created_at
  from crowd_reports r
  where r.mandal_id = any(p_mandal_ids)
    and r.created_at >= now() - p_window
  order by r.mandal_id, r.created_at desc;
$$;

-- Cooldown state for one device, for UX only (§11). The server re-checks
-- on submit regardless of what the client believes.
create or replace function crowd_device_cooldowns(
  p_device_id  text,
  p_mandal_ids uuid[],
  p_cooldown   interval default '1 hour'
) returns table (
  mandal_id   uuid,
  retry_after integer
)
language sql
stable
security definer
set search_path = public
as $$
  select c.mandal_id,
         greatest(0, ceil(extract(epoch from (c.last_report_at + p_cooldown - now())))::integer)
  from crowd_report_cooldowns c
  where c.device_id = p_device_id
    and c.mandal_id = any(p_mandal_ids)
    and c.last_report_at > now() - p_cooldown;
$$;

-- =====================================================================
-- Admin analytics (§57)
-- =====================================================================
create or replace function crowd_admin_overview()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'reportsToday', (
      select count(*) from crowd_reports
      where created_at >= date_trunc('day', now() at time zone 'Asia/Kolkata')
    ),
    'reportsLastHour', (
      select count(*) from crowd_reports where created_at >= now() - interval '1 hour'
    ),
    'reportsLast15Min', (
      select count(*) from crowd_reports where created_at >= now() - interval '15 minutes'
    ),
    'activeMandals', (
      select count(distinct mandal_id) from crowd_reports
      where created_at >= now() - interval '90 minutes'
    ),
    'activeDevices', (
      select count(distinct device_id) from crowd_reports
      where created_at >= now() - interval '90 minutes'
    ),
    'mostReported', (
      select coalesce(jsonb_agg(x order by x.reports desc), '[]'::jsonb) from (
        select g.slug, g.name, count(*)::integer as reports
        from crowd_reports r join ganpatis g on g.id = r.mandal_id
        where r.created_at >= now() - interval '90 minutes'
        group by g.slug, g.name
        order by reports desc
        limit 10
      ) x
    ),
    'openSignals', (
      select coalesce(jsonb_agg(x order by x.last_seen desc), '[]'::jsonb) from (
        select
          -- Never expose a raw device id in an admin surface either (§58);
          -- a short digest is enough to correlate and to block.
          -- sha256() is core Postgres; pgcrypto's digest() lives in the
          -- `extensions` schema and is therefore off this function's
          -- pinned search_path.
          substr(encode(sha256(device_id::bytea), 'hex'), 1, 12) as device_digest,
          device_id,
          signal,
          count(*)::integer as occurrences,
          max(created_at) as last_seen
        from crowd_abuse_signals
        where created_at >= now() - interval '24 hours'
        group by device_id, signal
        order by last_seen desc
        limit 25
      ) x
    )
  );
$$;

-- =====================================================================
-- Retention (§36, §59)
--
-- Raw reports are anonymous behavioural data; there is no reason to keep
-- them once they can no longer inform a darshan. 30 days leaves room for
-- post-festival analysis.
--
-- Not scheduled here: run it from pg_cron in an off-peak window, or from
-- the admin console. Deleting during the evening peak would compete with
-- the write path for the same rows.
--
--   select cron.schedule('crowd-cleanup', '17 3 * * *',
--                        $$select cleanup_crowd_data()$$);
-- =====================================================================
create or replace function cleanup_crowd_data(
  p_report_retention interval default '30 days',
  p_signal_retention interval default '90 days'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reports integer;
  v_cooldowns integer;
  v_signals integer;
  v_throttle integer;
begin
  delete from crowd_reports where created_at < now() - p_report_retention;
  get diagnostics v_reports = row_count;

  -- A cooldown row older than the cooldown window can never block anyone.
  delete from crowd_report_cooldowns where last_report_at < now() - interval '1 day';
  get diagnostics v_cooldowns = row_count;

  delete from crowd_abuse_signals where created_at < now() - p_signal_retention;
  get diagnostics v_signals = row_count;

  delete from crowd_ip_throttle where window_start < now() - interval '1 day';
  get diagnostics v_throttle = row_count;

  return jsonb_build_object(
    'reports', v_reports, 'cooldowns', v_cooldowns,
    'signals', v_signals, 'throttle', v_throttle
  );
end $$;

-- =====================================================================
-- Grants
--
-- The browser holds the anon key. If anon could execute these, the
-- application's own validation, IP throttle and idempotency handling
-- could all be skipped by calling the RPC directly (§8, §52). Only the
-- service role — which exists solely on the server — may call them.
-- =====================================================================
revoke all on function submit_crowd_report(uuid, text, crowd_level, text, text, interval, integer, interval, integer) from public, anon, authenticated;
revoke all on function claim_crowd_cooldown(text, uuid, interval) from public, anon, authenticated;
revoke all on function crowd_active_reports(uuid[], interval) from public, anon, authenticated;
revoke all on function crowd_device_cooldowns(text, uuid[], interval) from public, anon, authenticated;
revoke all on function crowd_admin_overview() from public, anon, authenticated;
revoke all on function cleanup_crowd_data(interval, interval) from public, anon, authenticated;

grant execute on function submit_crowd_report(uuid, text, crowd_level, text, text, interval, integer, interval, integer) to service_role;
grant execute on function crowd_active_reports(uuid[], interval) to service_role;
grant execute on function crowd_device_cooldowns(text, uuid[], interval) to service_role;
grant execute on function crowd_admin_overview() to service_role;
grant execute on function cleanup_crowd_data(interval, interval) to service_role;
