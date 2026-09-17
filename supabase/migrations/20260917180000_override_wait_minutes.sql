-- =====================================================================
-- Let an override carry the wait, not just the colour.
--
-- An override exists for the case where somebody from the team has gone
-- and looked. Until now all they could assert was short / moving / long,
-- and the minutes a visitor then read came from waitForLevel — this
-- mandal's curated bounds read against the asserted level. So a person
-- standing at Dagdusheth watching a forty-minute queue could set "heavy"
-- and the app would print 150 minutes at them, because that is what the
-- table says heavy means there.
--
-- The colour was right and the number was wrong, and the number is the
-- one people plan an evening around.
--
-- Nullable on purpose. Setting a colour without a wait stays exactly as
-- it was — the model fills the minutes in — so this widens what an
-- override CAN say without changing what it must.
--
-- Capped at four hours, the same ceiling crowd_wait_reports uses: beyond
-- that it is a misread form rather than a queue.
-- =====================================================================

alter table crowd_admin_overrides
  add column if not exists wait_minutes integer
  check (wait_minutes is null or (wait_minutes >= 0 and wait_minutes <= 240));

-- ---------------------------------------------------------------------
-- Write path. New parameter LAST and defaulted, so the existing
-- three-argument call sites keep working unchanged.
-- ---------------------------------------------------------------------
create or replace function set_crowd_override(
  p_mandal_id    uuid,
  p_status       text,
  p_actor        text,
  p_hold         interval default '30 minutes',
  p_cooldown     interval default '15 minutes',
  p_wait_minutes integer default null
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

  -- Validated here as well as in the column check, so a bad value comes
  -- back as a reason the caller can show rather than a constraint error.
  if p_wait_minutes is not null
     and (p_wait_minutes < 0 or p_wait_minutes > 240) then
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

  insert into crowd_admin_overrides (mandal_id, status, set_by, expires_at, wait_minutes)
  values (p_mandal_id, p_status, p_actor, v_expires, p_wait_minutes)
  returning id into v_id;

  return jsonb_build_object(
    'success', true, 'overrideId', v_id,
    'status', p_status, 'waitMinutes', p_wait_minutes, 'expiresAt', v_expires
  );
end $$;

-- ---------------------------------------------------------------------
-- Read path.
-- ---------------------------------------------------------------------
drop function if exists crowd_active_overrides(uuid[]);
create or replace function crowd_active_overrides(p_mandal_ids uuid[])
returns table (
  mandal_id    uuid,
  status       text,
  set_by       text,
  created_at   timestamptz,
  expires_at   timestamptz,
  wait_minutes integer
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (o.mandal_id)
         o.mandal_id, o.status, o.set_by, o.created_at, o.expires_at, o.wait_minutes
  from crowd_admin_overrides o
  where o.mandal_id = any(p_mandal_ids)
    and o.expires_at > now()
  order by o.mandal_id, o.created_at desc;
$$;

-- The old five-argument signature is gone; grant the new one.
revoke all on function set_crowd_override(uuid, text, text, interval, interval, integer)
  from public, anon, authenticated;
grant execute on function set_crowd_override(uuid, text, text, interval, interval, integer)
  to service_role;
grant execute on function crowd_active_overrides(uuid[]) to anon, authenticated, service_role;
