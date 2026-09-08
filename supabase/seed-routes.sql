-- =====================================================================
-- Dwell times and curated routes.
--
-- DATA POLICY (same as the mandal seed)
--   darshan_minutes is an ESTIMATE of time spent at the mandal — queue plus
--   darshan — not travel. Values reflect the well-known relative pattern:
--   Dagdusheth's queue dwarfs everything else; the Manache Paach are steady
--   but manageable; small peth mandals are a few minutes.
--
--   These are honest orders of magnitude, not measured figures, and the UI
--   labels every derived total as an estimate. Where a mandal's queue is
--   genuinely unpredictable, peak_darshan_minutes records the bad case
--   rather than pretending a single number holds all day.
-- =====================================================================

update ganpatis set darshan_minutes = v.mins,
                    peak_darshan_minutes = v.peak,
                    darshan_style = v.style::darshan_style
from (values
  -- Manache Paach: ceremonial stops, steady queues.
  ('kasba-ganpati',              15, 40,  'inside'),
  ('tambdi-jogeshwari',          12, 30,  'inside'),
  ('guruji-talim',                8, 20,  'either'),
  ('tulshibaug-ganpati',         20, 45,  'inside'),
  ('kesariwada-ganpati',         15, 30,  'inside'),
  -- The outlier: Pune's heaviest darshan queue by a wide margin.
  ('dagdusheth-halwai-ganpati',  45, 150, 'inside'),
  -- Dekhava mandals: the draw is the set, viewed from the road.
  ('akhil-mandai-mandal',        12, 30,  'outside'),
  ('chhatrapati-rajaram-mandal', 10, 25,  'outside'),
  ('hutatma-babu-genu-mandal',   10, 25,  'outside'),
  -- Temples with space around them.
  ('sarasbaug-ganpati',          25, 60,  'inside'),
  ('shri-morya-gosavi',          20, 50,  'inside'),
  -- Historic and neighbourhood mandals: quick stops.
  ('bhau-rangari-ganpati',        8, 20,  'either'),
  ('shanipar-mandal',             6, 15,  'outside'),
  ('nimbalkar-talim-mandal',      6, 15,  'either'),
  ('jilbya-maruti-mandal',        5, 12,  'outside'),
  ('natu-baug-mandal',            5, 12,  'outside'),
  ('garud-ganpati-mandal',        5, 12,  'outside'),
  ('hatti-ganpati-mandal',        5, 12,  'outside')
) as v(slug, mins, peak, style)
where ganpatis.slug = v.slug;

-- ---------------------------------------------------------------------
-- Curated routes
-- ---------------------------------------------------------------------
insert into routes (slug, title, title_mr, summary, description, mode, time_of_day, themes, featured, sort_order)
values
  ('manache-5-sakal-walk',
   'Manache 5 Sakal Walk', 'मानाचे पाच — सकाळ दर्शन',
   'All five Manache Paach in ceremonial order, on foot, before the peths fill up.',
   'The five mandals with ceremonial precedence, walked in the order the procession follows. Starting early matters more here than anywhere else: the same walk after 10am takes roughly twice as long.',
   'walk', 'morning', array['manache','heritage','essential'], true, 1),

  ('dagdusheth-and-around',
   'Dagdusheth & the Budhwar Peth core', 'दगडूशेठ आणि बुधवार पेठ',
   'Pune''s best-known Ganpati plus the mandals within a few minutes'' walk of it.',
   'Built around the longest queue in the city. Dagdusheth alone can take the better part of an hour at peak, so the surrounding stops are deliberately short ones you can fold in either side of it.',
   'walk', 'morning', array['famous','essential'], true, 2),

  ('evening-dekhava-trail',
   'Evening dekhava trail', 'संध्याकाळचा देखावा',
   'The mandals whose decorated sets are the point — best after dark.',
   'These mandals are experienced from the road rather than in a queue, so the route moves quickly. Everything here reads better once the lighting is fully on.',
   'walk', 'evening', array['dekhava','lights','night'], true, 3),

  ('peth-express-90',
   '90-minute peth express', 'दीड तासात पेठ दर्शन',
   'The most ground you can genuinely cover in an hour and a half on foot.',
   'Deliberately skips the heaviest queues. This is the route for someone passing through Pune with a narrow window rather than a full day.',
   'walk', 'any', array['essential','quick'], true, 4),

  ('historic-peth-stroll',
   'Historic peth stroll', 'ऐतिहासिक पेठ फेरी',
   'The oldest sarvajanik mandals, and the wadas and talims they grew out of.',
   'Follows the festival''s own history: Bhau Rangari''s early idol, the talim mandals, and Kesari Wada where Tilak ran the newspaper that helped make Ganeshotsav public.',
   'walk', 'any', array['historic','heritage'], false, 5)
