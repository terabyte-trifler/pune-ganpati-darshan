-- =====================================================================
-- How long people actually waited.
--
-- Phase 3. Every other signal asks for a judgement about a queue somebody
-- is looking at — short, moving, heavy. This asks for a number they know:
-- how long they stood there. It is the only report in the app that can be
-- wrong in a way the reporter would notice themselves.
--
-- ---------------------------------------------------------------------
-- Why it is worth more than a colour, and why it is stored separately.
--
-- A colour is an opinion about a queue. Minutes are a measurement of one,
-- taken by the person who did the waiting, after the fact — so there is
-- no "is it heavy or just moving" judgement to disagree about. That is
-- why aggregation weights it above an ordinary report.
--
-- It also does something no other signal can: it fills the catalogue's
-- worst gap. 11 of 29 mandals have no darshan_minutes at all, and the 18
-- that do were estimated rather than timed. A festival of these reports
-- turns both into observed numbers — see /admin/crowd-score for the
-- comparison.
--
-- Separate table rather than a nullable column on crowd_reports, because
-- the two are different claims with different lifetimes: a colour expires
-- in 90 minutes, a wait time is evidence about this mandal for the rest
-- of the festival and beyond it.
--
-- ---------------------------------------------------------------------
-- Device id, deliberately, unlike the dwell samples.
--
-- crowd_dwell_samples is device-less because nothing there is displayed
-- and so nothing is worth gaming. This is displayed and it moves the
-- colour, so it needs the same protection crowd_reports has: one report
-- per device per mandal per visit, and a way to block a device that
-- abuses it. The id is the same opaque per-device value used there and is
-- never exposed outside the database.
-- =====================================================================

create table if not exists crowd_wait_reports (
  id          uuid primary key default gen_random_uuid(),
  mandal_id   uuid not null references ganpatis(id) on delete cascade,
  device_id   text not null,
  -- Minutes queued. Capped at four hours: beyond that it is a
  -- misunderstanding of the question rather than a queue, and one absurd
  -- number drags a median further than ten honest ones.
  minutes     integer not null check (minutes >= 0 and minutes <= 240),
  request_id  text,
  created_at  timestamptz not null default now()
);

create index if not exists crowd_wait_reports_mandal_time_idx
  on crowd_wait_reports (mandal_id, created_at desc);
create index if not exists crowd_wait_reports_device_idx
  on crowd_wait_reports (device_id, created_at desc);

-- Idempotency: a retried submission must not count twice.
create unique index if not exists crowd_wait_reports_request_idx
  on crowd_wait_reports (request_id) where request_id is not null;

alter table crowd_wait_reports enable row level security;
-- No policies at all: every read and write goes through the security
-- definer functions below, exactly as crowd_reports does. A stolen anon
-- key can neither read these rows nor insert one.

