-- =====================================================================
-- Mandals located via OpenStreetMap, plus coordinate corrections.
--
-- SOURCING
--   Every coordinate here is an OSM element that anyone can re-check by id.
--   Nothing was inferred from a name or estimated from an area centroid: a
--   fabricated position sends a visitor to the wrong lane, which is worse
--   than the mandal simply being absent.
--
--   darshan_minutes is left NULL. There is no basis for a queue estimate on
--   these, and the planner already treats unknown dwell honestly rather than
--   guessing — same policy as the missing timings.
--
--   Areas were assigned by nearest area centroid, all within ~400m.
-- =====================================================================

insert into ganpatis (
  slug, name, name_mr, description, category, area_id,
  latitude, longitude, prominence, confidence, published,
  coordinate_source, osm_id, tags
)
select v.slug, v.name, v.name_mr, v.description, v.category::ganpati_category, a.id,
       v.lat, v.lng, v.prominence, 'community'::data_confidence, true,
       'openstreetmap', v.osm_id, v.tags
from (values
  ('trishund-ganpati-mandir', 'Shree Trishund Ganpati Mandir', 'श्री त्रिशुंड गणपती मंदिर',
   'An eighteenth-century stone temple in Nana Peth, known for its carved facade and the unusual three-trunked idol it is named for.',
   'historic', 'ganesh-peth', 18.5217, 73.8619, 480, 'node/11846700223',
   array['historic','heritage','temple']),

  ('chinchechi-talim-ganpati', 'Chinchechi Talim Ganpati', 'चिंचेची तालीम गणपती',
   'A talim mandal in the Shukrawar Peth lanes, part of the wrestling-gymnasium tradition that produced several of Pune''s early mandals.',
   'historic', 'shukrawar-peth', 18.5086, 73.8555, 380, 'node/5832547676',
   array['historic','talim']),

  ('phani-ali-ganesh-mandir', 'Phani Ali Ganesh Mandir', 'फणी आळी गणेश मंदिर',
   'A lane temple in the Kasba Peth quarter, a short walk from the gramdaivat.',
   'local', 'kasba-peth', 18.5188, 73.8571, 300, 'node/6241949025',
   array['local','temple']),

  ('mati-ganpati', 'Mati Ganpati', 'माती गणपती',
   'A Shaniwar Peth mandal on the western side of the peth core.',
   'local', 'shaniwar-peth', 18.5159, 73.8468, 320, 'node/2870389543',
   array['local']),

  ('perugate-bhave-mandal', 'Perugate Bhave Mitra Mandal', 'पेरूगेट भावे मित्र मंडळ',
   'A Narayan Peth mandal at Perugate, named for the Bhave school it stands beside.',
   'local', 'narayan-peth', 18.5110, 73.8473, 340, 'way/217773614',
   array['local'])
) as v(slug, name, name_mr, description, category, area_slug, lat, lng, prominence, osm_id, tags)
join areas a on a.slug = v.area_slug
on conflict (slug) do update set
  name = excluded.name, name_mr = excluded.name_mr,
  description = excluded.description, category = excluded.category,
  area_id = excluded.area_id, latitude = excluded.latitude,
  longitude = excluded.longitude, prominence = excluded.prominence,
  coordinate_source = excluded.coordinate_source, osm_id = excluded.osm_id,
  tags = excluded.tags;

-- ---------------------------------------------------------------------
-- Coordinate corrections.
--
-- Cross-checking the prototype seed against OSM found two mandals more than
-- 400m from an independently-mapped temple node of the same name. In the
-- peths that is a different lane. Both prototype values had no recorded
-- source; the OSM nodes are named, tagged as places of worship, and
-- re-checkable — so they are adopted, and the source is recorded rather than
-- the change being made silently.
-- ---------------------------------------------------------------------
update ganpatis set
  latitude = 18.5119, longitude = 73.8522,
  coordinate_source = 'openstreetmap', osm_id = 'node/12176170904'
where slug = 'nimbalkar-talim-mandal';

update ganpatis set
  latitude = 18.5137, longitude = 73.8456,
  coordinate_source = 'openstreetmap', osm_id = 'node/2517303170'
where slug = 'garud-ganpati-mandal';
