#!/usr/bin/env bash
# Applies schema + RLS + functions + seed to a hosted Supabase project, then
# verifies the result. Safe to re-run: every migration object is created with
# guards and the seed upserts.
#
#   PGPASSWORD=... PROJECT_REF=... ./scripts/setup-supabase.sh
#
# Tries the direct (IPv6) host first, then the session poolers, so it works
# from networks with or without IPv6 egress.
set -uo pipefail

: "${PROJECT_REF:?set PROJECT_REF}"
: "${PGPASSWORD:?set PGPASSWORD}"
REGION="${REGION:-ap-south-1}"
cd "$(dirname "$0")/.."

# Host/user pairs rather than a URL: passwords routinely contain @, $, # and
# / which would have to be percent-encoded inside a connection string. psql
# reads PGPASSWORD from the environment, so no encoding is involved at all.
CANDIDATES=(
  "db.${PROJECT_REF}.supabase.co|postgres"
  "aws-0-${REGION}.pooler.supabase.com|postgres.${PROJECT_REF}"
  "aws-1-${REGION}.pooler.supabase.com|postgres.${PROJECT_REF}"
)

PGHOST=""; PGUSER=""
for pair in "${CANDIDATES[@]}"; do
  host="${pair%%|*}"; user="${pair##*|}"
  if psql -h "$host" -p 5432 -U "$user" -d postgres -c 'select 1' >/dev/null 2>&1; then
    PGHOST="$host"; PGUSER="$user"; echo "✓ connected via ${host}"; break
  fi
  echo "  ✗ ${host}"
done
[ -z "$PGHOST" ] && { echo "Could not connect. Check the database password."; exit 1; }

# Wrapper so every call below shares the resolved host/user.
pg() { psql -h "$PGHOST" -p 5432 -U "$PGUSER" -d postgres "$@"; }

echo
echo "── applying migrations ──"
for f in supabase/migrations/*.sql; do
  printf '  %-34s' "$(basename "$f")"
  if out=$(pg -v ON_ERROR_STOP=1 -q -f "$f" 2>&1); then
    echo "ok"
  else
    # Re-runs hit "already exists"; that is expected and not a failure.
    if grep -qi 'already exists' <<<"$out"; then echo "ok (already applied)";
    else echo "FAILED"; echo "$out" | tail -5; exit 1; fi
  fi
done

echo
echo "── seeding ──"
if out=$(pg -v ON_ERROR_STOP=1 -q -f supabase/seed.sql 2>&1); then
  echo "  seed ok"
else
  echo "  seed FAILED"; echo "$out" | tail -5; exit 1
fi

echo
echo "── verifying ──"
pg -At <<'SQL' | sed 's/^/  /'
select 'ganpatis        ' || count(*) from ganpatis;
select 'areas           ' || count(*) from areas;
select 'categories      ' || count(*) from categories;
select 'festival_config ' || count(*) from festival_config;
select 'RLS tables      ' || count(*) || '/10 enabled'
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and c.relrowsecurity;
select 'policies        ' || count(*) from pg_policies where schemaname='public';
select 'search("Dagdu") ' || name from search_ganpatis('Dagdu',1);
select 'nearby(Kasba)   ' || name || ' @ ' || round(distance_m) || 'm'
  from nearby_ganpatis(18.5196,73.8553,400,2) offset 1 limit 1;
SQL

echo
echo "Done — connected as ${PGUSER}@${PGHOST}"
