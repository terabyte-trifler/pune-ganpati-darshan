-- =====================================================================
-- Fix: the admin guard made the system unbootstrappable.
--
-- prevent_admin_self_grant() raised whenever is_admin changed and the
-- caller was not already an admin. Outside PostgREST auth.uid() is null,
-- so is_admin() is false — which meant a direct database connection (the
-- DBA, or a migration) could not grant the FIRST admin. There was no way
-- to create one at all.
--
-- The threat being defended against is an authenticated user escalating
-- their own privileges through the API. A direct database connection is
-- already fully privileged, and anon cannot reach this table at all:
-- profiles_update_own requires id = auth.uid(), so a request with no JWT
-- matches no row. Narrowing the guard to authenticated callers therefore
-- closes the usability hole without widening the security one.
-- =====================================================================

create or replace function prevent_admin_self_grant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_admin is distinct from old.is_admin
     -- Only applies to a real authenticated session; a null uid means a
     -- direct/privileged connection, not a user escalating themselves.
     and auth.uid() is not null
     and not is_admin()
  then
    raise exception 'is_admin cannot be modified';
  end if;
  return new;
end $$;
