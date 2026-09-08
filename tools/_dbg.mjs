import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
const BASE = 'http://127.0.0.1:3100';
const URL_ = process.env.SUPABASE_URL, REF = new URL(URL_).hostname.split('.')[0];
const sb = createClient(URL_, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data } = await sb.auth.signInWithPassword({ email: process.env.EMAIL, password: process.env.PASSWORD });

// Seed a favourite directly so the pull path is what we are testing.
const { data: g } = await sb.from('ganpatis').select('id').eq('slug', 'kasba-ganpati').single();
await sb.from('favorites').upsert({ user_id: data.user.id, ganpati_id: g.id },
  { onConflict: 'user_id,ganpati_id', ignoreDuplicates: true });

const payload = 'base64-' + Buffer.from(JSON.stringify(data.session)).toString('base64url');
const CHUNK = 3200;
const cookies = payload.length <= CHUNK
  ? [{ name: `sb-${REF}-auth-token`, value: payload, domain: '127.0.0.1', path: '/' }]
  : Array.from({ length: Math.ceil(payload.length / CHUNK) }, (_, i) => ({
      name: `sb-${REF}-auth-token.${i}`, value: payload.slice(i*CHUNK,(i+1)*CHUNK), domain: '127.0.0.1', path: '/' }));

const b = await chromium.launch();
const ctx = await b.newContext();
await ctx.addCookies(cookies);
const p = await ctx.newPage();
const logs = [];
p.on('console', (m) => logs.push(`${m.type()}: ${m.text().slice(0,140)}`));
p.on('pageerror', (e) => logs.push('pageerror: ' + String(e).slice(0,140)));
await p.goto(`${BASE}/saved`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(5000);

console.log('  client sees a session:', await p.evaluate(async () => {
  const keys = Object.keys(localStorage);
  return { localStorageKeys: keys, cookiePresent: document.cookie.includes('auth-token') };
}).then(JSON.stringify));
console.log('  sync state:', await p.evaluate(() => document.querySelector('[data-sync-state]')?.getAttribute('data-sync-state') ?? 'element absent (empty state)'));
console.log('  page text:', (await p.evaluate(() => document.body.innerText.replace(/\s+/g,' ').slice(0,110))));
if (logs.length) logs.slice(0,5).forEach(l => console.log('   !', l));
await b.close();
