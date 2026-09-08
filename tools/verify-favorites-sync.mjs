/**
 * Verifies that favourites survive a device change once signed in.
 *
 * Two independent browser contexts stand in for two devices: they share the
 * account but not localStorage, which is exactly the case the sync exists to
 * serve and the one a single-context test would miss.
 */
import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const SUPABASE_URL = process.env.SUPABASE_URL;
const REF = new URL(SUPABASE_URL).hostname.split('.')[0];

const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } });
const { data, error } = await supabase.auth.signInWithPassword({
  email: process.env.EMAIL, password: process.env.PASSWORD,
});
if (error) { console.error('sign-in failed:', error.message); process.exit(1); }

const payload = 'base64-' + Buffer.from(JSON.stringify(data.session)).toString('base64url');
const CHUNK = 3200;
const host = new URL(BASE).hostname;
const cookies = payload.length <= CHUNK
  ? [{ name: `sb-${REF}-auth-token`, value: payload, domain: host, path: '/' }]
  : Array.from({ length: Math.ceil(payload.length / CHUNK) }, (_, i) => ({
      name: `sb-${REF}-auth-token.${i}`,
      value: payload.slice(i * CHUNK, (i + 1) * CHUNK), domain: host, path: '/',
    }));

const browser = await chromium.launch();
const results = [];
const check = (n, pass, d = '') => { results.push({ n, pass, d }); };

// --- Device A: save a mandal while signed in ---
const a = await browser.newContext();
await a.addCookies(cookies);
const pa = await a.newPage();
await pa.goto(`${BASE}/ganpati/kasba-ganpati`, { waitUntil: 'domcontentloaded' });
await pa.getByRole('button', { name: /^Save Shri Kasba Ganpati$/i }).click();
await pa.waitForTimeout(2500);

const { data: rows } = await supabase.from('favorites')
  .select('ganpati_id, ganpatis!inner(slug)').eq('user_id', data.user.id);
check('device A write reached the database',
  (rows ?? []).some((r) => (Array.isArray(r.ganpatis) ? r.ganpatis[0] : r.ganpatis)?.slug === 'kasba-ganpati'),
  `${rows?.length ?? 0} row(s)`);

// --- Device B: same account, empty localStorage ---
const b = await browser.newContext();
await b.addCookies(cookies);
const pb = await b.newPage();
await pb.goto(`${BASE}/saved`, { waitUntil: 'domcontentloaded' });
await pb.waitForTimeout(3500);
check('device B sees it without any local state',
  await pb.getByRole('link', { name: /Shri Kasba Ganpati/ }).isVisible().catch(() => false),
  'appeared on /saved');

// --- Signed-out device must NOT see it ---
const c = await browser.newContext();
const pc = await c.newPage();
await pc.goto(`${BASE}/saved`, { waitUntil: 'domcontentloaded' });
await pc.waitForTimeout(2000);
check('a signed-out device sees nothing',
  await pc.getByText(/Nothing saved yet/i).isVisible().catch(() => false),
  'stays device-local when signed out');

// --- Unsaving propagates, so a merge cannot resurrect it ---
await pa.reload({ waitUntil: 'domcontentloaded' });
await pa.waitForTimeout(1500);
await pa.getByRole('button', { name: /Remove Shri Kasba Ganpati from saved/i }).click();
await pa.waitForTimeout(2500);
const { data: after } = await supabase.from('favorites')
  .select('ganpati_id').eq('user_id', data.user.id);
check('removing propagates to the database', (after?.length ?? 0) === 0,
  `${after?.length ?? 0} row(s) remain`);

let failed = 0;
for (const r of results) { if (!r.pass) failed++; console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.n.padEnd(44)} ${r.d}`); }
console.log(`\n  ${results.length - failed}/${results.length} passed`);
await browser.close();
process.exit(failed ? 1 : 0);
