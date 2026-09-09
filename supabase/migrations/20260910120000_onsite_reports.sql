-- =====================================================================
-- On-site reports carry more weight.
--
-- A report from someone standing at the gate is direct observation. A
-- report from someone at home is, at best, second-hand. Both are worth
-- having — the "Seen any of these?" prompt deliberately invites the second
-- kind from people who walked past — but they are not equal evidence, and
-- until now the consensus treated them identically.
--
-- `at_mandal` records which one a report was. The aggregator halves the
-- weight of anything not submitted on site, so ten people at the gate
-- outweigh twenty guessing.
--
-- ---------------------------------------------------------------------
-- On trusting the flag.
--
-- It is asserted by the client, exactly like `device_id`, and is a QUALITY
-- HINT rather than a security boundary. Anyone can POST `atMandal: true`.
-- That is acceptable for the same reason a forged device id is: the value
-- of forging it is capped by the rules that sit behind it. One report per
-- device per mandal per hour means the most a liar buys is one extra unit
-- of weight on one mandal — and someone willing to forge this could just
-- as easily mint device ids, which the existing throttles already handle.
--
-- The alternative was to send coordinates and verify the distance
-- server-side. That was rejected: it would put every reporter's position
-- in the request path and the logs, to defend a weighting hint. A boolean
-- leaks nothing about where anyone was standing beyond "near this mandal,
-- which they just told you about anyway".
-- =====================================================================

alter table crowd_reports
  add column if not exists at_mandal boolean not null default false;

comment on column crowd_reports.at_mandal is
  'True when the client believed it was within ~100m at submission time. A '
  'quality hint for weighting, never a security boundary: client-asserted '
  'and not verified.';

-- ---------------------------------------------------------------------
-- Both functions must be DROPPED, not replaced.
--
-- `create or replace` only replaces a function with an identical argument
-- list. Adding a defaulted parameter creates an OVERLOAD instead, and the
-- old nine-argument call then matches both — Postgres rejects it as
-- ambiguous and every report starts failing. Same for the read function:
-- changing its return columns is not a replacement either.
-- ---------------------------------------------------------------------
drop function if exists submit_crowd_report(
  uuid, text, crowd_level, text, text, interval, integer, interval, integer
);
drop function if exists crowd_active_reports(uuid[], interval);

-- =====================================================================
-- Read path, now carrying provenance.
-- =====================================================================
create or replace function crowd_active_reports(
  p_mandal_ids uuid[],
  p_window     interval default '90 minutes'
) returns table (
  mandal_id  uuid,
  status     crowd_level,
  created_at timestamptz,
  at_mandal  boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select r.mandal_id, r.status, r.created_at, r.at_mandal
  from crowd_reports r
  where r.mandal_id = any(p_mandal_ids)
    and r.created_at >= now() - p_window
  order by r.mandal_id, r.created_at desc;
$$;

-- =====================================================================
-- Write path. Identical to the previous version except that it accepts
-- and stores p_at_mandal; every rule, layer and idempotency path is
-- unchanged.
-- =====================================================================
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
  v_ip_count        integer;
  v_window_start    timestamptz;
  v_enabled         boolean;
begin
  select crowd_reporting_enabled into v_enabled
  from ganpatis
  where id = p_mandal_id and published;

  if not found then
    return jsonb_build_object('success', false, 'reason', 'invalid_request');
  end if;

  if not v_enabled then
    return jsonb_build_object('success', false, 'reason', 'reporting_disabled');
  end if;

  if exists (
    select 1 from crowd_device_blocks
    where device_id = p_device_id
      and (blocked_until is null or blocked_until > now())
  ) then
    return jsonb_build_object('success', false, 'reason', 'rate_limited');
  end if;

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

  select count(*) into v_device_count
  from crowd_reports
  where device_id = p_device_id
    and created_at >= now() - interval '1 hour';

  if v_device_count >= p_device_hourly_limit then
    return jsonb_build_object('success', false, 'reason', 'rate_limited');
  end if;

  if not claim_crowd_cooldown(p_device_id, p_mandal_id, p_cooldown) then
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

  begin
    insert into crowd_reports (mandal_id, device_id, status, request_id, at_mandal)
    values (p_mandal_id, p_device_id, p_status, p_request_id, coalesce(p_at_mandal, false))
    returning id into v_report_id;
  exception when unique_violation then
    select * into v_existing from crowd_reports
    where device_id = p_device_id and request_id = p_request_id;

    return jsonb_build_object(
      'success', true,
      'status', v_existing.status,
      'reportId', v_existing.id,
      'idempotent', true
    );
  end;

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

revoke all on function submit_crowd_report(
  uuid, text, crowd_level, text, text, boolean, interval, integer, interval, integer
) from public, anon, authenticated;

grant execute on function submit_crowd_report(
  uuid, text, crowd_level, text, text, boolean, interval, integer, interval, integer
) to service_role;

revoke all on function crowd_active_reports(uuid[], interval) from public, anon, authenticated;
grant execute on function crowd_active_reports(uuid[], interval) to service_role;
