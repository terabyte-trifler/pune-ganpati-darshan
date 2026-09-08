-- =====================================================================
-- Additional curated routes.
--
-- Route shapes are inspired by what a Pune visitor actually asks for — a
-- full-day circuit, a one-hour dash, an evening of dekhava — but the titles,
-- copy and stop lists are our own, built from this catalogue's 18 mandals and
-- their measured dwell times.
--
-- Every stop is a real mandal with real coordinates. Where a route implies
-- quicker viewing than the mandal's default (a late-night visit, or an
-- express run), the per-stop darshan_minutes overrides it rather than
-- pretending the queue vanishes.
-- =====================================================================

insert into routes (slug, title, title_mr, summary, description, mode, time_of_day, themes, featured, sort_order) values
  ('great-peth-circuit', 'The Great Peth Circuit', 'संपूर्ण पेठ फेरी', 'Every major mandal in the old peths, walked end to end. A full day.', 'The complete walk: twelve mandals from Kasba in the north down to Kesari Wada, taking in the Manache Paach, Dagdusheth and the big dekhava mandals on the way. Budget a whole day — the queue at Dagdusheth alone can swallow an hour, and this route is as much about the peth lanes between the stops as the stops themselves.', 'walk', 'morning', array['essential','manache','heritage','dekhava']::text[], true, 6),
  ('manache-and-landmarks', 'Manache Paach & the old landmarks', 'मानाचे पाच आणि ऐतिहासिक स्थळे', 'The five ceremonial mandals, plus the historic ones that grew up around them.', 'Follows the Manache Paach in order, but folds in Bhau Rangari''s early idol and the talim mandals that sit between them. A good route if you want the ceremony and the history in one walk rather than choosing.', 'walk', 'morning', array['manache','historic','heritage']::text[], true, 7),
  ('mandai-to-the-river', 'Mandai to the river', 'मंडईपासून नदीपर्यंत', 'South to north across the peths, from the market to the Shaniwar Peth riverside.', 'A directional walk rather than a loop: start at the Mandai market end and finish near Bhide Pul. Useful if you are heading that way anyway, and it strings together mandals that a circular route tends to miss.', 'walk', 'afternoon', array['essential','dekhava']::text[], false, 8),
  ('sadashiv-after-dark', 'Sadashiv Peth after dark', 'सदाशिव पेठ — रात्रीचे दर्शन', 'The Sadashiv Peth stretch, where the decoration is the draw.', 'These mandals are viewed from the road rather than queued for, so the walk moves quickly and works well late. The lighting and the stage sets are the reason to come.', 'walk', 'night', array['dekhava','lights','night']::text[], false, 9),
  ('two-peths-on-foot', 'Narayan & Budhwar on foot', 'नारायण आणि बुधवार पेठ', 'Two neighbouring peths, six mandals, one unhurried walk.', 'Stays inside a small area, so there is very little walking between stops. A sensible choice when you have a couple of hours and would rather see a few mandals properly than rush across the city.', 'walk', 'any', array['heritage','historic']::text[], false, 10),
  ('mandai-hour', 'One hour from Mandai', 'मंडईतून एक तास', 'Four mandals within a short walk of Mandai, in about an hour.', 'Built for a genuinely narrow window. It deliberately avoids Dagdusheth, because a single queue there would consume the whole hour and leave nothing for the rest.', 'walk', 'any', array['quick','essential']::text[], true, 11),
  ('narayan-peth-wadas', 'Narayan Peth: wadas and sets', 'नारायण पेठ — वाडे आणि देखावे', 'Kesari Wada and the Narayan Peth mandals around it.', 'Centred on Kesari Wada, where Tilak ran the newspaper that helped turn Ganeshotsav into a public festival. Short, and heavier on history than spectacle.', 'walk', 'afternoon', array['historic','heritage']::text[], false, 12),
  ('easy-with-children', 'Easy darshan with children', 'मुलांसोबत सोपे दर्शन', 'Open spaces, short queues and somewhere to sit.', 'Chosen for practicality rather than prestige: Sarasbaug has lawns and room to move, and the other stops are quick roadside darshan rather than long queues in a crowded lane. Deliberately avoids the heaviest crowds.', 'walk', 'morning', array['family','temple','quick']::text[], true, 13),
  ('late-night-short-queues', 'Late night, short queues', 'रात्री उशिरा — कमी गर्दी', 'The same mandals, without the wait — if you can stay up.', 'Queues thin considerably late at night while the lighting stays on. This route favours mandals worth seeing after dark and is ordered so the longest queue comes when it is shortest.', 'walk', 'night', array['night','lights','quick']::text[], false, 14),
  ('first-evening-in-pune', 'Your first evening in Pune', 'पहिली संध्याकाळ', 'If you only get one evening, these are the ones.', 'A short list for a first visit: the mandal everyone means when they say Pune Ganpati, two of the Manache Paach nearby, and one big dekhava to finish on.', 'walk', 'evening', array['essential','famous','dekhava']::text[], true, 15),
  ('chinchwad-morya-gosavi', 'Chinchwad: Morya Gosavi', 'चिंचवड — मोरया गोसावी', 'The Chinchwad temple, as its own trip rather than a peth stop.', 'Morya Gosavi sits about 15 km north-west of the peths, so it does not belong on a walking route and this is listed separately and honestly. Treat it as a half-day of its own; it is the centre of the Morya Gosavi tradition and the main draw in Pimpri-Chinchwad.', 'drive', 'any', array['temple','famous','pcmc']::text[], false, 16)
