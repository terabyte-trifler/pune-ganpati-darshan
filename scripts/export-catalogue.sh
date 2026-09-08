#!/usr/bin/env bash
# Regenerates src/content/catalogue.json from the seeded database.
#
# The SQL seed is the single source of truth. This snapshot is what the app
# serves when Supabase is not configured, and what the service worker caches
# for offline use — so it must never be hand-edited.
set -euo pipefail
DB_URL="${1:-postgresql://$(whoami)@localhost:5432/pg_schema_check}"
OUT="$(dirname "$0")/../src/content/catalogue.json"

psql -At -d "$DB_URL" -o "$OUT" <<'SQL'
select jsonb_pretty(jsonb_build_object(
  'generatedAt', to_jsonb(now()),
  'festival', (
    select to_jsonb(f) - 'id' - 'created_at' - 'updated_at'
    from festival_config f where f.is_active limit 1
  ),
  'areas', (
    select coalesce(jsonb_agg(to_jsonb(a) - 'created_at' - 'updated_at' order by a.sort_order), '[]'::jsonb)
    from areas a
  ),
  'categories', (
    select coalesce(jsonb_agg(to_jsonb(c) - 'created_at' - 'updated_at' order by c.sort_order), '[]'::jsonb)
    from categories c
  ),
  'ganpatis', (
    select coalesce(jsonb_agg(
      (to_jsonb(g) - 'created_at' - 'updated_at' - 'area_id')
      || jsonb_build_object(
           'area_slug', ar.slug,
           'area_name', ar.name,
           'area_name_mr', ar.name_mr,
           'area_is_core', ar.is_core,
           'images', coalesce((
             select jsonb_agg(to_jsonb(i) - 'created_at' - 'updated_at' - 'ganpati_id'
                              order by i.sort_order)
             from ganpati_images i where i.ganpati_id = g.id
           ), '[]'::jsonb)
         )
      order by g.prominence desc
    ), '[]'::jsonb)
    from ganpatis g join areas ar on ar.id = g.area_id
    where g.published
  )
));
SQL
echo "wrote $OUT"
