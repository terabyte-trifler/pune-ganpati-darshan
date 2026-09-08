-- =====================================================================
-- Pune Ganpati Darshan — core schema
-- Conventions: snake_case, uuid PKs, timestamptz, updated_at via trigger.
-- Public content is world-readable; everything user-owned is RLS-gated.
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";      -- fuzzy search on names

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type ganpati_category as enum ('maanache','famous','historic','local');

-- How much we trust a record. Surfaced in the UI; never guessed.
create type data_confidence as enum ('verified','community','demo');

create type travel_mode as enum ('walk','two_wheeler','drive','transit');

-- ---------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Areas (peths / neighbourhoods)
-- ---------------------------------------------------------------------
create table areas (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name        text not null,
  name_mr     text,
  city        text not null default 'Pune',
  -- is this inside the walkable old-peth core?
  is_core     boolean not null default false,
  centroid_lat double precision check (centroid_lat between -90 and 90),
  centroid_lng double precision check (centroid_lng between -180 and 180),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger areas_updated_at before update on areas
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------
create table categories (
  id          uuid primary key default gen_random_uuid(),
  key         ganpati_category not null unique,
  name        text not null,
  name_mr     text,
  description text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger categories_updated_at before update on categories
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Ganpatis (mandals)
-- ---------------------------------------------------------------------
create table ganpatis (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name          text not null check (length(trim(name)) > 0),
  name_mr       text,
  description   text,
  -- practical advice for a visitor standing outside; nullable on purpose
  visitor_tip   text,

  category      ganpati_category not null,
  area_id       uuid not null references areas(id) on delete restrict,

  address       text,
  latitude      double precision not null check (latitude between -90 and 90),
  longitude     double precision not null check (longitude between -180 and 180),
  google_place_id text,

  -- Manache Paach ceremonial order 1..5; unique when present.
  manache_rank  smallint check (manache_rank between 1 and 5),

  -- Relative footfall/prominence weight (0-1000) used for default sort.
  -- Editorial estimate, not a rating. Never rendered as "stars".
  prominence    smallint not null default 0 check (prominence between 0 and 1000),

  established_year smallint check (established_year between 1600 and 2100),

  -- Darshan timings. Deliberately nullable: mandals announce them days
  -- before the festival and a confident wrong time wastes a real trip.
  timing_open   time,
  timing_close  time,
  timing_note   text,

  tags          text[] not null default '{}',
  confidence    data_confidence not null default 'community',
  featured      boolean not null default false,
  verified      boolean not null default false,
  published     boolean not null default true,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- If it is one of the Manache Paach it must carry a rank, and vice versa.
  constraint manache_rank_matches_category check (
    (category = 'maanache' and manache_rank is not null)
    or (category <> 'maanache' and manache_rank is null)
  ),
  -- Both timing bounds present or both absent.
  constraint timings_paired check (
    (timing_open is null) = (timing_close is null)
  )
);
create unique index ganpatis_manache_rank_key on ganpatis(manache_rank)
  where manache_rank is not null;
create index ganpatis_area_idx      on ganpatis(area_id);
create index ganpatis_category_idx  on ganpatis(category);
create index ganpatis_published_idx on ganpatis(published) where published;
create index ganpatis_geo_idx       on ganpatis(latitude, longitude);
create index ganpatis_prominence_idx on ganpatis(prominence desc);
create index ganpatis_tags_idx      on ganpatis using gin(tags);
-- trigram indexes power fuzzy search without an extra search service
create index ganpatis_name_trgm     on ganpatis using gin(name gin_trgm_ops);
create index ganpatis_name_mr_trgm  on ganpatis using gin(name_mr gin_trgm_ops);
create trigger ganpatis_updated_at before update on ganpatis
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Images
-- ---------------------------------------------------------------------
create table ganpati_images (
  id          uuid primary key default gen_random_uuid(),
  ganpati_id  uuid not null references ganpatis(id) on delete cascade,
  url         text not null,
  alt         text,
  credit      text,
  width       integer check (width > 0),
  height      integer check (height > 0),
  blur_data_url text,
  sort_order  integer not null default 0,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index ganpati_images_ganpati_idx on ganpati_images(ganpati_id, sort_order);
-- at most one primary image per mandal
create unique index ganpati_images_one_primary on ganpati_images(ganpati_id)
  where is_primary;
create trigger ganpati_images_updated_at before update on ganpati_images
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Profiles (mirrors auth.users) + admin role
-- ---------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url  text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id,
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Authorization helper. SECURITY DEFINER so RLS on profiles cannot
-- recurse while we are evaluating another table's policy.
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- ---------------------------------------------------------------------
-- Favourites
-- ---------------------------------------------------------------------
create table favorites (
  user_id     uuid not null references auth.users(id) on delete cascade,
  ganpati_id  uuid not null references ganpatis(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, ganpati_id)
);
create index favorites_user_idx on favorites(user_id, created_at desc);

-- ---------------------------------------------------------------------
-- Darshan plans
-- ---------------------------------------------------------------------
create table darshan_plans (
  id          uuid primary key default gen_random_uuid(),
  -- short, URL-safe, unguessable id used for /plan/[share_id]
  share_id    text not null unique check (share_id ~ '^[A-Za-z0-9_-]{8,24}$'),
  user_id     uuid references auth.users(id) on delete set null,
  title       text not null default 'My Darshan',
  mode        travel_mode not null default 'walk',
  origin_lat  double precision check (origin_lat between -90 and 90),
  origin_lng  double precision check (origin_lng between -180 and 180),
  origin_label text,
  -- cached Routes API result so re-opening a shared plan costs nothing
  total_distance_m integer check (total_distance_m >= 0),
  total_duration_s integer check (total_duration_s >= 0),
  route_computed_at timestamptz,
  is_public   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index darshan_plans_user_idx on darshan_plans(user_id, created_at desc);
create trigger darshan_plans_updated_at before update on darshan_plans
  for each row execute function set_updated_at();

create table darshan_plan_stops (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references darshan_plans(id) on delete cascade,
  ganpati_id  uuid not null references ganpatis(id) on delete cascade,
  position    smallint not null check (position >= 0),
  -- leg from the previous stop (or origin) to this one
  leg_distance_m integer check (leg_distance_m >= 0),
  leg_duration_s integer check (leg_duration_s >= 0),
  created_at  timestamptz not null default now(),
  unique (plan_id, position),
  unique (plan_id, ganpati_id)          -- no duplicate stops in one plan
);
create index darshan_plan_stops_plan_idx on darshan_plan_stops(plan_id, position);

-- ---------------------------------------------------------------------
-- Festival configuration (year-agnostic; UI reads the active row)
-- ---------------------------------------------------------------------
create table festival_config (
  id            uuid primary key default gen_random_uuid(),
  year          smallint not null unique check (year between 2000 and 2100),
  start_date    date not null,
  end_date      date not null,
  visarjan_date date not null,
  greeting_en   text not null default 'Ganpati Bappa Morya',
  greeting_mr   text not null default 'गणपती बाप्पा मोरया',
  tagline       text,
  is_active     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint festival_dates_ordered check (start_date <= end_date and visarjan_date between start_date and end_date)
);
-- only one active festival row at a time
create unique index festival_config_single_active on festival_config(is_active)
  where is_active;
create trigger festival_config_updated_at before update on festival_config
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Analytics (privacy-preserving: no PII, no raw IP, session id is client-generated)
-- ---------------------------------------------------------------------
create table analytics_events (
  id          bigint generated always as identity primary key,
  name        text not null check (length(name) between 1 and 64),
  session_id  text check (length(session_id) <= 64),
  ganpati_id  uuid references ganpatis(id) on delete set null,
  props       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index analytics_events_name_idx    on analytics_events(name, created_at desc);
create index analytics_events_ganpati_idx on analytics_events(ganpati_id, created_at desc);
