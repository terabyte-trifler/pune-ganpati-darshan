-- =====================================================================
-- Seed: Pune Ganeshotsav catalogue.
--
-- DATA POLICY
--   confidence='verified'  — mandal identity, location and history are
--                            well documented and cross-checkable.
--   confidence='community' — commonly reported locally; coordinates are
--                            accurate to the lane, not the doorway.
--   confidence='demo'      — placeholder, must be replaced before launch.
--
--   Darshan timings are intentionally NULL. Mandals publish them days
--   before the festival; a confident wrong time sends a visitor across
--   the city for nothing. The UI renders "Timings not announced yet"
--   rather than inventing hours.
--
--   `prominence` is an editorial footfall weight (0-1000) used for
--   default ordering. It is NOT a rating and is never shown as stars.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Festival configuration
-- ---------------------------------------------------------------------
insert into festival_config (year, start_date, end_date, visarjan_date, tagline, is_active)
values (2026, '2026-09-14', '2026-09-25', '2026-09-25',
        'Ten days across Pune''s peths', true)
on conflict (year) do update set
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  visarjan_date = excluded.visarjan_date,
  tagline = excluded.tagline,
  is_active = excluded.is_active;

-- ---------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------
insert into categories (key, name, name_mr, description, sort_order) values
  ('maanache','Manache Paach','मानाचे पाच',
   'The five mandals with ceremonial precedence in Pune''s Ganeshotsav procession.',1),
  ('famous','Famous','प्रसिद्ध',
   'The best-known mandals, drawing the heaviest darshan queues.',2),
  ('historic','Historic','ऐतिहासिक',
   'Mandals of long standing, several dating to the festival''s earliest decades.',3),
  ('local','Neighbourhood','स्थानिक',
   'Peth mandals worth folding into a walk between the larger stops.',4)
on conflict (key) do update set
  name = excluded.name, name_mr = excluded.name_mr,
  description = excluded.description, sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------
-- Areas
-- ---------------------------------------------------------------------
insert into areas (slug, name, name_mr, is_core, centroid_lat, centroid_lng, sort_order) values
  ('kasba-peth','Kasba Peth','कसबा पेठ',           true, 18.5196, 73.8553, 1),
  ('budhwar-peth','Budhwar Peth','बुधवार पेठ',     true, 18.5166, 73.8551, 2),
  ('shukrawar-peth','Shukrawar Peth','शुक्रवार पेठ', true, 18.5109, 73.8556, 3),
  ('sadashiv-peth','Sadashiv Peth','सदाशिव पेठ',   true, 18.5106, 73.8511, 4),
  ('narayan-peth','Narayan Peth','नारायण पेठ',     true, 18.5128, 73.8480, 5),
  ('ganesh-peth','Ganesh Peth','गणेश पेठ',         true, 18.5198, 73.8588, 6),
  ('shaniwar-peth','Shaniwar Peth','शनिवार पेठ',   true, 18.5155, 73.8500, 7),
  ('chinchwad','Chinchwad','चिंचवड',              false, 18.6335, 73.7997, 8)
on conflict (slug) do update set
  name = excluded.name, name_mr = excluded.name_mr,
  is_core = excluded.is_core, centroid_lat = excluded.centroid_lat,
  centroid_lng = excluded.centroid_lng, sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------
-- Ganpatis
-- ---------------------------------------------------------------------
insert into ganpatis (
  slug, name, name_mr, description, visitor_tip, category, area_id,
  latitude, longitude, manache_rank, prominence, established_year,
  tags, confidence, featured, verified
)
select v.slug, v.name, v.name_mr, v.description, v.visitor_tip,
       v.category::ganpati_category, a.id,
       v.lat, v.lng, v.manache_rank, v.prominence, v.established_year,
       v.tags, v.confidence::data_confidence, v.featured, v.verified
