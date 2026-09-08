-- =====================================================================
-- Coordinate provenance.
--
-- The catalogue mixes sources: some coordinates came from the original
-- prototype with no recorded origin, others from OpenStreetMap where a
-- named temple node exists. Cross-checking found disagreements of up to
-- 500m — in the peths that is a different lane, and this app sends people
-- walking on these numbers.
--
-- Rather than silently pick a winner, record where each coordinate came
-- from so the choice is auditable and can be corrected by anyone.
-- =====================================================================

alter table ganpatis
  add column if not exists coordinate_source text,
  -- OSM element reference (e.g. 'node/2517303170'), when that is the source.
  add column if not exists osm_id text;

comment on column ganpatis.coordinate_source is
  'Where this coordinate came from: openstreetmap, prototype-seed, survey, admin.';
comment on column ganpatis.osm_id is
  'OpenStreetMap element id backing the coordinate, so it can be re-checked.';

update ganpatis set coordinate_source = 'prototype-seed'
where coordinate_source is null;
