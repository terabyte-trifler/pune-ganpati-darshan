-- =====================================================================
-- Move the one remaining 'drive' route onto 'metro'.
--
-- Depends on 20260910170000 having added the value in an earlier
-- transaction; see the note at the end of that file for why they are not
-- one migration.
--
-- ---------------------------------------------------------------------
-- There is exactly one row, and it is a judgement call worth recording.
--
-- 'chinchwad-morya-gosavi' is the only route that was ever a driving one,
-- and it is the only route not in the peths — the Morya Gosavi temple is
-- about 20 km north-west, which is precisely why it was authored as a
-- drive rather than a walk.
--
-- Calling it 'metro' is defensible: the Purple Line runs to PCMC, and
-- metro-plus-auto is how most people will actually get there during the
-- festival. But it is not one of the five stations the map shows, all of
-- which are in or beside the peths.
--
-- The application handles that honestly rather than papering over it:
-- lib/metro#ANCHOR_MAX_M refuses to anchor a route to a station more than
-- 2.5 km away, so this route shows no starting station at all instead of
-- claiming a Mandai that is twenty kilometres from its first stop. If a
-- PCMC station is added to lib/metro later, this route picks it up with no
-- further change here.
--
-- 'walk' was the alternative and is worse: it would present a 20 km
-- journey as something you set off on on foot.
-- =====================================================================

update routes set mode = 'metro' where mode = 'drive';

-- ---------------------------------------------------------------------
-- Proof, in the same transaction.
--
-- A silent no-op here would look identical to success, and the failure it
-- would hide is a route the planner can no longer render a mode for.
-- ---------------------------------------------------------------------
do $$
declare
  v_stale integer;
begin
  select count(*) into v_stale from routes where mode in ('drive', 'transit');
  if v_stale > 0 then
    raise exception 'Expected no drive/transit routes to remain, found %', v_stale;
  end if;

  select count(*) into v_stale from darshan_plans where mode in ('drive', 'transit');
  if v_stale > 0 then
    -- Not fatal: saved plans belong to visitors and toTravelMode() renders
    -- these correctly. Worth knowing about, not worth failing over.
    raise notice '% saved plan(s) still store a retired mode; they read as metro.', v_stale;
  end if;

  raise notice 'Verified: no route stores a retired travel mode.';
end $$;