on conflict (slug) do update set
  title = excluded.title, title_mr = excluded.title_mr,
  summary = excluded.summary, description = excluded.description,
  mode = excluded.mode, time_of_day = excluded.time_of_day,
  themes = excluded.themes, featured = excluded.featured,
  sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------
-- Stops
-- ---------------------------------------------------------------------
insert into route_stops (route_id, ganpati_id, position, darshan_minutes, darshan_style, note)
select r.id, g.id, v.pos, v.mins, v.style::darshan_style, v.note
from (values
  -- Manache 5, ceremonial order
  ('manache-5-sakal-walk','kasba-ganpati',              0, 15, 'inside',  'Start here — the city''s gramdaivat and first of the five.'),
  ('manache-5-sakal-walk','tambdi-jogeshwari',          1, 12, 'inside',  'A short walk down from Kasba.'),
  ('manache-5-sakal-walk','guruji-talim',               2,  8, 'either',  'On Laxmi Road; approach on foot.'),
  ('manache-5-sakal-walk','tulshibaug-ganpati',         3, 20, 'inside',  'The market around it thickens from late morning.'),
  ('manache-5-sakal-walk','kesariwada-ganpati',         4, 15, 'inside',  'The wada courtyard is a calm place to finish.'),

  -- Dagdusheth core
  ('dagdusheth-and-around','bhau-rangari-ganpati',      0,  8, 'either',  'Quick first stop before the queue.'),
  ('dagdusheth-and-around','dagdusheth-halwai-ganpati', 1, 45, 'inside',  'The long one. Early morning is materially faster.'),
  ('dagdusheth-and-around','tambdi-jogeshwari',         2, 12, 'inside',  null),
  ('dagdusheth-and-around','tulshibaug-ganpati',        3, 20, 'inside',  null),
  ('dagdusheth-and-around','nimbalkar-talim-mandal',    4,  6, 'either',  'On the Laxmi Road stretch back.'),

  -- Evening dekhava
  ('evening-dekhava-trail','akhil-mandai-mandal',       0, 12, 'outside', 'The stage set is rebuilt every year.'),
  ('evening-dekhava-trail','chhatrapati-rajaram-mandal',1, 10, 'outside', 'Best once the lighting is fully on.'),
  ('evening-dekhava-trail','hutatma-babu-genu-mandal',  2, 10, 'outside', 'Large themed installation, changes yearly.'),
  ('evening-dekhava-trail','shanipar-mandal',           3,  6, 'outside', null),
  ('evening-dekhava-trail','natu-baug-mandal',          4,  5, 'outside', 'Often paired with Shanipar on evening walks.'),

  -- 90-minute express
  ('peth-express-90','kasba-ganpati',                   0, 15, 'inside',  null),
  ('peth-express-90','tambdi-jogeshwari',               1, 12, 'inside',  null),
  ('peth-express-90','guruji-talim',                    2,  8, 'either',  null),
  ('peth-express-90','tulshibaug-ganpati',              3, 20, 'inside',  'Skip the queue here if you are tight on time.'),

  -- Historic stroll
  ('historic-peth-stroll','bhau-rangari-ganpati',       0,  8, 'either',  'Among the earliest sarvajanik mandals in Pune.'),
  ('historic-peth-stroll','guruji-talim',               1,  8, 'either',  'Founded in a talim; an early symbol of shared celebration.'),
  ('historic-peth-stroll','nimbalkar-talim-mandal',     2,  6, 'either',  null),
  ('historic-peth-stroll','kesariwada-ganpati',         3, 15, 'inside',  'Tilak''s residence and the Kesari office.'),
  ('historic-peth-stroll','shanipar-mandal',            4,  6, 'outside', null)
) as v(route_slug, mandal_slug, pos, mins, style, note)
join routes r on r.slug = v.route_slug
join ganpatis g on g.slug = v.mandal_slug
on conflict (route_id, position) do update set
  ganpati_id = excluded.ganpati_id,
  darshan_minutes = excluded.darshan_minutes,
  darshan_style = excluded.darshan_style,
  note = excluded.note;

-- Cache the darshan total so index pages need no computation.
update routes set total_darshan_s = sub.secs
from (
  select route_id, sum(coalesce(darshan_minutes, 0)) * 60 as secs
  from route_stops group by route_id
) sub
where routes.id = sub.route_id;
