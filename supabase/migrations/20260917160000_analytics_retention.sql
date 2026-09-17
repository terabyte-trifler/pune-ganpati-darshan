-- =====================================================================
-- Retention for analytics_events, and a schedule that actually runs.
--
-- WHY THIS IS URGENT RATHER THAN TIDY
--
-- analytics_events is the only table in the product that grows without
-- bound, and it accelerated sharply during the festival:
--
--     14 Sep    5,390 rows
--     15 Sep    4,189
--     16 Sep   18,584
--     17 Sep   63,196
--
-- Measured at 44 MB for 28,909 rows, i.e. ~871 bytes/row with index
-- overhead. Supabase's free tier stops at 500 MB, and a full database
-- does not degrade gracefully — crowd reporting stops for everybody.
-- Projected at the 17 Sep rate with no retention at all, the table
-- reaches ~520 MB by visarjan. It is the only quota in the project on
-- course to be breached.
--
-- WHY THESE WINDOWS, AND NOT ROUNDER ONES
--
-- Nothing reads analytics older than seven days. The admin traffic page
-- fixes WINDOW_DAYS = 7 and traffic_origin_overview defaults to
-- '7 days'; there is no other consumer of this table anywhere in the
-- app. So seven days is not a guess, it is the horizon the product
-- actually uses.
--
-- location_fix gets two. It is 33% of all rows — the largest single
-- event by some distance — and nothing reads it by name at all. It
-- exists to answer "is location acquisition fast, slow, or hopeless",
-- which is a distribution: two days of festival traffic is tens of
-- thousands of samples, and a third day adds no knowledge.
--
-- Sampling was measured and rejected. 22% of sessions emit location_fix
-- and nothing else, and traffic_origin_overview counts sessions with
-- count(distinct session_id) — so dropping rows on the way in would have
-- silently undercounted visitors by about a fifth. Expiring them later
-- costs nothing and keeps every session represented while it matters.
--
-- At the measured 63,196 rows/day this holds the table near 300 MB, with
-- roughly 40% headroom. Flat 14-day retention reaches 755 MB and flat
-- 30-day 1.6 GB; neither fits.
-- =====================================================================

create or replace function cleanup_analytics(
  -- The admin window. Anything older has no reader.
  p_retention          interval default '7 days',
  -- Pure instrumentation, never read by name, a third of all rows.
  p_location_retention interval default '2 days'
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

-- Service role only, like every other maintenance function here.
revoke all on function cleanup_analytics(interval, interval) from public, anon, authenticated;
grant execute on function cleanup_analytics(interval, interval) to service_role;

-- NO NEW INDEX. The delete scans by (name, created_at), and
-- analytics_events_name_idx (name, created_at desc) has covered exactly
-- that since init.sql — a b-tree is scannable in either direction, so the
-- DESC makes no difference to this predicate. Adding a second one would
-- have cost a write on all ~63,000 inserts a day and more storage on the
-- one table this migration exists to keep small.
--
-- Left alone deliberately: analytics_events_ganpati_idx (full) overlaps
-- analytics_events_ganpati_created_idx (partial, ganpati_id is not null).
-- The partial one is the better index and the full one is mostly indexing
-- NULLs, since the majority of events carry no mandal — but dropping an
-- index on the busiest table mid-festival is a risk out of proportion to
-- the few MB it would return. Revisit after 25 September.

-- =====================================================================
-- Schedule it. 03:12 and 03:20 IST — well clear of the darshan evening,
-- which is when the write path is busiest and when a delete competing
-- for the same pages would be felt.
--
-- cleanup_crowd_data() has existed since 9 September with a commented-out
-- cron line and was never scheduled, so the crowd tables have never been
-- pruned either. Both are scheduled here.
--
-- Guarded: if pg_cron is not enabled on the project the migration still
-- applies, and the functions can be run by hand from the SQL editor.
-- =====================================================================
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('analytics-cleanup')
      where exists (select 1 from cron.job where jobname = 'analytics-cleanup');
    perform cron.unschedule('crowd-cleanup')
      where exists (select 1 from cron.job where jobname = 'crowd-cleanup');

    -- 21:42 UTC = 03:12 IST
    perform cron.schedule('analytics-cleanup', '42 21 * * *',
                          $job$select cleanup_analytics()$job$);
    -- 21:50 UTC = 03:20 IST
    perform cron.schedule('crowd-cleanup', '50 21 * * *',
                          $job$select cleanup_crowd_data()$job$);
  else
    raise notice 'pg_cron not enabled — run cleanup_analytics() and cleanup_crowd_data() manually or enable the extension';
  end if;
end $$;
