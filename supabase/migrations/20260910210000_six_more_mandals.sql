-- =====================================================================
-- Six mandals the catalogue was missing.
--
-- Named by the owner from a list of the mandals people actually walk, and
-- absent from ours: Navjavan, Chimnya, Balvikas, Honaji Tarun, Seva Mitra
-- and Hira Bagh. Coordinates are the owner's own, taken on the ground —
-- the only source for them. OpenStreetMap has no record of any of these
-- under any spelling I could find, in English or Marathi.
--
-- ---------------------------------------------------------------------
-- Two judgement calls, recorded because they are not obvious.
--
-- HONAJI TARUN was given as "Rameshwar Chowk", which is a chowk rather
-- than a peth and would be the only area of its kind in a list that is
-- otherwise peths. Its coordinate sits 404m from the Budhwar Peth
-- centroid, so it is filed there and "Rameshwar Chowk" is kept as the
-- address, where it is more useful anyway — it is what you would tell an
-- auto driver.
--
-- BALVIKAS is 37m from Shrimant Bhausaheb Rangari Ganpati. That is inside
-- the 100m radius the app uses to decide someone is AT a mandal, so a
-- report at one can be attributed to the other. Peth mandals genuinely do
-- sit that close, so it is added as given — but if these turn out to be
-- the same mandal under two names, this is the row to delete.
--
-- ---------------------------------------------------------------------
-- What is deliberately left empty.
--
-- No darshan_minutes. The planner falls back to five minutes for a mandal
-- with no estimate and flags the plan as containing one, which is honest;
-- inventing a queue time for a mandal nobody has timed would not be.
--
-- No timings, like every other mandal in the catalogue — they are
-- announced days before the festival.
--
-- category 'local' and confidence 'community' throughout. Neither is a
-- judgement about the mandal, only about what this file can vouch for.
-- =====================================================================

insert into ganpatis (
  slug, name, name_mr, description, category, area_id,
  address, latitude, longitude, prominence, tags, confidence,
  coordinate_source, published
)
select v.slug, v.name, v.name_mr, v.description, 'local'::ganpati_category, a.id,
       v.address, v.lat, v.lng, 120, array['local']::text[], 'community'::data_confidence,
       'admin', true
from (values
  ('navjavan-mandal', 'Navjavan Mandal', 'नवजीवन मंडळ',
   'A neighbourhood mandal on the Narayan Peth side of Sadashiv Peth.',
   'Sadashiv Peth, Pune', 18.51291957641603, 73.84872821113531, 'narayan-peth'),

  ('chimnya-ganpati', 'Chimnya Ganpati', 'चिमण्या गणपती',
   'A Sadashiv Peth mandal, a short walk from the Nimbalkar Talim stretch.',
   'Sadashiv Peth, Pune', 18.51118045960157, 73.85219044972672, 'sadashiv-peth'),

  ('balvikas-mandal', 'Balvikas Mandal', 'बालविकास मंडळ',
   'A small mandal in the Budhwar Peth lanes, beside Bhausaheb Rangari.',
   'Shaniwar Peth, Pune', 18.517436556545693, 73.85504230133274, 'budhwar-peth'),

  ('honaji-tarun-mandal', 'Honaji Tarun Mandal', 'होनाजी तरुण मंडळ',
   'A mandal at Rameshwar Chowk, within a few minutes of Dagdusheth.',
   'Rameshwar Chowk, Pune', 18.51561901734673, 73.85927413385981, 'budhwar-peth'),

  ('seva-mitra-mandal', 'Seva Mitra Mandal', 'सेवा मित्र मंडळ',
   'A Shukrawar Peth mandal south of the Mandai market stretch.',
   'Shukrawar Peth, Pune', 18.508656338809867, 73.85756499152987, 'shukrawar-peth'),

  ('hira-bagh-mandal', 'Hira Bagh Mandal', 'हिराबाग मंडळ',
   'A mandal at Hirabaug, on the southern edge of the peths near Sarasbaug.',
   'Hirabaug, Pune', 18.504221751187597, 73.85576450945662, 'sadashiv-peth')
) as v(slug, name, name_mr, description, address, lat, lng, area_slug)
join areas a on a.slug = v.area_slug
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- Proof, in the same transaction.
--
-- The failure worth catching is a silent one: an area slug that does not
-- match joins to nothing and the row is simply never inserted, leaving a
-- catalogue that looks fine and is short a mandal.
-- ---------------------------------------------------------------------
do $$
declare
  v_added integer;
  v_total integer;
  v_bad   text;
begin
  select count(*) into v_added from ganpatis
  where slug in ('navjavan-mandal','chimnya-ganpati','balvikas-mandal',
                 'honaji-tarun-mandal','seva-mitra-mandal','hira-bagh-mandal');
  if v_added <> 6 then
    raise exception 'Expected all 6 new mandals, found % — check the area slugs', v_added;
  end if;

  -- Every one must sit inside the peth core; a swapped lat/lng lands in
  -- the Indian Ocean and would otherwise be found by a visitor.
  select string_agg(slug, ', ') into v_bad from ganpatis
  where slug in ('navjavan-mandal','chimnya-ganpati','balvikas-mandal',
                 'honaji-tarun-mandal','seva-mitra-mandal','hira-bagh-mandal')
    and not (latitude between 18.49 and 18.54 and longitude between 73.83 and 73.88);
  if v_bad is not null then
    raise exception 'Outside the peths: %', v_bad;
  end if;

  select count(*) into v_total from ganpatis where published;
  raise notice 'Verified: 6 mandals added, % published in total.', v_total;
end $$;
