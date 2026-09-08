-- =====================================================================
-- Row Level Security
-- Principle: public content is readable by anon; every write requires
-- admin; every user-owned row is scoped to auth.uid().
-- RLS is enabled on ALL tables — the service-role key bypasses it, and
-- that key exists only on the server.
-- =====================================================================

alter table areas             enable row level security;
alter table categories        enable row level security;
alter table ganpatis          enable row level security;
alter table ganpati_images    enable row level security;
alter table profiles          enable row level security;
alter table favorites         enable row level security;
alter table darshan_plans     enable row level security;
alter table darshan_plan_stops enable row level security;
alter table festival_config   enable row level security;
alter table analytics_events  enable row level security;

-- ---------------------------------------------------------------------
-- Public catalogue: readable by everyone, writable only by admins.
-- ---------------------------------------------------------------------
create policy areas_read_all on areas
  for select using (true);
create policy areas_admin_write on areas
  for all using (is_admin()) with check (is_admin());

create policy categories_read_all on categories
  for select using (true);
create policy categories_admin_write on categories
  for all using (is_admin()) with check (is_admin());

-- Unpublished drafts are visible to admins only.
create policy ganpatis_read_published on ganpatis
  for select using (published or is_admin());
create policy ganpatis_admin_write on ganpatis
  for all using (is_admin()) with check (is_admin());

create policy ganpati_images_read on ganpati_images
  for select using (
    exists (select 1 from ganpatis g
            where g.id = ganpati_images.ganpati_id
              and (g.published or is_admin()))
  );
create policy ganpati_images_admin_write on ganpati_images
  for all using (is_admin()) with check (is_admin());

create policy festival_config_read_all on festival_config
  for select using (true);
create policy festival_config_admin_write on festival_config
  for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- Profiles: a user reads/updates only their own row.
-- is_admin is NOT self-assignable — enforced by trigger below, because a
-- WITH CHECK clause cannot compare against the pre-update row.
-- ---------------------------------------------------------------------
create policy profiles_read_own on profiles
  for select using (id = auth.uid() or is_admin());
create policy profiles_update_own on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create or replace function prevent_admin_self_grant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_admin is distinct from old.is_admin and not is_admin() then
    raise exception 'is_admin cannot be modified';
  end if;
  return new;
end $$;

create trigger profiles_no_self_admin
  before update on profiles
  for each row execute function prevent_admin_self_grant();

-- ---------------------------------------------------------------------
-- Favourites: strictly per-user.
-- ---------------------------------------------------------------------
create policy favorites_select_own on favorites
  for select using (user_id = auth.uid());
create policy favorites_insert_own on favorites
  for insert with check (user_id = auth.uid());
create policy favorites_delete_own on favorites
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Darshan plans.
-- Readable if public (shared link) or owned. Anonymous plans (user_id
-- null) are created server-side only, so there is no anon insert policy.
-- ---------------------------------------------------------------------
create policy darshan_plans_read on darshan_plans
  for select using (is_public or user_id = auth.uid());
create policy darshan_plans_insert_own on darshan_plans
  for insert with check (user_id = auth.uid());
create policy darshan_plans_update_own on darshan_plans
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy darshan_plans_delete_own on darshan_plans
  for delete using (user_id = auth.uid());

create policy darshan_plan_stops_read on darshan_plan_stops
  for select using (
    exists (select 1 from darshan_plans p
            where p.id = darshan_plan_stops.plan_id
              and (p.is_public or p.user_id = auth.uid()))
  );
create policy darshan_plan_stops_write_own on darshan_plan_stops
  for all using (
    exists (select 1 from darshan_plans p
            where p.id = darshan_plan_stops.plan_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from darshan_plans p
            where p.id = darshan_plan_stops.plan_id and p.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- Analytics: write-only from the client's perspective.
-- Nobody but an admin can read the event stream back.
-- ---------------------------------------------------------------------
create policy analytics_insert_any on analytics_events
  for insert with check (true);
create policy analytics_admin_read on analytics_events
  for select using (is_admin());