on conflict (slug) do update set
  title = excluded.title, title_mr = excluded.title_mr,
  summary = excluded.summary, description = excluded.description,
  mode = excluded.mode, time_of_day = excluded.time_of_day,
  themes = excluded.themes, featured = excluded.featured,
  sort_order = excluded.sort_order;

insert into route_stops (route_id, ganpati_id, position, darshan_minutes, darshan_style, note)
select r.id, g.id, v.pos, v.mins, v.style::darshan_style, v.note
from (values
  ('great-peth-circuit', 'kasba-ganpati', 0, 15, 'inside', 'Start at the gramdaivat, before the lanes fill.'),
  ('great-peth-circuit', 'jilbya-maruti-mandal', 1, 5, 'outside', null),
  ('great-peth-circuit', 'hutatma-babu-genu-mandal', 2, 10, 'outside', 'Large themed set, changes each year.'),
  ('great-peth-circuit', 'tambdi-jogeshwari', 3, 12, 'inside', null),
  ('great-peth-circuit', 'dagdusheth-halwai-ganpati', 4, 45, 'inside', 'The long queue. Go now rather than later.'),
  ('great-peth-circuit', 'bhau-rangari-ganpati', 5, 8, 'either', 'One of the earliest sarvajanik mandals.'),
  ('great-peth-circuit', 'guruji-talim', 6, 8, 'either', 'On Laxmi Road — closed to vehicles for much of the festival.'),
  ('great-peth-circuit', 'tulshibaug-ganpati', 7, 20, 'inside', null),
  ('great-peth-circuit', 'nimbalkar-talim-mandal', 8, 6, 'either', null),
  ('great-peth-circuit', 'akhil-mandai-mandal', 9, 12, 'outside', 'Beside Mahatma Phule Mandai.'),
  ('great-peth-circuit', 'shanipar-mandal', 10, 6, 'outside', null),
  ('great-peth-circuit', 'kesariwada-ganpati', 11, 15, 'inside', 'Finish in the wada courtyard.'),
  ('manache-and-landmarks', 'kasba-ganpati', 0, 15, 'inside', 'First of the Manache Paach.'),
  ('manache-and-landmarks', 'tambdi-jogeshwari', 1, 12, 'inside', null),
  ('manache-and-landmarks', 'bhau-rangari-ganpati', 2, 8, 'either', 'Not one of the five, but older than most of them.'),
  ('manache-and-landmarks', 'guruji-talim', 3, 8, 'either', null),
  ('manache-and-landmarks', 'nimbalkar-talim-mandal', 4, 6, 'either', 'The second talim mandal on this walk.'),
  ('manache-and-landmarks', 'tulshibaug-ganpati', 5, 20, 'inside', null),
  ('manache-and-landmarks', 'shanipar-mandal', 6, 6, 'outside', null),
  ('manache-and-landmarks', 'kesariwada-ganpati', 7, 15, 'inside', 'Tilak''s residence and the Kesari office.'),
  ('mandai-to-the-river', 'akhil-mandai-mandal', 0, 12, 'outside', 'Start at the market.'),
  ('mandai-to-the-river', 'natu-baug-mandal', 1, 5, 'outside', null),
  ('mandai-to-the-river', 'shanipar-mandal', 2, 6, 'outside', null),
  ('mandai-to-the-river', 'tulshibaug-ganpati', 3, 20, 'inside', null),
  ('mandai-to-the-river', 'nimbalkar-talim-mandal', 4, 6, 'either', null),
  ('mandai-to-the-river', 'bhau-rangari-ganpati', 5, 8, 'either', null),
  ('mandai-to-the-river', 'garud-ganpati-mandal', 6, 5, 'outside', 'Near Bhide Pul, at the river end.'),
  ('sadashiv-after-dark', 'shanipar-mandal', 0, 6, 'outside', null),
  ('sadashiv-after-dark', 'natu-baug-mandal', 1, 5, 'outside', 'On the Bajirao Road stretch.'),
  ('sadashiv-after-dark', 'chhatrapati-rajaram-mandal', 2, 10, 'outside', 'Wait until the lighting is fully on.'),
  ('sadashiv-after-dark', 'akhil-mandai-mandal', 3, 12, 'outside', 'The stage set reads best after dark.'),
  ('sadashiv-after-dark', 'hatti-ganpati-mandal', 4, 5, 'outside', null),
  ('two-peths-on-foot', 'kesariwada-ganpati', 0, 15, 'inside', null),
  ('two-peths-on-foot', 'hatti-ganpati-mandal', 1, 5, 'outside', 'Named for the elephants at its entrance.'),
  ('two-peths-on-foot', 'nimbalkar-talim-mandal', 2, 6, 'either', null),
  ('two-peths-on-foot', 'tulshibaug-ganpati', 3, 20, 'inside', null),
  ('two-peths-on-foot', 'guruji-talim', 4, 8, 'either', null),
  ('two-peths-on-foot', 'bhau-rangari-ganpati', 5, 8, 'either', null),
  ('mandai-hour', 'akhil-mandai-mandal', 0, 12, 'outside', null),
  ('mandai-hour', 'shanipar-mandal', 1, 6, 'outside', null),
  ('mandai-hour', 'natu-baug-mandal', 2, 5, 'outside', null),
  ('mandai-hour', 'tulshibaug-ganpati', 3, 10, 'outside', 'Darshan from outside here — the queue alone would break the hour.'),
  ('narayan-peth-wadas', 'kesariwada-ganpati', 0, 15, 'inside', 'The reason for this route.'),
  ('narayan-peth-wadas', 'hatti-ganpati-mandal', 1, 5, 'outside', null),
  ('narayan-peth-wadas', 'chhatrapati-rajaram-mandal', 2, 10, 'outside', null),
  ('narayan-peth-wadas', 'shanipar-mandal', 3, 6, 'outside', null),
  ('easy-with-children', 'sarasbaug-ganpati', 0, 25, 'inside', 'Open lawns and room to sit — the easiest stop with children.'),
  ('easy-with-children', 'chhatrapati-rajaram-mandal', 1, 10, 'outside', 'Seen from the road, so no queue.'),
  ('easy-with-children', 'shanipar-mandal', 2, 6, 'outside', null),
  ('easy-with-children', 'natu-baug-mandal', 3, 5, 'outside', null),
  ('late-night-short-queues', 'chhatrapati-rajaram-mandal', 0, 10, 'outside', null),
  ('late-night-short-queues', 'akhil-mandai-mandal', 1, 12, 'outside', null),
  ('late-night-short-queues', 'hutatma-babu-genu-mandal', 2, 10, 'outside', null),
  ('late-night-short-queues', 'tulshibaug-ganpati', 3, 12, 'inside', 'Queue is far shorter at this hour than at midday.'),
  ('late-night-short-queues', 'dagdusheth-halwai-ganpati', 4, 25, 'inside', 'Still the longest wait here, but a fraction of the daytime queue.'),
  ('first-evening-in-pune', 'dagdusheth-halwai-ganpati', 0, 45, 'inside', 'The one most people mean by ''Pune Ganpati''.'),
  ('first-evening-in-pune', 'tambdi-jogeshwari', 1, 12, 'inside', null),
  ('first-evening-in-pune', 'tulshibaug-ganpati', 2, 20, 'inside', null),
  ('first-evening-in-pune', 'akhil-mandai-mandal', 3, 12, 'outside', 'Finish on the dekhava, after dark.'),
  ('chinchwad-morya-gosavi', 'shri-morya-gosavi', 0, 20, 'inside', 'About 15 km from the peths — plan this as its own trip.')
) as v(route_slug, mandal_slug, pos, mins, style, note)
join routes r on r.slug = v.route_slug
join ganpatis g on g.slug = v.mandal_slug
on conflict (route_id, position) do update set
  ganpati_id = excluded.ganpati_id,
  darshan_minutes = excluded.darshan_minutes,
  darshan_style = excluded.darshan_style,
  note = excluded.note;

update routes set total_darshan_s = sub.secs
from (select route_id, sum(coalesce(darshan_minutes,0))*60 as secs
      from route_stops group by route_id) sub
where routes.id = sub.route_id;
