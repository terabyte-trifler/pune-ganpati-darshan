-- =====================================================================
-- Where the traffic comes from.
--
-- The app has been collecting analytics events since day one and nothing
-- has ever read them back: there is an admin view for crowd, and none for
-- traffic. These columns and the /admin/traffic page close that.
--
-- ---------------------------------------------------------------------
-- What is stored, and what is deliberately not.
--
-- Vercel resolves the requester's IP into a set of geolocation headers
-- before the request reaches us. Stored here: country, first-level region,
-- city. NOT stored, and not read anywhere:
--
--   x-vercel-ip-latitude / -longitude   a point, not a place
--   x-vercel-ip-postal-code             a few hundred households
--   x-forwarded-for                     the IP itself
--
-- That line is drawn where a row stops describing a population and starts
-- describing a household. "Pune, MH, IN" is one of seven million people.
-- A postal code plus a timestamp plus a session id is a person, and this
-- table already holds the last two. docs/03-security.md promises analytics
-- stores no IP and no user id; city-level origin keeps that promise, and
-- a lat/long column would quietly break it.
--
-- `referrer_host` is the HOST ONLY — "instagram.com", never the full URL.
-- Full referrer URLs carry search terms, private group links and document
-- titles, which is how analytics tables end up holding things nobody
-- meant to send.
-- =====================================================================

alter table analytics_events
  add column if not exists country       text check (country is null or length(country) <= 2),
  add column if not exists region        text check (region is null or length(region) <= 8),
  add column if not exists city          text check (city is null or length(city) <= 80),
  add column if not exists referrer_host text check (referrer_host is null or length(referrer_host) <= 120);

comment on column analytics_events.country is
  'ISO 3166-1 alpha-2, from x-vercel-ip-country. Never derived client-side.';
comment on column analytics_events.region is
  'ISO 3166-2 first-level subdivision, from x-vercel-ip-country-region.';
comment on column analytics_events.city is
  'City name from x-vercel-ip-city, percent-decoded. Coarsest useful grain; '
  'no postal code or coordinates are stored.';
comment on column analytics_events.referrer_host is
  'Host only, e.g. "instagram.com". Never a full URL: those carry search '
  'terms and private group links.';

-- The admin page groups by place and by referrer over a recent window.
-- Without these it is a full scan of every event ever recorded, which gets
-- slower every day of the festival.
create index if not exists analytics_events_city_idx
  on analytics_events (city, created_at desc)
  where city is not null;

create index if not exists analytics_events_referrer_idx
  on analytics_events (referrer_host, created_at desc)
  where referrer_host is not null;

-- =====================================================================
-- Reads for the admin page.
--
-- Aggregated in the database rather than by pulling rows into the app: at
-- festival volume the event table is the largest thing here, and shipping
-- it over the wire to count it in JavaScript would be the one genuinely
-- expensive query in the product.
--
-- Reachability is the grant, matching crowd_admin_overview(): execute goes
-- to service_role ONLY, so no browser session can reach this however the
-- URL is guessed, and the page gates on isAdmin before it runs.
--
-- An `auth.uid()` check inside would be worse than useless. The app calls
-- this with the service-role client, where auth.uid() is null, so such a
-- check would reject every legitimate call and admit none — a guard that
-- looks like defence and is actually an outage.
-- =====================================================================
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
          count(*)                        as events,
          count(distinct session_id)      as sessions
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

revoke all on function traffic_origin_overview(interval, integer) from public, anon, authenticated;
grant execute on function traffic_origin_overview(interval, integer) to service_role;
