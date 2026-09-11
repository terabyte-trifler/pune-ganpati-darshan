-- =====================================================================
-- Put "Every mandal, from Kasba" at the top of the curated routes.
--
-- It went in at sort_order 17, which is simply "after everything that
-- already existed" — and that left the most complete route in the
-- catalogue sitting below a 15 km trip to Chinchwad.
--
-- 0 rather than 1, because the existing routes occupy 1-16 and shifting
-- sixteen rows to make room would touch data this change has no business
-- touching. sort_order is an integer with no constraint above zero.
-- =====================================================================

update routes
   set sort_order = 0
 where slug = 'every-mandal-from-kasba';

do $$
declare
  v_first text;
begin
  select slug into v_first
    from routes
   where published
   order by sort_order
   limit 1;

  if v_first is distinct from 'every-mandal-from-kasba' then
    raise exception 'Expected every-mandal-from-kasba to sort first, got %', coalesce(v_first, '(none)');
  end if;

  raise notice 'Verified: "Every mandal, from Kasba" now sorts first.';
end $$;
