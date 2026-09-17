-- =====================================================================
-- Tighten retention, because the traffic the last windows were sized for
-- was already out of date when they shipped.
--
-- Sized this afternoon against 63,196 rows/day. The day closed at
-- 116,215 — 6.3x the day before — and at that rate 7-day retention
-- settles at ~535 MB against Supabase's 500 MB free ceiling. The cleanup
-- would have held the table steady in the wrong place: no runaway, but
-- permanently over the line, and a full database stops crowd reporting
-- for everybody.
--
-- Two changes, and they compound:
--
--   1. The general window goes 7 days -> 5. Nothing reads beyond it:
--      the admin traffic page moves to WINDOW_DAYS = 5 in the same
--      change, so the retention and the only reader still agree.
--
--   2. location_fix goes to 1 day, because the client has stopped
--      sending it entirely and the allowlist now rejects it. This window
--      exists only to clear the 44,367 rows already in the table — 30%
--      of everything — after which the event is gone and the window is
--      moot. Left in place rather than deleted outright so a stale
--      bundle still in somebody's cache cannot quietly refill it.
--
-- Together, at the measured 116,215 rows/day with location_fix no longer
-- written, steady state is roughly 390,000 rows and ~340 MB — about 30%
-- headroom, which is where this should have been sized in the first
-- place.
-- =====================================================================

create or replace function cleanup_analytics(
  -- Matches WINDOW_DAYS in app/admin/traffic. Change both or neither.
  p_retention          interval default '5 days',
  -- Only clears the backlog; the event is no longer produced.
  p_location_retention interval default '1 day'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location integer;
  v_rest     integer;
begin
  delete from analytics_events
  where name = 'location_fix' and created_at < now() - p_location_retention;
  get diagnostics v_location = row_count;

  delete from analytics_events
  where name <> 'location_fix' and created_at < now() - p_retention;
  get diagnostics v_rest = row_count;

  return jsonb_build_object(
    'location_fix_deleted', v_location,
    'other_deleted', v_rest,
    'ran_at', now()
  );
end;
$$;

revoke all on function cleanup_analytics(interval, interval) from public, anon, authenticated;
grant execute on function cleanup_analytics(interval, interval) to service_role;
