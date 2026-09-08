-- =====================================================================
-- Shared rate limiting
--
-- `src/lib/rate-limit.ts` counts in process memory. That is correct for
-- one instance and quietly wrong for several: N instances multiply every
-- limit by N, and which instance a request lands on is arbitrary. For a
-- write endpoint that is the difference between a limit and a suggestion.
--
-- This replaces it with a counter in Postgres — the store every instance
-- already shares. Redis would be the reflex, but it would be a new piece
-- of infrastructure to run, pay for and monitor for a workload of a few
-- hundred writes an evening; the brief's own instruction is not to add it
-- before measurement demands it, and nothing here does.
--
-- Generalises the crowd-specific `crowd_ip_throttle` introduced earlier,
-- which was the same idea with a narrower name. One mechanism is better
-- than two that drift.
-- =====================================================================

create table rate_limit_buckets (
  -- What is being limited: 'crowd-report', 'plans', … Namespaces the key
  -- so the same IP has independent budgets per endpoint.
  bucket       text not null check (length(bucket) between 1 and 64),
  -- A salted digest of the caller, never a raw address.
  key_hash     text not null check (length(key_hash) between 8 and 128),
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (bucket, key_hash, window_start)
);

-- Fixed windows, not sliding: a sliding window needs a row per request,
-- and the burst tolerance at a window edge is irrelevant next to the
-- per-device rules sitting behind this.
create index idx_rate_limit_buckets_window on rate_limit_buckets (window_start);

alter table rate_limit_buckets enable row level security;
-- No policies: only the service role has any business touching this, and
-- an empty policy set denies everyone else by default.

-- ---------------------------------------------------------------------
-- Consume one unit from a bucket.
--
-- Returns true when the request is allowed. Atomic: the upsert increments
-- and returns the new count in a single statement, so two concurrent
-- callers cannot both read the same pre-increment value.
-- ---------------------------------------------------------------------
create or replace function consume_rate_limit(
  p_bucket   text,
  p_key_hash text,
  p_window   interval,
  p_limit    integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count        integer;
begin
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / extract(epoch from p_window))
    * extract(epoch from p_window)
  );

  insert into rate_limit_buckets (bucket, key_hash, window_start, count)
  values (p_bucket, p_key_hash, v_window_start, 1)
  on conflict (bucket, key_hash, window_start) do update
    set count = rate_limit_buckets.count + 1
  returning count into v_count;

  return jsonb_build_object(
    'allowed', v_count <= p_limit,
    'remaining', greatest(0, p_limit - v_count),
    'retryAfter', greatest(
      1,
      ceil(extract(epoch from (v_window_start + p_window - now())))::integer
    )
  );
end $$;

-- ---------------------------------------------------------------------
-- Point the crowd RPC at the shared table.
--
-- Only the throttle block changes; every other rule is untouched.
-- ---------------------------------------------------------------------
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
  v_throttle        jsonb;
  v_enabled         boolean;
begin
  -- ---- Validate the mandal -------------------------------------------
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
    -- Indistinguishable from an ordinary rate limit, so a blocked abuser
    -- cannot probe for whether they have been caught.
    return jsonb_build_object('success', false, 'reason', 'rate_limited');
  end if;

  -- ---- Idempotency (§41) ---------------------------------------------
  if p_request_id is not null then
    select * into v_existing from crowd_reports
    where device_id = p_device_id and request_id = p_request_id;

    if found then
      return jsonb_build_object(
        'success', true, 'status', v_existing.status,
        'reportId', v_existing.id, 'idempotent', true
      );
    end if;
  end if;

  -- ---- Layer 3: shared IP throttle -----------------------------------
  if p_ip_hash is not null then
    v_throttle := consume_rate_limit('crowd-report', p_ip_hash, p_ip_window, p_ip_limit);
    if not (v_throttle->>'allowed')::boolean then
      return jsonb_build_object('success', false, 'reason', 'rate_limited');
    end if;
  end if;

  -- ---- Layer 2: per-device global limit ------------------------------
  select count(*) into v_device_count
  from crowd_reports
  where device_id = p_device_id
    and created_at >= now() - interval '1 hour';

  if v_device_count >= p_device_hourly_limit then
    return jsonb_build_object('success', false, 'reason', 'rate_limited');
  end if;

  -- ---- Layer 1: the product rule, claimed atomically -----------------
  if not claim_crowd_cooldown(p_device_id, p_mandal_id, p_cooldown) then
    -- A retry whose response was lost has already written its row; check
    -- before reporting a cooldown, or an honest retry gets an error for
    -- its own success.
    if p_request_id is not null then
      select * into v_existing from crowd_reports
      where device_id = p_device_id and request_id = p_request_id;

      if found then
        return jsonb_build_object(
          'success', true, 'status', v_existing.status,
          'reportId', v_existing.id, 'idempotent', true
        );
      end if;
    end if;

    select last_report_at into v_last_report
    from crowd_report_cooldowns
    where device_id = p_device_id and mandal_id = p_mandal_id;

    v_retry_after := greatest(
      0, ceil(extract(epoch from (v_last_report + p_cooldown - now())))::integer
    );

    return jsonb_build_object(
      'success', false, 'reason', 'cooldown', 'retryAfter', v_retry_after
    );
  end if;

  -- ---- Insert ---------------------------------------------------------
  begin
    insert into crowd_reports (mandal_id, device_id, status, request_id)
    values (p_mandal_id, p_device_id, p_status, p_request_id)
    returning id into v_report_id;
  exception when unique_violation then
    select * into v_existing from crowd_reports
    where device_id = p_device_id and request_id = p_request_id;

    return jsonb_build_object(
      'success', true, 'status', v_existing.status,
      'reportId', v_existing.id, 'idempotent', true
    );
  end;

  -- ---- Abuse signal (§34) ---------------------------------------------
  select count(distinct mandal_id) into v_distinct_recent
  from crowd_reports
  where device_id = p_device_id
    and created_at >= now() - interval '10 minutes';

  if v_distinct_recent >= 6 then
    insert into crowd_abuse_signals (device_id, signal, detail)
    values (
      p_device_id, 'rapid_multi_mandal',
      jsonb_build_object('distinctMandals', v_distinct_recent, 'windowMinutes', 10)
    );
  end if;

  return jsonb_build_object(
    'success', true, 'status', p_status,
    'reportId', v_report_id, 'idempotent', false
  );
end $$;

-- ---------------------------------------------------------------------
-- Retention now sweeps the shared table.
-- ---------------------------------------------------------------------
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

  delete from crowd_report_cooldowns where last_report_at < now() - interval '1 day';
  get diagnostics v_cooldowns = row_count;

  delete from crowd_abuse_signals where created_at < now() - p_signal_retention;
  get diagnostics v_signals = row_count;

  delete from rate_limit_buckets where window_start < now() - interval '1 day';
  get diagnostics v_throttle = row_count;

  return jsonb_build_object(
    'reports', v_reports, 'cooldowns', v_cooldowns,
    'signals', v_signals, 'rateLimits', v_throttle
  );
end $$;

-- The narrower table is now unused.
drop table if exists crowd_ip_throttle;

-- ---------------------------------------------------------------------
-- Grants. As before: the browser holds the anon key, so it must not be
-- able to reach anything that enforces a limit.
-- ---------------------------------------------------------------------
revoke all on function consume_rate_limit(text, text, interval, integer) from public, anon, authenticated;
grant execute on function consume_rate_limit(text, text, interval, integer) to service_role;
