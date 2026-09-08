-- =====================================================================
-- Query functions. Kept in the DB so search/geo logic is not duplicated
-- across client and server, and so we never ship the whole table to the
-- browser just to filter it.
-- =====================================================================

-- Fuzzy search across English name, Marathi name, area and tags.
-- Ranked: exact prefix > word similarity > area match.
create or replace function search_ganpatis(q text, max_results integer default 20)
returns table (
  id uuid, slug text, name text, name_mr text,
  category ganpati_category, area_slug text, area_name text,
  latitude double precision, longitude double precision,
  prominence smallint, rank real
)
language sql stable set search_path = public as $$
  select g.id, g.slug, g.name, g.name_mr, g.category,
         a.slug as area_slug, a.name as area_name,
         g.latitude, g.longitude, g.prominence,
         greatest(
           case when g.name   ilike q || '%' then 1.0
                when g.name   ilike '%' || q || '%' then 0.75 else 0 end,
           case when g.name_mr is not null and g.name_mr ilike '%' || q || '%' then 0.9 else 0 end,
           case when a.name   ilike '%' || q || '%' then 0.6 else 0 end,
           case when exists (
             select 1 from unnest(g.tags) t where t ilike '%' || q || '%'
           ) then 0.5 else 0 end,
           similarity(g.name, q)
         )::real as rank
  from ganpatis g
  join areas a on a.id = g.area_id
  where g.published
    and (
      g.name ilike '%' || q || '%'
      or g.name_mr ilike '%' || q || '%'
      or a.name ilike '%' || q || '%'
      or a.name_mr ilike '%' || q || '%'
      or exists (select 1 from unnest(g.tags) t where t ilike '%' || q || '%')
      or similarity(g.name, q) > 0.2
    )
  order by rank desc, g.prominence desc
  limit least(greatest(max_results, 1), 50);
$$;

-- Nearby lookup using the haversine formula in SQL. Avoids shipping the
-- full catalogue to the device and keeps the ordering authoritative.
create or replace function nearby_ganpatis(
  lat double precision,
  lng double precision,
  radius_m integer default 5000,
  max_results integer default 20
)
returns table (
  id uuid, slug text, name text, name_mr text,
  category ganpati_category, area_slug text, area_name text,
  latitude double precision, longitude double precision,
  prominence smallint, distance_m double precision
)
language sql stable set search_path = public as $$
  with scored as (
    select g.id, g.slug, g.name, g.name_mr, g.category,
           a.slug as area_slug, a.name as area_name,
           g.latitude, g.longitude, g.prominence,
           2 * 6371008.8 * asin(sqrt(
             power(sin(radians(g.latitude - lat) / 2), 2) +
             cos(radians(lat)) * cos(radians(g.latitude)) *
             power(sin(radians(g.longitude - lng) / 2), 2)
           )) as distance_m
    from ganpatis g
    join areas a on a.id = g.area_id
    where g.published
  )
  select * from scored
  where distance_m <= radius_m
  order by distance_m asc
  limit least(greatest(max_results, 1), 50);
$$;
