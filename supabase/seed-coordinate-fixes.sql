-- =====================================================================
-- Coordinate corrections.
--
-- The original prototype seed turned out to be unreliable: cross-checking
-- every mandal against OpenStreetMap and a second independent public source
-- found 15 of 18 comparable records misplaced, by up to 862m. In the peths
-- that is several streets away, and this app sends people walking on these
-- numbers.
--
-- The three records already sourced from OSM agreed with the second source
-- to within 4-18m, which is what showed the method was sound and the seed,
-- not the check, was at fault.
--
-- Policy applied per mandal:
--   openstreetmap  a named OSM node exists; its coordinate is used and its
--                  element id recorded so anyone can re-check it.
--   cross-checked  no OSM node; the coordinate is the one on which two
--                  independent public sources agree.
-- =====================================================================

update ganpatis set
  latitude = v.lat,
  longitude = v.lng,
  coordinate_source = v.src,
  osm_id = coalesce(v.osm, ganpatis.osm_id)
from (values
  ('kasba-ganpati', 18.51903, 73.857241, 'openstreetmap', 'node/2289294092'),
  ('tambdi-jogeshwari', 18.51662, 73.854894, 'cross-checked', null),
  ('guruji-talim', 18.515047, 73.85466, 'openstreetmap', 'node/5832579354'),
  ('tulshibaug-ganpati', 18.514268, 73.855306, 'cross-checked', null),
  ('kesariwada-ganpati', 18.515811, 73.849008, 'cross-checked', null),
  ('dagdusheth-halwai-ganpati', 18.516391, 73.856084, 'openstreetmap', 'way/264276391'),
  ('bhau-rangari-ganpati', 18.517583, 73.855362, 'cross-checked', null),
  ('akhil-mandai-mandal', 18.511852, 73.856135, 'cross-checked', null),
  ('hutatma-babu-genu-mandal', 18.51389, 73.856342, 'cross-checked', null),
  ('natu-baug-mandal', 18.510703, 73.853821, 'cross-checked', null),
  ('hatti-ganpati-mandal', 18.511223, 73.845858, 'openstreetmap', 'node/2536024948'),
  ('chhatrapati-rajaram-mandal', 18.512444, 73.847482, 'cross-checked', null),
  ('jilbya-maruti-mandal', 18.513319, 73.854938, 'cross-checked', null),
  ('shanipar-mandal', 18.512619, 73.852601, 'cross-checked', null),
  ('perugate-bhave-mandal', 18.509777, 73.84944, 'cross-checked', null)
) as v(slug, lat, lng, src, osm)
where ganpatis.slug = v.slug;

-- ---------------------------------------------------------------------
-- Admin override: Dagdusheth
--
-- Supplied directly by the product owner and takes precedence over the
-- OpenStreetMap pass above, which sat ~143m away from this point. The OSM
-- reference is cleared along with it: leaving way/264276391 here would
-- claim OpenStreetMap provenance for a coordinate OpenStreetMap did not
-- supply, which is exactly what coordinate_source exists to prevent.
--
-- 143m matters beyond tidiness — the "You're here" prompt only claims a
-- mandal within 120m, so the old point and this one are not interchangeable
-- for someone standing at the mandap.
-- ---------------------------------------------------------------------
update ganpatis set
  latitude = 18.515140,
  longitude = 73.856379,
  coordinate_source = 'admin',
  osm_id = null
where slug = 'dagdusheth-halwai-ganpati';

-- ---------------------------------------------------------------------
-- The two mandals the cross-check could not cover.
--
-- Sarasbaug: the second source had no coordinate, and OSM's "Sarasbaug" is
-- the park polygon, not the shrine on its island. Searching places of
-- worship inside the park footprint found "Talyatala Ganapati" — which is
-- precisely what this mandal is called locally — 132m from the seeded value.
--
-- Morya Gosavi: seeded 2.4km from OSM's explicitly tagged temple node. It
-- sits outside the peths, so it was never covered by the peth-area sweep
-- that caught the others.
-- ---------------------------------------------------------------------
update ganpatis set
  latitude = 18.500881, longitude = 73.852950,
  coordinate_source = 'openstreetmap', osm_id = 'way/207899908'
where slug = 'sarasbaug-ganpati';

update ganpatis set
  latitude = 18.626316, longitude = 73.778442,
  coordinate_source = 'openstreetmap', osm_id = 'node/11700182023'
where slug = 'shri-morya-gosavi';

-- ---------------------------------------------------------------------
-- Peth reassignments.
--
-- Correcting the coordinates moved three mandals into a different peth from
-- the one the prototype seed had recorded, confirmed against the second
-- source's own peth attribution.
--
-- A fourth (Chhatrapati Rajaram) also looked misfiled by nearest-centroid,
-- but the second source agrees with our label — the seeded area centroids are
-- approximate, so proximity alone is not evidence. Centroids are recomputed
-- from member mandals below, which removes that noise.
-- ---------------------------------------------------------------------
update ganpatis set area_id = (select id from areas where slug = 'budhwar-peth')
where slug = 'hutatma-babu-genu-mandal';

update ganpatis set area_id = (select id from areas where slug = 'sadashiv-peth')
where slug = 'nimbalkar-talim-mandal';

update ganpatis set area_id = (select id from areas where slug = 'shukrawar-peth')
where slug = 'jilbya-maruti-mandal';

-- Area centroids derived from their mandals rather than seeded by hand, now
-- that the coordinates underneath them are verified.
update areas set
  centroid_lat = sub.lat,
  centroid_lng = sub.lng
from (
  select area_id, round(avg(latitude)::numeric, 6) as lat, round(avg(longitude)::numeric, 6) as lng
  from ganpatis where published group by area_id
) sub
where areas.id = sub.area_id;

-- Post-check: every mandal now sits nearest its own peth centroid except
-- Chhatrapati Rajaram, which is a false positive. Sadashiv Peth's centroid is
-- pulled ~1.2km south by Sarasbaug, landing it beside Narayan Peth's. With
-- 3-5 mandals per peth a centroid is not a boundary, so the second source's
-- attribution decides — and it says Sadashiv, as we do.