from (values
  -- ---- Manache Paach (ceremonial order 1-5) ----
  ('kasba-ganpati','Shri Kasba Ganpati','श्री कसबा गणपती',
   'Pune''s gramdaivat and the first of the Manache Paach. Visarjan across the city begins only after this mandal''s procession sets out.',
   'Quietest in the first hour after opening; the lane narrows sharply by mid-morning.',
   'maanache','kasba-peth',18.5196,73.8553,1::smallint,980::smallint,1893::smallint,
   array['manache','gramdaivat','heritage'],'verified',true,true),

  ('tambdi-jogeshwari','Tambdi Jogeshwari Ganpati','तांबडी जोगेश्वरी गणपती',
   'Second of the Manache Paach, set beside the Jogeshwari temple in Budhwar Peth.',
   'A short walk from Kasba Ganpati — the natural second stop on a morning route.',
   'maanache','budhwar-peth',18.5175,73.8556,2::smallint,910::smallint,1893::smallint,
   array['manache','heritage'],'verified',true,true),

  ('guruji-talim','Guruji Talim Ganpati','गुरुजी तालीम गणपती',
   'Third of the Manache Paach, founded in a talim and long associated with Hindu-Muslim collaboration in the festival''s early years.',
   'Sits on Laxmi Road, so approach on foot — the road is closed to vehicles for much of the festival.',
   'maanache','budhwar-peth',18.5163,73.8543,3::smallint,870::smallint,1887::smallint,
   array['manache','talim','heritage'],'verified',true,true),

  ('tulshibaug-ganpati','Tulshibaug Ganpati','तुळशीबाग गणपती',
   'Fourth of the Manache Paach, known for its tall silver idol.',
   'The surrounding market is dense from late morning onward.',
   'maanache','budhwar-peth',18.5148,73.8551,4::smallint,890::smallint,1901::smallint,
   array['manache','silver-idol','market'],'verified',true,true),

  ('kesariwada-ganpati','Kesariwada Ganpati','केसरीवाडा गणपती',
   'Fifth of the Manache Paach, held at Kesari Wada — Lokmanya Tilak''s residence and the office of the newspaper Kesari.',
   'The wada courtyard is calmer than the peth mandals — a good closing stop.',
   'maanache','narayan-peth',18.5126,73.8489,5::smallint,840::smallint,1894::smallint,
   array['manache','tilak','heritage'],'verified',true,true),

  -- ---- Famous ----
  ('dagdusheth-halwai-ganpati','Shrimant Dagdusheth Halwai Ganpati','श्रीमंत दगडूशेठ हलवाई गणपती',
   'Pune''s best-known Ganpati and a year-round temple, drawing the heaviest darshan queues of the festival.',
   'Expect the longest queue of any mandal in the city; early morning is materially faster.',
   'famous','budhwar-peth',18.5163,73.8567,null::smallint,1000::smallint,1893::smallint,
   array['famous','temple','aarti'],'verified',true,true),

  ('akhil-mandai-mandal','Akhil Mandai Mandal','अखिल मंडई मंडळ',
   'Set beside Mahatma Phule Mandai, known for an elaborate stage set built afresh each year.',
   'The decoration reads best after dark.',
   'famous','shukrawar-peth',18.5109,73.8556,null::smallint,820::smallint,1893::smallint,
   array['famous','dekhava','night'],'verified',true,true),

  ('chhatrapati-rajaram-mandal','Chhatrapati Rajaram Mandal','छत्रपती राजाराम मंडळ',
   'Repeatedly recognised for its decoration; a common final stop on evening routes.',
   'Best seen at night, when the lighting is fully on.',
   'famous','sadashiv-peth',18.5094,73.8484,null::smallint,760::smallint,null::smallint,
   array['famous','decoration','night'],'community',false,false),

  ('sarasbaug-ganpati','Shri Siddhivinayak, Sarasbaug','श्री सिद्धिविनायक, सारसबाग',
   'The Talyatla Ganpati temple on its island in Sarasbaug — a calmer alternative to the peth mandals.',
   'Open lawns around the temple make this the easiest stop with children.',
   'famous','sadashiv-peth',18.5010,73.8542,null::smallint,700::smallint,1784::smallint,
   array['famous','temple','park','family'],'verified',true,true),

  ('shri-morya-gosavi','Shri Morya Gosavi Ganpati Mandir','श्री मोरया गोसावी गणपती मंदिर',
   'The Chinchwad temple at the centre of the Morya Gosavi tradition — the main draw in Pimpri-Chinchwad.',
   'Far outside the walkable peth core — plan this as a separate trip.',
   'famous','chinchwad',18.6335,73.7997,null::smallint,680::smallint,null::smallint,
   array['famous','temple','pcmc'],'verified',false,true),

  -- ---- Historic ----
  ('bhau-rangari-ganpati','Shrimant Bhausaheb Rangari Ganpati','श्रीमंत भाऊसाहेब रंगारी गणपती',
   'Among the earliest sarvajanik mandals in Pune, known for its distinctive early idol.',
   'Small and quick — easy to fold into a Manache 5 walk.',
   'historic','budhwar-peth',18.5185,73.8527,null::smallint,720::smallint,1892::smallint,
   array['historic','heritage','early-mandal'],'verified',true,true),

  ('hutatma-babu-genu-mandal','Hutatma Babu Genu Mandal','हुतात्मा बाबू गेनू मंडळ',
   'Named for Babu Genu Said, and known for large themed installations.',
   'Themed dekhava changes each year; evenings draw the crowd.',
   'historic','ganesh-peth',18.5192,73.8590,null::smallint,640::smallint,null::smallint,
   array['historic','dekhava'],'community',false,false),

  ('shanipar-mandal','Shanipar Mandal','शनिपार मंडळ',
   'A long-standing mandal at Shanipar Chowk on the Sadashiv Peth stretch.',
   null,
   'historic','sadashiv-peth',18.5118,73.8523,null::smallint,560::smallint,null::smallint,
   array['historic'],'community',false,false),

  ('nimbalkar-talim-mandal','Nimbalkar Talim Mandal','निंबाळकर तालीम मंडळ',
   'A talim mandal on the Laxmi Road corridor between Tulshibaug and Shanipar.',
   null,
   'historic','budhwar-peth',18.5138,73.8558,null::smallint,540::smallint,null::smallint,
   array['historic','talim'],'community',false,false),

  -- ---- Neighbourhood ----
  ('jilbya-maruti-mandal','Jilbya Maruti Mandal','जिलब्या मारुती मंडळ',
   'A Ganesh Peth mandal on the lane between the peth core and the eastern city.',
   null,
   'local','ganesh-peth',18.5203,73.8585,null::smallint,420::smallint,null::smallint,
   array['local'],'community',false,false),

  ('natu-baug-mandal','Natu Baug Mandal','नातू बाग मंडळ',
   'A Bajirao Road mandal, often paired with Shanipar on evening walks.',
   null,
   'local','sadashiv-peth',18.5107,73.8527,null::smallint,400::smallint,null::smallint,
   array['local'],'community',false,false),

  ('garud-ganpati-mandal','Garud Ganpati Mandal','गरुड गणपती मंडळ',
   'A Shaniwar Peth mandal near Bhide Pul, close to the river end of the peth walk.',
   null,
   'local','shaniwar-peth',18.5155,73.8500,null::smallint,380::smallint,null::smallint,
   array['local'],'community',false,false),

  ('hatti-ganpati-mandal','Hatti Ganpati Mandal','हत्ती गणपती मंडळ',
   'A Narayan Peth mandal named for the elephant figures at its entrance.',
   null,
   'local','narayan-peth',18.5130,73.8470,null::smallint,360::smallint,null::smallint,
   array['local'],'community',false,false)
) as v(slug,name,name_mr,description,visitor_tip,category,area_slug,
       lat,lng,manache_rank,prominence,established_year,tags,confidence,featured,verified)
join areas a on a.slug = v.area_slug
on conflict (slug) do update set
  name = excluded.name, name_mr = excluded.name_mr,
  description = excluded.description, visitor_tip = excluded.visitor_tip,
  category = excluded.category, area_id = excluded.area_id,
  latitude = excluded.latitude, longitude = excluded.longitude,
  manache_rank = excluded.manache_rank, prominence = excluded.prominence,
  established_year = excluded.established_year, tags = excluded.tags,
  confidence = excluded.confidence, featured = excluded.featured,
  verified = excluded.verified;
