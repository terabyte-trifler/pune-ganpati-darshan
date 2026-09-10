-- =====================================================================
-- Which part of Pune.
--
-- IP geolocation cannot answer this. `x-vercel-ip-city` returns "Pune"
-- and nothing finer, and in India it is often worse: mobile carriers
-- route through regional gateways, so someone in Kothrud and someone in
-- Hadapsar can both resolve to "Pune", or to the carrier's gateway city
-- entirely. A neighbourhood column filled from an IP would be a
-- fabrication with a plausible shape.
--
-- The database already holds two better answers, from data collected for
-- other reasons. They measure different things and are reported
-- separately rather than blended into one misleading number:
--
--   INTEREST   which peths people look at. Every `ganpati_viewed` event
--              already carries a mandal id, and every mandal belongs to
--              an area. Counts sessions, so one enthusiast is not a
--              neighbourhood.
--
--   PRESENCE   which peths people were physically standing in. A crowd
--              report with at_mandal = true means the client was within
--              ~100m of that mandal when it submitted. This is the only
--              signal here about where people actually ARE, and it is
--              the honest answer to "which part of Pune" — though it
--              only covers people who reported, which is a fraction of
--              visitors.
--
-- Notably NOT used: the visitor's GPS position. The app asks for location
-- to show what is nearby and to place a report, and quietly repurposing
-- that for analytics would be taking a permission granted for one thing
-- and spending it on another. Presence is inferred from a report someone
-- chose to submit, not from watching where they walked.
-- =====================================================================

-- Same signature, so `create or replace` genuinely replaces rather than
-- overloading. Only the returned object grows.
create or replace function traffic_origin_overview(
  p_window interval default '7 days',
  p_limit  integer default 12
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_since timestamptz := now() - p_window;
begin
  return jsonb_build_object(
    'since', v_since,
    'totalEvents', (
      select count(*) from analytics_events where created_at >= v_since
    ),
    'sessions', (
      select count(distinct session_id) from analytics_events
      where created_at >= v_since and session_id is not null
    ),
    'cities', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
        select
          coalesce(city, 'Unknown') as city,
          region,
          country,
          count(*)                   as events,
          count(distinct session_id) as sessions
        from analytics_events
        where created_at >= v_since
        group by 1, 2, 3
        order by sessions desc, events desc
        limit p_limit
      ) t
    ),
    'countries', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
        select
          coalesce(country, 'Unknown') as country,
          count(distinct session_id)   as sessions
        from analytics_events
        where created_at >= v_since
        group by 1
        order by sessions desc
        limit p_limit
      ) t
    ),
    'referrers', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
        select
          coalesce(referrer_host, 'Direct / app') as source,
          count(distinct session_id)              as sessions
        from analytics_events
        where created_at >= v_since
        group by 1
        order by sessions desc
        limit p_limit
      ) t
    ),
    -- INTEREST: which peths people look at.
    'pethInterest', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
        select
          a.name                        as peth,
          count(distinct e.session_id)  as sessions,
          count(*)                      as views
        from analytics_events e
        join ganpatis g on g.id = e.ganpati_id
        join areas a    on a.id = g.area_id
        where e.created_at >= v_since
          and e.ganpati_id is not null
        group by a.name
        order by sessions desc, views desc
        limit p_limit
      ) t
    ),
    -- PRESENCE: which peths people were standing in when they reported.
    'pethPresence', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
        select
          a.name          as peth,
          count(*)        as reports,
          count(distinct r.device_id) as devices
        from crowd_reports r
        join ganpatis g on g.id = r.mandal_id
        join areas a    on a.id = g.area_id
        where r.created_at >= v_since
          and r.at_mandal
        group by a.name
        order by reports desc
        limit p_limit
      ) t
    ),
    -- The share of reports made on site, so the presence numbers above can
    -- be read with the right amount of confidence.
    'onsiteShare', (
      select case
        when count(*) = 0 then null
        else round(100.0 * count(*) filter (where at_mandal) / count(*))
      end
      from crowd_reports where created_at >= v_since
    ),
    'daily', (
      select coalesce(jsonb_agg(row_to_json(t) order by (t.day)), '[]'::jsonb) from (
        select
          date_trunc('day', created_at)::date as day,
          count(distinct session_id)          as sessions
        from analytics_events
        where created_at >= v_since
        group by 1
      ) t
    )
  );
end $$;

-- The interest join walks events by mandal; without this it is a full
-- scan of every event ever recorded.
create index if not exists analytics_events_ganpati_created_idx
  on analytics_events (ganpati_id, created_at desc)
  where ganpati_id is not null;

revoke all on function traffic_origin_overview(interval, integer) from public, anon, authenticated;
grant execute on function traffic_origin_overview(interval, integer) to service_role;
