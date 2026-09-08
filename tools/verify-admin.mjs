/**
 * Exercises the admin surface end to end with a REAL authenticated session.
 *
 * The sign-in UI offers only Google OAuth and magic links, neither of which
 * can be driven headlessly, so the session is minted through supabase-js and
 * injected as the cookie @supabase/ssr expects. That is the same session the
 * server would have issued — only the delivery differs.
 *
 *   ANON=<anon key> BASE=http://127.0.0.1:3100 node tools/verify-admin.mjs
 */
import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xkyvkqzbpxklpogurpdt.supabase.co';
const REF = 'xkyvkqzbpxklpogurpdt';
const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';

const supabase = createClient(SUPABASE_URL, process.env.ANON, { auth: { persistSession: false } });
const { data, error } = await supabase.auth.signInWithPassword({
  email: process.env.EMAIL ?? 'admin-verify@puneganpati.test',
  password: process.env.PASSWORD ?? 'VerifyAdmin!2026',
});
if (error) { console.error('sign-in failed:', error.message); process.exit(1); }

// @supabase/ssr stores the session as base64url-encoded JSON, chunked across
// numbered cookies when it exceeds the ~3.6KB browser limit.
const payload = 'base64-' + Buffer.from(JSON.stringify(data.session)).toString('base64url');
const CHUNK = 3200;
const host = new URL(BASE).hostname;
const cookies = [];
if (payload.length <= CHUNK) {
  cookies.push({ name: `sb-${REF}-auth-token`, value: payload, domain: host, path: '/' });
} else {
  for (let i = 0; i * CHUNK < payload.length; i++) {
    cookies.push({
      name: `sb-${REF}-auth-token.${i}`,
      value: payload.slice(i * CHUNK, (i + 1) * CHUNK),
      domain: host, path: '/',
    });
  }
}

const browser = await chromium.launch();
const ctx = await browser.newContext();
await ctx.addCookies(cookies);
const page = await ctx.newPage();
const results = [];
const check = (n, pass, d = '') => results.push({ n, pass, d });

// 1. Admin list renders for an admin.
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
check('admin page renders for an admin',
  page.url().endsWith('/admin') && await page.getByText('Manage mandals').isVisible().catch(() => false),
  page.url().replace(BASE, ''));

// 2. Create a mandal through the real form + server action.
await page.goto(`${BASE}/admin/ganpati/new`, { waitUntil: 'networkidle' });
await page.fill('input[name="name"]', 'Admin Verify Mandal');
await page.fill('input[name="slug"]', 'admin-verify-mandal');
await page.selectOption('select[name="areaSlug"]', 'kasba-peth');
await page.selectOption('select[name="category"]', 'local');
await page.fill('input[name="latitude"]', '18.5188');
await page.fill('input[name="longitude"]', '73.8541');
await page.getByRole('button', { name: /Save mandal/i }).click();
await page.waitForURL('**/admin', { timeout: 15_000 }).catch(() => {});
check('created a mandal via the server action',
  await page.getByText('Admin Verify Mandal').isVisible().catch(() => false),
  'appears in the admin list');

// 3. Constraint enforcement: a non-manache mandal must not accept a rank.
await page.goto(`${BASE}/admin/ganpati/new`, { waitUntil: 'networkidle' });
await page.fill('input[name="name"]', 'Bad Rank Mandal');
await page.fill('input[name="slug"]', 'bad-rank-mandal');
await page.selectOption('select[name="areaSlug"]', 'kasba-peth');
await page.selectOption('select[name="category"]', 'local');
await page.fill('input[name="latitude"]', '18.51');
await page.fill('input[name="longitude"]', '73.85');
await page.fill('input[name="manacheRank"]', '3');
await page.getByRole('button', { name: /Save mandal/i }).click();
await page.waitForTimeout(2500);
check('rejects a rank on a non-manache mandal',
  page.url().includes('/admin/ganpati/new'),
  'stayed on the form with a validation error');

// 4. Delete the created mandal.
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
const row = page.locator('li', { hasText: 'Admin Verify Mandal' });
await row.getByRole('link', { name: /Edit/i }).click();
await page.waitForLoadState('networkidle');
await page.getByRole('button', { name: /^Delete$/i }).click();
await page.getByRole('button', { name: /Confirm delete/i }).click();
await page.waitForURL('**/admin', { timeout: 15_000 }).catch(() => {});
await page.reload({ waitUntil: 'networkidle' });
check('deleted the mandal',
  !(await page.getByText('Admin Verify Mandal').isVisible().catch(() => false)),
  'gone from the admin list');

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.n.padEnd(42)} ${r.d}`);
}
console.log(`\n  ${results.length - failed}/${results.length} passed`);
await browser.close();
process.exit(failed ? 1 : 0);
