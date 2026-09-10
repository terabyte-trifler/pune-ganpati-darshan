-- =====================================================================
-- HOTFIX. Restores submit_crowd_report on top of the CURRENT function.
--
-- The previous migration in this pair rebuilt the function from
-- 20260909120000, not realising 20260909170000 had already superseded it:
-- that later migration replaced the per-feature `crowd_ip_throttle` table
-- with the shared `rate_limit_buckets` and dropped the old one. The rebuilt
-- function therefore referenced a table that no longer exists, and every
-- report carrying an IP hash — which is every report from the app — failed
-- with 503.
--
-- This version is derived from the shared_rate_limits definition, which is
-- the authoritative one, with p_at_mandal added.
-- =====================================================================

drop function if exists submit_crowd_report(
  uuid, text, crowd_level, text, text, boolean, interval, integer, interval, integer
);
drop function if exists submit_crowd_report(
  uuid, text, crowd_level, text, text, interval, integer, interval, integer
);

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
    insert into crowd_reports (mandal_id, device_id, status, request_id, at_mandal)
    values (p_mandal_id, p_device_id, p_status, p_request_id, coalesce(p_at_mandal, false))
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

revoke all on function submit_crowd_report(
  uuid, text, crowd_level, text, text, boolean, interval, integer, interval, integer
) from public, anon, authenticated;

grant execute on function submit_crowd_report(
  uuid, text, crowd_level, text, text, boolean, interval, integer, interval, integer
) to service_role;
