-- =====================================================================
-- Two changes, one small and one deliberately inert.
--
-- 1. A reading needs two devices. A single report is information, but it
--    is not a reading, and the app currently promotes one tap to "Short"
--    with a confidence label beside it. That is the whole of the
--    manipulation exposure: a quiet mandal with two or three genuine
--    reports can be outvoted by one person opening incognito windows,
--    because every fresh browser profile is a fresh identity.
--
--    This does not stop that person. It raises the floor, so a mandal
--    nobody has really reported cannot be conjured out of one tap.
--
-- 2. Device tenure is RECORDED but not yet used. crowd_devices remembers
--    when a device first reported, and every report is stamped with how
--    old its device was at the time.
--
--    Weighting by that is the real fix — a browser profile minted ten
--    seconds ago should not count like a phone that has been reporting
--    all evening — but the weights cannot be chosen yet. The festival
--    has not started, there is no honest traffic to calibrate against,
--    and picking 0.3 out of the air and shipping it four days before
--    Ganeshotsav risks the tracker itself. So the signal is collected
--    now and the policy is decided from one evening of real data.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Devices
--
-- One row per device, holding the only thing worth remembering about it:
-- when it first reported. No IP, no location, no account — the id itself
-- is a UUID the browser generated and can throw away at any time.
-- ---------------------------------------------------------------------
create table if not exists crowd_devices (
  device_id     text primary key,
  first_seen_at timestamptz not null default now(),
  report_count  integer not null default 0
);

alter table crowd_devices enable row level security;
-- No policy: the table is reachable only through security-definer
-- functions. Nothing in the browser has any business reading it.

comment on table crowd_devices is
  'When each reporting device was first seen. Written by submit_crowd_report; '
  'read by nothing yet. Exists so report weighting can be calibrated against '
  'real festival traffic rather than guessed at beforehand.';

-- How old the device was when this report was made. Null for every report
-- written before this migration, which is the honest value for them.
alter table crowd_reports
  add column if not exists device_age_seconds integer;

comment on column crowd_reports.device_age_seconds is
  'Seconds between the device''s first ever report and this one. 0 means '
  'this was its first. Recorded for calibration; not yet used in scoring.';

-- ---------------------------------------------------------------------
-- 2. Reads gain a device sequence
--
-- The aggregator needs to know how many DISTINCT devices back a reading,
-- and must not be told which. dense_rank over device_id gives 1, 2, 3…
-- per mandal per window: countable, and meaningless outside this query.
-- Raw device ids continue never to leave the database.
-- ---------------------------------------------------------------------
-- Dropped first, not replaced. Adding columns to a `returns table`
-- changes the function's row type, and Postgres refuses that through
-- `create or replace`:
--
--   42P13: cannot change return type of existing function
--
-- The drop and the create are in one transaction, so no request can
-- arrive between them and find the function missing.
drop function if exists crowd_active_reports(uuid[], interval);

create function crowd_active_reports(
  p_mandal_ids uuid[],
  p_window     interval default '90 minutes'
) returns table (
  mandal_id          uuid,
  status             crowd_level,
  created_at         timestamptz,
  at_mandal          boolean,
  device_seq         integer,
  device_age_seconds integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.mandal_id,
    r.status,
    r.created_at,
    r.at_mandal,
    dense_rank() over (partition by r.mandal_id order by r.device_id)::integer,
    r.device_age_seconds
  from crowd_reports r
  where r.mandal_id = any(p_mandal_ids)
    and r.created_at >= now() - p_window
  order by r.mandal_id, r.created_at desc;
$$;

revoke all on function crowd_active_reports(uuid[], interval) from public, anon, authenticated;
grant execute on function crowd_active_reports(uuid[], interval) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. submit_crowd_report records the device
--
-- Rebuilt from the definition in 20260910130000, which is the newest one
-- and therefore the truth. Only the insert changes.
-- ---------------------------------------------------------------------
create or replace function submit_crowd_report(
  p_mandal_id      uuid,
  p_device_id      text,
  p_status         crowd_level,
  p_request_id     text default null,
  p_ip_hash        text default null,
  p_at_mandal      boolean default false,
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
  v_first_seen      timestamptz;
  v_device_age      integer;
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

  -- ---- Remember the device --------------------------------------------
  -- first_seen_at is set by the database on the device's first ever
  -- report and never moves. Nothing the client sends can influence it,
  -- which is the point: tenure has to be something a fresh browser
  -- profile cannot claim.
  insert into crowd_devices (device_id, report_count)
  values (p_device_id, 1)
  on conflict (device_id) do update
    set report_count = crowd_devices.report_count + 1
  returning first_seen_at into v_first_seen;

  -- Stamped onto the report rather than joined at read time: /api/crowd
  -- aggregates every mandal on the hot path, and a report's credibility
  -- is what it was when it was made, not what the device became later.
  v_device_age := greatest(0, extract(epoch from (now() - v_first_seen))::integer);

  -- ---- Insert ---------------------------------------------------------
  begin
    insert into crowd_reports (mandal_id, device_id, status, request_id, at_mandal, device_age_seconds)
    values (p_mandal_id, p_device_id, p_status, p_request_id, coalesce(p_at_mandal, false), v_device_age)
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
-- Proof, in the same transaction.
--
-- The failure worth guarding is a silent one: the function rebuilt but
-- the device never recorded, so a column of nulls accumulates through the
-- festival and there is nothing to calibrate against afterwards.
-- ---------------------------------------------------------------------
do $$
declare
  v_mandal uuid;
  v_device text := 'aaaaaaaa-1111-4111-8111-' || substr(md5(random()::text), 1, 12);
  v_first  jsonb;
  v_age    integer;
  v_seen   timestamptz;
begin
  select id into v_mandal from ganpatis where published and crowd_reporting_enabled limit 1;
  if v_mandal is null then
    raise notice 'No reportable mandal; skipping the live check.';
    return;
  end if;

  v_first := submit_crowd_report(v_mandal, v_device, 'short'::crowd_level);
  if not (v_first->>'success')::boolean then
    raise exception 'Verification report was refused: %', v_first;
  end if;

  select first_seen_at into v_seen from crowd_devices where device_id = v_device;
  if v_seen is null then
    raise exception 'Device was not recorded in crowd_devices';
  end if;

  select device_age_seconds into v_age
  from crowd_reports where device_id = v_device;
  if v_age is null then
    raise exception 'Report was not stamped with a device age';
  end if;
  if v_age <> 0 then
    raise exception 'A first report should be age 0, got %', v_age;
  end if;

  -- Leave nothing behind.
  delete from crowd_reports where device_id = v_device;
  delete from crowd_report_cooldowns where device_id = v_device;
  delete from crowd_devices where device_id = v_device;

  raise notice 'Verified: devices are recorded and reports are stamped with their age.';
end $$;
