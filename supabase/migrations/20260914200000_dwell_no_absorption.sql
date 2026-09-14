-- =====================================================================
-- Documentation only. No schema change.
--
-- 20260913120000_crowd_dwell_shadow.sql says this about crowd_dwell_samples:
--
--   Two pairs of mandals sit closer than any radius can separate (Kasba
--   and Phani Ali 30 m apart, Bhausaheb Rangari and Balvikas 37 m).
--   Rather than discarding all four, the more prominent of each pair
--   absorbs the other ... So a row against Kasba may describe someone who
--   was at Phani Ali ... any analysis of this table has to read those two
--   mandals as pairs.
--
-- THAT IS NO LONGER TRUE, from 14 September 2026. Absorption is removed:
-- a pair too close to separate now produces no dwell at all, for either
-- mandal. Kasba, Phani Ali, Bhausaheb Rangari and Balvikas have no zone.
--
-- So rows written BEFORE this date against kasba-ganpati or
-- bhau-rangari-ganpati may describe somebody at the neighbouring mandal,
-- and rows written after cannot exist for any of the four. An analysis
-- spanning the change has to know where the boundary is, which is why
-- this file exists rather than a comment edit nobody would find.
--
-- The reason for the change: coverage was bought with attribution, and
-- the caveat had to be carried by every comparison and every screen
-- forever. Dwell is the weakest signal in the app and the only one with
-- no human behind it. If it cannot say where, it should not say anything.
-- =====================================================================

do $$
begin
  raise notice 'dwell: absorption removed 2026-09-14; pre-date rows for kasba/bhau-rangari may include a neighbour';
end $$;
