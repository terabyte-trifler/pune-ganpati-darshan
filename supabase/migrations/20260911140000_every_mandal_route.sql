-- =====================================================================
-- "Every mandal, from Kasba" — the complete circuit, in optimised order.
--
-- Requested by the owner: one route covering every festival mandal in the
-- catalogue, starting at Kasba Ganpati, MANDALS ONLY.
--
-- ---------------------------------------------------------------------
-- What "mandals only" excludes, and why it matters.
--
-- Three entries carry is_temple — sarasbaug-ganpati, trishund-ganpati-mandir
-- and shri-morya-gosavi. They are year-round temples rather than festival
-- pandals, and Morya Gosavi is 15 km away in Chinchwad besides. Putting any
-- of them on a peth walking circuit would be wrong twice over. That leaves
-- 26 of the 29 mandals.
--
-- ---------------------------------------------------------------------
-- The order is computed, not curated.
--
-- Nearest-neighbour from the fixed start, then 2-opt to convergence, over
-- haversine distances — the same shape as the app's own optimiser. The
-- result is 5.98 km of straight-line path across 26 stops, which is about
-- 10.2 km of real walking once the peth lanes are followed.
--
-- Kasba is pinned first because it is the gramdaivat and the first of the
-- Manache Paach, and because starting north means Dagdusheth is reached
-- inside the first hour — where its queue costs 45 minutes rather than the
-- two hours it costs by afternoon.
--
-- ---------------------------------------------------------------------
-- Ten mandals had no dwell time at all.
--
-- The six added on 10 September plus four older entries were never given
-- darshan_minutes, so every estimate that touched them silently used the
-- fallback. Filling them here fixes this route and every other surface that
-- sums dwell — the planner, the route cards and the live route time.
-- =====================================================================

update ganpatis set darshan_minutes = v.mins,
                    peak_darshan_minutes = v.peak,
                    darshan_style = v.style::darshan_style
from (values
  ('phani-ali-ganesh-mandir', 6, 15, 'either'),
  ('balvikas-mandal', 5, 12, 'outside'),
  ('honaji-tarun-mandal', 6, 15, 'outside'),
  ('chimnya-ganpati', 6, 15, 'either'),
  ('mati-ganpati', 5, 12, 'outside'),
  ('navjavan-mandal', 5, 12, 'outside'),
  ('perugate-bhave-mandal', 6, 15, 'outside'),
  ('chinchechi-talim-ganpati', 6, 15, 'either'),
  ('seva-mitra-mandal', 5, 12, 'outside'),
  ('hira-bagh-mandal', 5, 12, 'outside')
) as v(slug, mins, peak, style)
where ganpatis.slug = v.slug;

insert into routes (slug, title, title_mr, summary, description, mode, time_of_day, themes, featured, sort_order)
values (
  'every-mandal-from-kasba',
  'Every mandal, from Kasba',
  'सर्व मंडळे — कसब्यापासून',
  'All 26 festival mandals in one walk, ordered for the least walking.',
  'The complete circuit: every sarvajanik mandal in the catalogue, in the order that covers them with the least walking. It starts at Kasba Ganpati — the gramdaivat and the first of the Manache Paach — runs south through Budhwar and Shukrawar Peth, crosses west through Narayan and Shaniwar, and finishes at Hira Bagh. Dagdusheth comes ninth, inside the first hour, because that is the only time its queue is 45 minutes rather than two. Budget the whole day: about 10 km of walking and four hours of darshan, and the peth lanes between the stops are half the point. Temples are deliberately left out — Sarasbaug, Trishund and Morya Gosavi are year-round temples, not festival pandals, and Morya Gosavi is 15 km away.',
  'walk', 'morning',
  array['essential','manache','heritage','dekhava']::text[],
  true, 17
)
on conflict (slug) do update set
  title = excluded.title, title_mr = excluded.title_mr,
  summary = excluded.summary, description = excluded.description,
  mode = excluded.mode, time_of_day = excluded.time_of_day,
  themes = excluded.themes, featured = excluded.featured,
  sort_order = excluded.sort_order;

delete from route_stops
 where route_id = (select id from routes where slug = 'every-mandal-from-kasba');

