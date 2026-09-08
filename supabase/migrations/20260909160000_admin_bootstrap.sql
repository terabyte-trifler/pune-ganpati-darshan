-- =====================================================================
-- Admin bootstrap
--
-- The system had no way to gain its first admin. `is_admin` cannot be
-- self-granted (prevent_admin_self_grant), the admin UI is gated on
-- `is_admin`, and the signup trigger creates every profile with
-- is_admin = false. So the only route in was a manual UPDATE by whoever
-- holds the database password — which is exactly the credential we want
-- people to stop reaching for.
--
-- This makes the intended first admin explicit and auditable: an email is
-- pre-authorised here, and the account becomes an admin when that person
-- signs in normally. No account is created on anyone's behalf, and no
-- password is involved — sign-in is Google OAuth or an email magic link.
--
-- This is a bootstrap, not an ongoing mechanism. Once an admin exists,
-- further admins should be granted by an admin. Rows here are only
-- consulted at signup.
-- =====================================================================

create table admin_bootstrap_emails (
  email      text primary key check (position('@' in email) > 1),
  note       text,
  created_at timestamptz not null default now()
);

alter table admin_bootstrap_emails enable row level security;

-- Readable and writable by admins only. Anonymous visitors must not be
-- able to enumerate which addresses would gain admin on signup.
create policy admin_bootstrap_admin_all on admin_bootstrap_emails
  for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- Signup trigger, extended.
--
-- Case-insensitive comparison: email addresses are matched
-- case-insensitively in practice, and a bootstrap that silently fails
-- because of capitalisation is worse than no bootstrap.
-- ---------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
begin
  select exists (
    select 1 from admin_bootstrap_emails b
    where lower(b.email) = lower(new.email)
  ) into v_is_admin;

  insert into public.profiles (id, display_name, avatar_url, is_admin)
  values (new.id,
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'avatar_url',
          coalesce(v_is_admin, false))
  on conflict (id) do nothing;

  return new;
end $$;

-- The project owner. Signing in with this address grants admin; nothing
-- happens until they do.
insert into admin_bootstrap_emails (email, note)
values ('gurnoor.singh@iiitg.ac.in', 'Project owner — first admin')
on conflict (email) do nothing;
