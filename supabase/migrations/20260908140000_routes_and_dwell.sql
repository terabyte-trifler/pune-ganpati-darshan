-- =====================================================================
-- Curated routes, and the dwell time that makes time-budgeting possible.
--
-- Travel time alone cannot answer "what fits in two hours": at a big mandal
-- the queue dominates the walk. Dagdusheth can take 45 minutes to get
-- through while the walk from Tulshibaug is six. Without a per-mandal
-- darshan estimate, any time-budgeted route is fiction.
-- =====================================================================

-- How a visitor takes darshan at this mandal.
-- Postgres has no CREATE TYPE IF NOT EXISTS, so this is guarded to keep the
-- migration re-runnable.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'darshan_style') then
    create type darshan_style as enum ('inside', 'outside', 'either');
  end if;
end $$;

alter table ganpatis
  -- Typical minutes spent AT the mandal: queue plus darshan, not travel.
  -- Nullable: unknown is better than invented, same policy as timings.
  add column if not exists darshan_minutes smallint
    check (darshan_minutes between 1 and 240),
  -- Whether you queue to go in, or view from the road.
  add column if not exists darshan_style darshan_style not null default 'either',
  -- Queue estimates swing hugely between morning and night.
  add column if not exists peak_darshan_minutes smallint
    check (peak_darshan_minutes between 1 and 480);

-- Added separately: ALTER TABLE cannot mix ADD COLUMN with a bare CONSTRAINT
-- clause, and the check references a column created in the same statement.
alter table ganpatis drop constraint if exists peak_not_less_than_typical;
alter table ganpatis add constraint peak_not_less_than_typical
  check (peak_darshan_minutes is null or darshan_minutes is null
         or peak_darshan_minutes >= darshan_minutes);

comment on column ganpatis.darshan_minutes is
  'Typical minutes at the mandal (queue + darshan), excluding travel. NULL when unknown.';

-- ---------------------------------------------------------------------
-- Curated routes
-- ---------------------------------------------------------------------
create table if not exists routes (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title       text not null,
  title_mr    text,
  summary     text,
  description text,

  mode        travel_mode not null default 'walk',
  -- Best time of day for this route; drives the "good for right now" surface.
  time_of_day text check (time_of_day in ('morning','afternoon','evening','night','any')),
  -- Themes a visitor picks in the wizard: dekhava, lights, heritage, manache…
  themes      text[] not null default '{}',

  -- Cached totals so an index page needs no routing calls.
  total_distance_m integer check (total_distance_m >= 0),
  total_walk_s     integer check (total_walk_s >= 0),
  total_darshan_s  integer check (total_darshan_s >= 0),

  featured    boolean not null default false,
  published   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists routes_published_idx on routes(published) where published;
create index if not exists routes_themes_idx on routes using gin(themes);
drop trigger if exists routes_updated_at on routes;
create trigger routes_updated_at before update on routes
  for each row execute function set_updated_at();

create table if not exists route_stops (
  id          uuid primary key default gen_random_uuid(),
  route_id    uuid not null references routes(id) on delete cascade,
  ganpati_id  uuid not null references ganpatis(id) on delete cascade,
  position    smallint not null check (position >= 0),
  -- Per-route override: the same mandal can be a quick roadside look on one
  -- route and a full queued darshan on another.
  darshan_minutes smallint check (darshan_minutes between 1 and 240),
  darshan_style darshan_style,
  note        text,
  created_at  timestamptz not null default now(),
  unique (route_id, position),
  unique (route_id, ganpati_id)
);
create index if not exists route_stops_route_idx on route_stops(route_id, position);

-- ---------------------------------------------------------------------
-- RLS: public read, admin write — same posture as the rest of the catalogue.
-- ---------------------------------------------------------------------
alter table routes enable row level security;
alter table route_stops enable row level security;

drop policy if exists routes_read_published on routes;
create policy routes_read_published on routes
  for select using (published or is_admin());
drop policy if exists routes_admin_write on routes;
create policy routes_admin_write on routes
  for all using (is_admin()) with check (is_admin());

drop policy if exists route_stops_read on route_stops;
create policy route_stops_read on route_stops
  for select using (
    exists (select 1 from routes r
            where r.id = route_stops.route_id and (r.published or is_admin()))
  );
drop policy if exists route_stops_admin_write on route_stops;
create policy route_stops_admin_write on route_stops
  for all using (is_admin()) with check (is_admin());
