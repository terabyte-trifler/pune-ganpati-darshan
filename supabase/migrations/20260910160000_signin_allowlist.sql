-- =====================================================================
-- Sign-in is restricted to an allowlist.
--
-- Requested by the owner: only their account may exist. Enforced in the
-- database on INSERT into auth.users, so it holds regardless of which
-- client is used — the app, curl, the Supabase dashboard's own API, or a
-- provider callback. An app-level check would be a suggestion; this is the
-- boundary.
--
-- ---------------------------------------------------------------------
-- What this costs, stated plainly because it is not obvious from here.
--
-- Sign-in existed so a visitor could sync saved mandals across their
-- devices. With this in place nobody else can ever hold an account, so
-- favourites become per-device only for every visitor. Nothing else in
-- the product needs an account: browsing, the map, routes, crowd reading
-- and crowd reporting are all anonymous by design.
--
-- ---------------------------------------------------------------------
-- Existing accounts are unaffected.
--
-- The trigger fires BEFORE INSERT, so it governs account CREATION only.
-- The owner's existing account signs in as before — a magic link or an
-- OAuth callback for a user that already exists inserts nothing.
-- =====================================================================

create table if not exists signin_allowlist (
  email      text primary key check (position('@' in email) > 1),
  note       text,
  created_at timestamptz not null default now()
);

alter table signin_allowlist enable row level security;

-- Admins only. An anonymous visitor must not be able to read who is
-- allowed to sign in, and certainly not add themselves.
drop policy if exists signin_allowlist_admin_all on signin_allowlist;
create policy signin_allowlist_admin_all on signin_allowlist
  for all using (is_admin()) with check (is_admin());

-- Seeded with the owner. Case-insensitive matching happens in the
-- trigger, so the stored casing does not matter.
insert into signin_allowlist (email, note)
values ('gurnoor.singh@iiitg.ac.in', 'Owner — the only permitted account')
on conflict (email) do nothing;

-- ---------------------------------------------------------------------
-- The gate.
--
-- `security definer` so the check can read signin_allowlist while the
-- inserting role (supabase_auth_admin) has no policy granting it. The
-- search_path is pinned for the usual reason: a definer function that
-- resolves table names through a caller-controlled path is a privilege
-- escalation waiting to happen.
-- ---------------------------------------------------------------------
create or replace function enforce_signin_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- An account with no email address cannot be matched against an
  -- allowlist of email addresses, so it is refused rather than admitted
  -- by default.
  if new.email is null then
    raise exception 'Sign-up is not open on this site.';
  end if;

  if not exists (
    select 1 from signin_allowlist a
    where lower(a.email) = lower(new.email)
  ) then
    -- Supabase wraps this into a generic "Database error saving new user"
    -- before it reaches the browser, so the app maps that to a readable
    -- sentence of its own. The text here is for the logs.
    raise exception 'Sign-up is not open on this site: % is not allowed.', new.email;
  end if;

  return new;
end $$;

drop trigger if exists auth_users_signin_allowlist on auth.users;
create trigger auth_users_signin_allowlist
  before insert on auth.users
  for each row execute function enforce_signin_allowlist();

revoke all on function enforce_signin_allowlist() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Proof, in the same transaction that installs it.
--
-- A gate nobody tested is a gate nobody should trust, and this one is
-- easy to get backwards — a trigger that raises on the wrong branch locks
-- the owner out of their own site with no way back except this editor.
-- ---------------------------------------------------------------------
do $$
declare
  v_blocked boolean := false;
begin
  begin
    insert into auth.users (id, email, instance_id, aud, role)
    values (gen_random_uuid(), 'stranger@example.invalid',
            '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
    -- Reached only if the trigger let it through.
    raise exception 'ALLOWLIST NOT WORKING: a stranger was inserted';
  exception
    when others then
      if sqlerrm like '%Sign-up is not open%' then
        v_blocked := true;
      else
        raise;
      end if;
  end;

  if not v_blocked then
    raise exception 'ALLOWLIST NOT WORKING: expected a rejection';
  end if;

  raise notice 'Verified: a non-allowlisted email cannot create an account.';
end $$;
