/**
 * Verifies RLS against the live project using a real anon JWT.
 *
 * This is the check local Postgres could not perform: locally there is no
 * PostgREST, no `anon` role and no JWT, so policies were only inspected
 * statically. Here they are actually exercised.
 *
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... node tools/verify-rls.mjs
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY');
  process.exit(1);
}

const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const results = [];

const check = (name, pass, detail = '') =>
  results.push({ name, pass, detail });

// 1. Public catalogue must be readable by anyone.
{
  const { data, error } = await anon.from('ganpatis').select('slug');
  check('anon CAN read ganpatis', !error && data?.length === 18,
    error ? error.message : `${data?.length} rows`);
}
{
  const { data, error } = await anon.from('areas').select('slug');
  check('anon CAN read areas', !error && data?.length === 8,
    error ? error.message : `${data?.length} rows`);
}

// 2. The analytics stream must not be readable.
//
// Ordering matters: we INSERT first, then read back. A plain "select returns
// 0 rows" assertion is worthless on an empty table — it passes even with RLS
// disabled. Because the insert below is confirmed to succeed, at least one
// row provably exists, so a subsequent empty read is real proof that the
// SELECT policy is denying us rather than the table simply being empty.
{
  const { error } = await anon.from('analytics_events').insert({ name: 'rls_probe' });
  check('anon CAN insert analytics', !error, error ? error.message : 'accepted');

  if (!error) {
    const { data, error: readError } = await anon
      .from('analytics_events').select('id, name');
    check(
      'anon CANNOT read back its own insert',
      Boolean(readError) || data?.length === 0,
      readError ? `denied (${readError.code ?? 'error'})`
                : data?.length === 0
                  ? 'row exists but is invisible — policy holds'
                  : `LEAK: ${data.length} rows visible`
    );
  }
}

// 3. Anonymous writes to the catalogue must be rejected.
{
  const { error } = await anon.from('ganpatis').insert({
    slug: 'rls-probe', name: 'RLS probe', category: 'local',
    area_id: '00000000-0000-0000-0000-000000000000',
    latitude: 18.5, longitude: 73.85,
  });
  check('anon CANNOT insert into ganpatis', Boolean(error),
    error ? `denied (${error.code ?? 'error'})` : 'LEAK: insert succeeded');
}

// 4. Other users' private rows must be invisible.
//
// These tables are empty on a fresh project, so an empty result is NOT proof.
// The meaningful assertion is that the request is refused or filtered rather
// than erroring on a missing policy; the insert-then-read proof above is what
// actually demonstrates SELECT policies are enforced.
{
  const { data, error } = await anon.from('favorites').select('user_id');
  check('anon sees no favorites', Boolean(error) || data?.length === 0,
    error ? `denied (${error.code ?? 'error'})` : 'filtered to 0 (table also empty)');
}
{
  const { data, error } = await anon.from('profiles').select('id');
  check('anon sees no profiles', Boolean(error) || data?.length === 0,
    error ? `denied (${error.code ?? 'error'})` : 'filtered to 0 (table also empty)');
}

// 5. RPCs must be callable and correct.
{
  const { data, error } = await anon.rpc('search_ganpatis', { q: 'Dagdu', max_results: 1 });
  check('RPC search_ganpatis works', !error && data?.[0]?.slug === 'dagdusheth-halwai-ganpati',
    error ? error.message : data?.[0]?.name);
}
{
  const { data, error } = await anon.rpc('nearby_ganpatis', {
    lat: 18.5196, lng: 73.8553, radius_m: 400, max_results: 2,
  });
  check('RPC nearby_ganpatis works', !error && data?.length >= 2,
    error ? error.message : `${data?.[1]?.name} @ ${Math.round(data?.[1]?.distance_m)}m`);
}

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name.padEnd(36)} ${r.detail}`);
}
console.log(`\n  ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
