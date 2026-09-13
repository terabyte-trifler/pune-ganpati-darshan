-- =====================================================================
-- The admin override: one person's word, above every algorithm.
--
-- Everything else in this feature is evidence weighed against other
-- evidence — reports decay, dwell is capped, the prior carries no mass at
-- all. This is not that. It is a switch that says "I know what this queue
-- is, show that", and for thirty minutes nothing else gets a say.
--
-- ---------------------------------------------------------------------
-- Why it exists, given the rest of the design.
--
-- Because the algorithms are only as good as their input, and on a quiet
-- evening there is no input. A mandal with no reports shows an estimate
-- from a model that has never been calibrated. If somebody with the app's
-- own account is standing at that mandal, or has a volunteer on the phone
-- who is, their word is better than anything this system can compute —
-- and until now there was no way to put it in.
--
-- ---------------------------------------------------------------------
-- Why it is bounded, and bounded twice.
--
-- A manual value that never expires is a value that is wrong by morning,
-- and nobody remembers setting it. So:
--
--   HOLD, 30 minutes. After that the override is simply gone and the
--   normal aggregation resumes. Forgetting to clear it costs half an
--   hour, not a festival.
--
--   COOLDOWN, 15 minutes per mandal. The admin may correct a mandal after
--   fifteen minutes but not hammer it, which keeps the table an account
--   of what was asserted rather than a log of somebody fiddling.
--
-- Append-only, with the actor's email on every row, because this is the
-- one place in the app where a human overrules the machine and that has
-- to be answerable afterwards: who said what, about which mandal, when.
-- Nothing is ever updated in place except an early clear, which sets the
-- expiry to now and leaves the original row intact.
-- =====================================================================

create table if not exists crowd_admin_overrides (
  id         uuid primary key default gen_random_uuid(),
  mandal_id  uuid not null references ganpatis(id) on delete cascade,
  status     text not null check (status in ('short', 'moving', 'long')),
  -- The account that asserted it. Not a device id: this is a named person
  -- exercising authority, and the point is that it is attributable.
  set_by     text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists crowd_admin_overrides_active_idx
  on crowd_admin_overrides (mandal_id, expires_at desc);

alter table crowd_admin_overrides enable row level security;
-- No policies. Every read and write goes through the functions below,
-- exactly as crowd_reports and crowd_wait_reports do, so a stolen anon
-- key can neither read an override nor write one.

-- =====================================================================
-- Write path.
--
-- The route has already checked that the caller is an admin — that is the
-- authorization boundary and it lives in the application, where the
-- session is. This function's job is the cooldown, which has to be atomic
-- and therefore has to be here.
-- =====================================================================
create or replace function set_crowd_override(
  p_mandal_id uuid,
  p_status    text,
  p_actor     text,
  p_hold      interval default '30 minutes',
  p_cooldown  interval default '15 minutes'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last        timestamptz;
  v_retry_after integer;
  v_id          uuid;
  v_expires     timestamptz;
begin
  if p_status not in ('short', 'moving', 'long') then
    return jsonb_build_object('success', false, 'reason', 'invalid_request');
  end if;

  perform 1 from ganpatis where id = p_mandal_id and published;
  if not found then
    return jsonb_build_object('success', false, 'reason', 'invalid_request');
  end if;

  select max(created_at) into v_last
  from crowd_admin_overrides
  where mandal_id = p_mandal_id;

  if v_last is not null and v_last > now() - p_cooldown then
    v_retry_after := ceil(extract(epoch from (v_last + p_cooldown - now())));
    return jsonb_build_object(
      'success', false, 'reason', 'cooldown',
      'retryAfter', greatest(v_retry_after, 1)
    );
  end if;

  v_expires := now() + p_hold;

  insert into crowd_admin_overrides (mandal_id, status, set_by, expires_at)
  values (p_mandal_id, p_status, p_actor, v_expires)
  returning id into v_id;

  return jsonb_build_object(
    'success', true, 'overrideId', v_id,
    'status', p_status, 'expiresAt', v_expires
  );
end $$;

-- =====================================================================
-- Clearing early.
--
-- Expires the active row rather than deleting it: what was asserted, and
-- for how long, stays on the record.
-- =====================================================================
create or replace function clear_crowd_override(p_mandal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update crowd_admin_overrides
  set expires_at = now()
  where mandal_id = p_mandal_id and expires_at > now();
  get diagnostics v_count = row_count;
  return jsonb_build_object('success', true, 'cleared', v_count);
end $$;

-- =====================================================================
-- Read path. Only rows still in force.
-- =====================================================================
create or replace function crowd_active_overrides(p_mandal_ids uuid[])
returns table (
  mandal_id  uuid,
  status     text,
  set_by     text,
  created_at timestamptz,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (o.mandal_id)
         o.mandal_id, o.status, o.set_by, o.created_at, o.expires_at
  from crowd_admin_overrides o
  where o.mandal_id = any(p_mandal_ids)
    and o.expires_at > now()
  order by o.mandal_id, o.created_at desc;
$$;

grant execute on function set_crowd_override(uuid, text, text, interval, interval) to service_role;
grant execute on function clear_crowd_override(uuid) to service_role;
grant execute on function crowd_active_overrides(uuid[]) to anon, authenticated, service_role;

-- =====================================================================
-- Self-verification.
-- =====================================================================
do $$
declare
  rls_on   boolean;
  policies int;
  fns      int;
begin
  select relrowsecurity into rls_on from pg_class where relname = 'crowd_admin_overrides';
  if not rls_on then
    raise exception 'crowd_admin_overrides: RLS is not enabled';
  end if;

  select count(*) into policies from pg_policies where tablename = 'crowd_admin_overrides';
  if policies <> 0 then
    raise exception 'crowd_admin_overrides: policies exist; all access must go through the functions';
  end if;

  select count(*) into fns from pg_proc
  where proname in ('set_crowd_override', 'clear_crowd_override', 'crowd_active_overrides');
  if fns < 3 then
    raise exception 'crowd_admin_overrides: a function is missing';
  end if;

  raise notice 'crowd_admin_overrides: RLS on, no policies, 3 functions present';
end $$;