insert into route_stops (route_id, ganpati_id, position, darshan_minutes, darshan_style, note)
select r.id, g.id, v.pos, v.mins, v.style::darshan_style, v.note
from (values
  ('every-mandal-from-kasba', 'kasba-ganpati', 0, 15, 'inside', 'Start at the gramdaivat, first of the Manache Paach and the quietest hour of the day.'),
  ('every-mandal-from-kasba', 'phani-ali-ganesh-mandir', 1, 6, 'either', null),
  ('every-mandal-from-kasba', 'bhau-rangari-ganpati', 2, 8, 'either', 'One of the earliest sarvajanik mandals in the city.'),
  ('every-mandal-from-kasba', 'balvikas-mandal', 3, 5, 'outside', null),
  ('every-mandal-from-kasba', 'tambdi-jogeshwari', 4, 12, 'inside', 'Second of the Manache Paach.'),
  ('every-mandal-from-kasba', 'guruji-talim', 5, 8, 'either', 'Third of the Manache Paach, on Laxmi Road.'),
  ('every-mandal-from-kasba', 'tulshibaug-ganpati', 6, 20, 'inside', 'Fourth of the Manache Paach, inside the market lanes.'),
  ('every-mandal-from-kasba', 'jilbya-maruti-mandal', 7, 5, 'outside', null),
  ('every-mandal-from-kasba', 'hutatma-babu-genu-mandal', 8, 10, 'outside', null),
  ('every-mandal-from-kasba', 'dagdusheth-halwai-ganpati', 9, 45, 'inside', 'The long one, reached early on purpose. Later in the day this queue alone can take two hours.'),
  ('every-mandal-from-kasba', 'honaji-tarun-mandal', 10, 6, 'outside', null),
  ('every-mandal-from-kasba', 'akhil-mandai-mandal', 11, 12, 'outside', 'Beside Mahatma Phule Mandai.'),
  ('every-mandal-from-kasba', 'natu-baug-mandal', 12, 5, 'outside', null),
  ('every-mandal-from-kasba', 'chimnya-ganpati', 13, 6, 'either', null),
  ('every-mandal-from-kasba', 'nimbalkar-talim-mandal', 14, 6, 'either', null),
  ('every-mandal-from-kasba', 'shanipar-mandal', 15, 6, 'outside', null),
  ('every-mandal-from-kasba', 'kesariwada-ganpati', 16, 15, 'inside', 'Fifth of the Manache Paach, in Tilak''s wada.'),
  ('every-mandal-from-kasba', 'mati-ganpati', 17, 5, 'outside', null),
  ('every-mandal-from-kasba', 'garud-ganpati-mandal', 18, 5, 'outside', null),
  ('every-mandal-from-kasba', 'hatti-ganpati-mandal', 19, 5, 'outside', null),
  ('every-mandal-from-kasba', 'chhatrapati-rajaram-mandal', 20, 10, 'outside', null),
  ('every-mandal-from-kasba', 'navjavan-mandal', 21, 5, 'outside', null),
  ('every-mandal-from-kasba', 'perugate-bhave-mandal', 22, 6, 'outside', null),
  ('every-mandal-from-kasba', 'chinchechi-talim-ganpati', 23, 6, 'either', null),
  ('every-mandal-from-kasba', 'seva-mitra-mandal', 24, 5, 'outside', null),
  ('every-mandal-from-kasba', 'hira-bagh-mandal', 25, 5, 'outside', 'The southern end. Turn back at Perugate instead if the light has gone.')
) as v(route_slug, ganpati_slug, pos, mins, style, note)
join routes r on r.slug = v.route_slug
join ganpatis g on g.slug = v.ganpati_slug;

-- ---------------------------------------------------------------------
-- Proof, in the same transaction.
--
-- A slug typo in a 26-row VALUES list drops that stop silently: the join
-- simply matches nothing and the route is short by one mandal, which looks
-- identical to success on the route card.
-- ---------------------------------------------------------------------
do $$
declare
  v_stops    integer;
  v_expected integer;
  v_temples  integer;
  v_nodwell  integer;
begin
  select count(*) into v_stops
    from route_stops rs
    join routes r on r.id = rs.route_id
   where r.slug = 'every-mandal-from-kasba';

  select count(*) into v_expected from ganpatis where not is_temple;

  if v_stops <> v_expected then
    raise exception 'Route has % stops but there are % non-temple mandals', v_stops, v_expected;
  end if;

  select count(*) into v_temples
    from route_stops rs
    join routes r on r.id = rs.route_id
    join ganpatis g on g.id = rs.ganpati_id
   where r.slug = 'every-mandal-from-kasba' and g.is_temple;

  if v_temples > 0 then
    raise exception 'Route contains % temple(s) — it is meant to be mandals only', v_temples;
  end if;

  if (select g.slug from route_stops rs
        join routes r on r.id = rs.route_id
        join ganpatis g on g.id = rs.ganpati_id
       where r.slug = 'every-mandal-from-kasba' and rs.position = 0) <> 'kasba-ganpati' then
    raise exception 'Route does not start at Kasba Ganpati';
  end if;

  select count(*) into v_nodwell from ganpatis
   where not is_temple and (darshan_minutes is null or darshan_minutes = 0);

  if v_nodwell > 0 then
    raise exception '% mandals still have no darshan_minutes', v_nodwell;
  end if;

  raise notice 'Verified: % stops, no temples, starts at Kasba, every mandal has a dwell time.', v_stops;
end $$;