-- =====================================================================
-- Write path.
-- =====================================================================
create or replace function submit_wait_report(
  p_mandal_id  uuid,
  p_device_id  text,
  p_minutes    integer,
  p_request_id text default null,
  p_ip_hash    text default null,
  -- A visit, not an hour: someone who queues at the same mandal twice in
  -- an evening is rare, and someone submitting twice in twenty minutes is
  -- correcting themselves or gaming it.
  p_cooldown   interval default '2 hours',
  p_device_daily_limit integer default 30,
  p_ip_window  interval default '10 minutes',
  p_ip_limit   integer default 60
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enabled      boolean;
  v_existing     crowd_wait_reports%rowtype;
  v_last         timestamptz;
  v_retry_after  integer;
  v_device_count integer;
  v_blocked      boolean;
  v_throttle     jsonb;
  v_id           uuid;
begin
  if p_minutes is null or p_minutes < 0 or p_minutes > 240 then
    return jsonb_build_object('success', false, 'reason', 'invalid_request');
  end if;

  select crowd_reporting_enabled into v_enabled
  from ganpatis where id = p_mandal_id and published;
  if not found then
    return jsonb_build_object('success', false, 'reason', 'invalid_request');
  end if;
  if not v_enabled then
    return jsonb_build_object('success', false, 'reason', 'reporting_disabled');
  end if;

  -- A device blocked for abusing crowd reports is blocked here too: it is
  -- the same person and the same protection.
  select exists (select 1 from crowd_device_blocks where device_id = p_device_id)
    into v_blocked;
  if v_blocked then
    return jsonb_build_object('success', false, 'reason', 'rate_limited');
  end if;

  if p_ip_hash is not null then
    v_throttle := consume_rate_limit('crowd-wait', p_ip_hash, p_ip_window, p_ip_limit);
    if not (v_throttle->>'allowed')::boolean then
      return jsonb_build_object('success', false, 'reason', 'rate_limited');
    end if;
  end if;

  -- Idempotent retry: the same request id returns the original result
  -- rather than a second row.
  if p_request_id is not null then
    select * into v_existing from crowd_wait_reports where request_id = p_request_id;
    if found then
      return jsonb_build_object(
        'success', true, 'minutes', v_existing.minutes,
        'reportId', v_existing.id, 'idempotent', true
      );
    end if;
  end if;

  select max(created_at) into v_last
  from crowd_wait_reports
  where device_id = p_device_id and mandal_id = p_mandal_id;

  if v_last is not null and v_last > now() - p_cooldown then
    v_retry_after := ceil(extract(epoch from (v_last + p_cooldown - now())));
    return jsonb_build_object(
      'success', false, 'reason', 'cooldown', 'retryAfter', greatest(v_retry_after, 1)
    );
  end if;

  select count(*) into v_device_count
  from crowd_wait_reports
  where device_id = p_device_id and created_at > now() - interval '24 hours';
  if v_device_count >= p_device_daily_limit then
    return jsonb_build_object('success', false, 'reason', 'rate_limited');
  end if;

  insert into crowd_wait_reports (mandal_id, device_id, minutes, request_id)
  values (p_mandal_id, p_device_id, p_minutes, p_request_id)
  returning id into v_id;

  return jsonb_build_object(
    'success', true, 'minutes', p_minutes, 'reportId', v_id, 'idempotent', false
  );
end $$;

-- =====================================================================
-- Read path.
--
-- Two windows on purpose. `p_window` is the live one the tracker uses;
-- the calibration view asks for a long window because a wait time from
-- yesterday evening still says something about this mandal, while a
-- colour from yesterday says nothing.
-- =====================================================================
create or replace function crowd_wait_reports_recent(
  p_mandal_ids uuid[],
  p_window     interval default '90 minutes'
) returns table (
  mandal_id  uuid,
  minutes    integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select w.mandal_id, w.minutes, w.created_at
  from crowd_wait_reports w
  where w.mandal_id = any(p_mandal_ids)
    and w.created_at >= now() - p_window
  order by w.mandal_id, w.created_at desc;
$$;

grant execute on function submit_wait_report(uuid, text, integer, text, text, interval, integer, interval, integer) to anon, authenticated, service_role;
grant execute on function crowd_wait_reports_recent(uuid[], interval) to anon, authenticated, service_role;

-- =====================================================================
-- Self-verification.
-- =====================================================================
do $$
declare
  rls_on boolean;
  policies int;
  has_fn int;
begin
  select relrowsecurity into rls_on from pg_class where relname = 'crowd_wait_reports';
  if not rls_on then
    raise exception 'crowd_wait_reports: RLS is not enabled';
  end if;

  select count(*) into policies from pg_policies where tablename = 'crowd_wait_reports';
  if policies <> 0 then
    raise exception 'crowd_wait_reports: policies exist; all access must go through the functions';
  end if;

  select count(*) into has_fn from pg_proc
  where proname in ('submit_wait_report', 'crowd_wait_reports_recent');
  if has_fn < 2 then
    raise exception 'crowd_wait_reports: the read or write function is missing';
  end if;

  raise notice 'crowd_wait_reports: RLS on, no policies, both functions present';
end $$;
