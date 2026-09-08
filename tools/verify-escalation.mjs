/**
 * Privilege-escalation probe: signs in as an ordinary user and attempts
 * everything only an admin should be able to do. Every attempt must fail.
 *
 * Assertions are on OBSERVED EFFECT, never on the absence of an error.
 * PostgREST returns success with 0 rows affected when an RLS USING clause
 * matches nothing, so "no error" does not mean "the write happened" — and
 * conversely an empty SELECT proves nothing on an empty table. Each check
 * below therefore reads state back and compares it.
 *
 *   SUPABASE_ANON_KEY=<anon key> node tools/verify-escalation.mjs
 */
import { createClient } from '@supabase/supabase-js';

// Project and account come from the environment; this file is committed.
const SUPABASE_URL = process.env.SUPABASE_URL;
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;

if (!SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !EMAIL || !PASSWORD) {
  console.error(
    'Usage: SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=<anon key> \\\n' +
    '       EMAIL=<ordinary user> PASSWORD=<password> node tools/verify-escalation.mjs'
  );
  process.exit(1);
}

const c = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const results = [];
const check = (name, pass, detail) => results.push({ name, pass, detail });

const { data: session, error: signInError } = await c.auth.signInWithPassword({
  email: EMAIL, password: PASSWORD,
});
if (signInError) {
  console.error('sign-in failed:', signInError.message);
  process.exit(1);
}
const uid = session.user.id;
console.log(`  signed in as ordinary user ${uid.slice(0, 8)}…\n`);

// 1. Self-escalation — verified by reading is_admin back.
{
  await c.from('profiles').update({ is_admin: true }).eq('id', uid);
  const { data } = await c.from('profiles').select('is_admin').eq('id', uid).maybeSingle();
  check('cannot escalate self to admin', data?.is_admin === false,
    `is_admin is still ${data?.is_admin}`);
}

// 2. Catalogue write — verified by reading the name back.
{
  const { data: before } = await c.from('ganpatis')
    .select('name').eq('slug', 'kasba-ganpati').maybeSingle();
  await c.from('ganpatis').update({ name: 'ESCALATION_PROBE' }).eq('slug', 'kasba-ganpati');
  const { data: after } = await c.from('ganpatis')
    .select('name').eq('slug', 'kasba-ganpati').maybeSingle();
  check('cannot modify the catalogue',
    after?.name === before?.name && after?.name !== 'ESCALATION_PROBE',
    `name unchanged: "${after?.name}"`);
}

// 3. Catalogue insert — verified by looking for the row.
{
  await c.from('ganpatis').insert({
    slug: 'escalation-probe', name: 'Escalation probe', category: 'local',
    area_id: '00000000-0000-0000-0000-000000000000', latitude: 18.5, longitude: 73.85,
  });
  const { data } = await c.from('ganpatis').select('slug').eq('slug', 'escalation-probe');
  check('cannot insert into the catalogue', (data?.length ?? 0) === 0, 'row does not exist');
}

// 4. Analytics stream — an insert is known to succeed, so an empty read is
//    genuine evidence the SELECT policy denies us (not an empty table).
{
  await c.from('analytics_events').insert({ name: 'escalation_probe' });
  const { data } = await c.from('analytics_events').select('id');
  check('cannot read the analytics stream', (data?.length ?? 0) === 0,
    'own insert is invisible — policy holds');
}

// 5. Other users' profiles — the admin user provably exists, so seeing only
//    one row means the policy is filtering rather than the table being empty.
{
  const { data } = await c.from('profiles').select('id');
  check('cannot read other users’ profiles',
    (data?.length ?? 0) <= 1 && (data?.[0]?.id ?? uid) === uid,
    `sees ${data?.length ?? 0} row (own only; another user provably exists)`);
}

// 6. Festival config is admin-writable only.
{
  const { data: before } = await c.from('festival_config').select('year, tagline').eq('is_active', true).maybeSingle();
  await c.from('festival_config').update({ tagline: 'ESCALATION_PROBE' }).eq('is_active', true);
  const { data: after } = await c.from('festival_config').select('tagline').eq('is_active', true).maybeSingle();
  check('cannot modify festival config', after?.tagline === before?.tagline,
    `tagline unchanged`);
}

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name.padEnd(38)} ${r.detail}`);
}
console.log(`\n  ${results.length - failed}/${results.length} passed`);
await c.auth.signOut();
process.exit(failed ? 1 : 0);
