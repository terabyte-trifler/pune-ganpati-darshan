import { chromium } from '@playwright/test';
import fs from 'node:fs';

const B = 'https://ganpatipune.in';
const OUT = '/tmp/promo/raw';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

/**
 * The south end of FC Road, where it meets Deccan.
 *
 * Chosen rather than the middle of FC Road because the crowd report is
 * gated at 1.5 km and Dagdusheth is 1447 m from here — 53 m of margin.
 * From Modern Cafe it is 1737 m and the report buttons never render.
 * Deccan Gymkhana metro is 186 m away, which is what makes the metro beat
 * read as a real journey rather than a demo.
 */
const FC_ROAD = { latitude: 18.517, longitude: 73.8428, accuracy: 18 };

// Headed on purpose: a headless tab is treated as hidden, so CSS
// animations, the map fly-to and every intersection-observer reveal never
// run. A recording of that looks broken.
const b = await chromium.launch({ headless: false, args: ['--hide-scrollbars'] });

const c = await b.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  // Without this Google Maps serves its desktop layout — side panel and a
  // Sign in button — inside a 390px vertical frame.
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 ' +
             '(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  recordVideo: { dir: OUT, size: { width: 780, height: 1688 } },
});

/**
 * A drawn cursor, because Playwright records none.
 *
 * Without it every tap looks like the app acting on its own. Kept small —
 * roughly the size of a real pointer — with a warm halo in the app's own
 * vermilion so it stays findable against both the cream cards and the map
 * without dominating a 390px-wide frame.
 *
 * It is position:fixed so scrolling does not drag it off, and it is
 * re-created on every navigation — which is why the driver re-seats it at
 * its last known point before each move, or it would jump to a corner.
 */
// Gate geolocation in the page itself.
//
// A headed Chromium can hold a real OS-level location grant, so the app
// located itself the instant it loaded and the un-located screen — the
// whole first beat — never appeared on camera. Denying in the page makes
// the starting state deterministic no matter what the OS has granted.
await c.addInitScript(() => {
  const geo = navigator.geolocation;
  const realGet = geo.getCurrentPosition.bind(geo);
  const realWatch = geo.watchPosition.bind(geo);
  window.__allowGeo = false;
  const denied = { code: 1, PERMISSION_DENIED: 1, message: 'User denied Geolocation' };
  geo.getCurrentPosition = (ok, err, opts) => {
    if (!window.__allowGeo) return void (err && err(denied));
    return realGet(ok, err, opts);
  };
  geo.watchPosition = (ok, err, opts) => {
    if (!window.__allowGeo) { err && err(denied); return 0; }
    return realWatch(ok, err, opts);
  };
});

await c.addInitScript(() => {
  const install = () => {
    if (document.getElementById('__cur')) return;
    const el = document.createElement('div');
    el.id = '__cur';
    el.style.cssText = `position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;
      width:25px;height:28px;will-change:transform;transform:translate3d(180px,690px,0)`;
    el.innerHTML = `<svg width="25" height="28" viewBox="0 0 40 44" fill="none">
        <defs>
          <radialGradient id="__curHalo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#E2621B" stop-opacity=".5"/>
            <stop offset="62%" stop-color="#E2621B" stop-opacity=".12"/>
            <stop offset="100%" stop-color="#E2621B" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="__curFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#FFFFFF"/>
            <stop offset="100%" stop-color="#EFE6D6"/>
          </linearGradient>
          <filter id="__curShadow" x="-60%" y="-60%" width="240%" height="240%">
            <feDropShadow dx="0" dy="2.5" stdDeviation="2.4"
              flood-color="#0A0602" flood-opacity=".55"/>
          </filter>
        </defs>
        <circle id="__curGlow" cx="12" cy="12" r="13" fill="url(#__curHalo)"/>
        <path d="M6 4 L6 27.5 L12.6 21.6 L16.9 30.6 L21.6 28.5 L17.4 19.6 L25.8 19.2 Z"
          fill="url(#__curFill)" stroke="#14100C" stroke-width="3"
          stroke-linejoin="round" stroke-linecap="round"
          paint-order="stroke" filter="url(#__curShadow)"/>
      </svg>`;
    (document.body || document.documentElement).appendChild(el);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();

  window.__cur_set = (x, y) => {
    install();
    const el = document.getElementById('__cur');
    el.style.transition = 'none';
    el.style.transform = `translate3d(${x}px,${y}px,0)`;
    void el.offsetWidth;             // flush, so the next move animates
  };
  window.__cur_to = (x, y, ms) => {
    install();
    const el = document.getElementById('__cur');
    el.style.transition = `transform ${ms}ms cubic-bezier(.33,0,.2,1)`;
    el.style.transform = `translate3d(${x}px,${y}px,0)`;
  };
  window.__cur_press = () => {
    const el = document.getElementById('__cur');
    if (!el) return;
    const t = el.style.transform;
    el.animate([{ transform: `${t} scale(1)` }, { transform: `${t} scale(.74)` },
                { transform: `${t} scale(1)` }],
               { duration: 280, easing: 'ease-out' });
    const glow = document.getElementById('__curGlow');
    if (glow) glow.animate([{ opacity: 1, transform: 'scale(1)' },
                            { opacity: .3, transform: 'scale(1.8)' },
                            { opacity: 1, transform: 'scale(1)' }],
                           { duration: 460, easing: 'ease-out' });
  };

  // The hand-off calls window.open, which would put Google Maps in a
  // second tab — and Playwright writes one video per page, so the take
  // would arrive as two files with a hard seam. Navigating in place keeps
  // it a single continuous shot.
  const nativeOpen = window.open;
  window.open = (url, ...rest) => {
    if (typeof url === 'string' && /google\.[a-z.]+\/maps/.test(url)) {
      window.location.href = url;
      return null;
    }
    return nativeOpen.call(window, url, ...rest);
  };

  window.__tap = (x, y) => {
    const d = document.createElement('div');
    d.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:66px;height:66px;
      margin:-33px 0 0 -33px;border-radius:50%;pointer-events:none;z-index:2147483646;
      background:rgba(226,98,27,.28);border:3px solid rgba(226,98,27,.95);
      transform:scale(.28);opacity:1;transition:transform .6s ease-out,opacity .6s ease-out`;
    document.body.appendChild(d);
    requestAnimationFrame(() => { d.style.transform = 'scale(1)'; d.style.opacity = '0'; });
    setTimeout(() => d.remove(), 680);
  };
});

const p = await c.newPage();
const hold = (ms) => p.waitForTimeout(ms);
const t0 = Date.now();
const mark = (label) => console.log(`  ${((Date.now() - t0) / 1000).toFixed(1)}s  ${label}`);

// The driver owns the cursor's position: the page forgets it on every
// navigation. TIP_* backs out the pointer tip's offset inside the SVG so
// the tip, not the box corner, lands on the control.
const TIP_X = 4, TIP_Y = 3;
let cur = { x: 180, y: 690 };

async function moveTo(x, y, ms = 520) {
  await p.evaluate(([a, b2]) => window.__cur_set(a, b2), [cur.x, cur.y]);
  await hold(70);
  await p.evaluate(([a, b2, m]) => window.__cur_to(a, b2, m), [x - TIP_X, y - TIP_Y, ms]);
  cur = { x: x - TIP_X, y: y - TIP_Y };
  await hold(ms + 120);
}

/** Travel to the control, press it, ripple, then actually click. */
async function tap(locator, { settle = 900, timeout = 45_000 } = {}) {
  await locator.waitFor({ state: 'visible', timeout });
  await locator.scrollIntoViewIfNeeded();
  await hold(520);
  const box = await locator.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await moveTo(x, y);
  await p.evaluate(() => window.__cur_press());
  await p.evaluate(([a, b2]) => window.__tap(a, b2), [x, y]);
  await hold(420);
  await locator.click();
  await hold(settle);
}

/** Bring the plan's map into frame and let it be looked at. */
async function showMap(ms = 2800) {
  const map = p.locator('.maplibregl-map').first();
  if (await map.count()) {
    await map.scrollIntoViewIfNeeded().catch(() => {});
    await hold(ms);
  }
}

// ── 1. It asks where you are ────────────────────────────────────────────
// The app opens knowing nothing: "Pune's best known", no distances on any
// row. The location grant is the first thing that happens on camera,
// because it is the first thing that happens to a real visitor.
await p.goto(B, { waitUntil: 'networkidle' });
// The control lives below the fold, so wait for it in the DOM and let
// tap() bring it into frame rather than requiring it to be on screen.
await p.getByRole('button', { name: /Sort by what/i })
  .waitFor({ state: 'attached', timeout: 60_000 });
await p.evaluate(([x, y]) => window.__cur_set(x, y), [cur.x, cur.y]);
await hold(3200);
await p.evaluate(() => window.scrollBy({ top: 620, behavior: 'smooth' }));
await hold(3400);

mark('Grant location');
await c.grantPermissions(['geolocation'], { origin: B });
await c.setGeolocation(FC_ROAD);
await p.evaluate(() => { window.__allowGeo = true; });
await tap(p.getByRole('button', { name: /Sort by what/i }), { settle: 3800 });

// ── 2. Nearest mandals, shortest queues ─────────────────────────────────
mark('Nearest mandals');
await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
await hold(1600);
await p.evaluate(() => window.scrollBy({ top: 460, behavior: 'smooth' }));
await hold(3600);

mark('Report the nearest one');
// ── 2. Report the nearest one, 440 m away ───────────────────────────────
// "Seen any of these?" lists what is walkable from here, with the buttons
// inline — no search, no page to open. Mati Ganpati is the closest.
const nearPanel = p.locator('section').filter({ hasText: /Seen any of these/i }).first();
if (await nearPanel.count().catch(() => 0)) {
  await nearPanel.scrollIntoViewIfNeeded();
  await hold(2600);
  const row = nearPanel.locator('li').filter({ hasText: 'Mati Ganpati' }).first();
  const short = row.getByRole('button', { name: /Report Short crowd/i }).first();
  if (await short.count().catch(() => 0)) {
    await tap(short, { settle: 3200 });
  } else {
    console.log('  !! Mati Ganpati report button not found');
  }
}

mark('The map, in queue colours');
// ── 3. The map, in queue colours ────────────────────────────────────────
await tap(p.getByRole('link', { name: /See every mandal on the map/i }), { settle: 7000 });
await p.locator('.maplibregl-canvas').first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
await hold(2600);

mark('Dagdusheth');
// ── 4. Dagdusheth, and a report from 1.4 km away ────────────────────────
await tap(p.locator('button').filter({ hasText: 'Dagdusheth' }).first(), { settle: 2200 });
await tap(p.getByRole('button', { name: 'Report Short crowd' }).first(), { settle: 3200 });

mark('Back to the home screen');
// ── 5. Back to the home screen, then into the planner ───────────────────
await tap(p.getByRole('link', { name: 'Home', exact: true }).first(), { settle: 2200 });
await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
await hold(1500);
await tap(p.getByRole('link', { name: /Build my route/i }).first(), { settle: 2200 });

mark('Two questions');
// ── 6. Two questions ────────────────────────────────────────────────────
await tap(p.getByRole('button', { name: '3 hours' }), { settle: 1200 });
await tap(p.getByRole('button', { name: /The famous ones/ }), { settle: 800 });
await tap(p.getByRole('button', { name: 'Metro', exact: true }), { settle: 900 });
await tap(p.getByRole('button', { name: /Build my route/i }), { settle: 5000 });

mark('The metro card');
// ── 7. The metro card ───────────────────────────────────────────────────
const metro = p.locator('section').filter({ hasText: 'Getting there by metro' }).first();
if (await metro.count()) {
  await metro.scrollIntoViewIfNeeded();
  await hold(3800);
}

mark('Optimise');
// ── 8. Optimise, and the path that snaps to the lanes ───────────────────
await tap(p.getByRole('button', { name: /Optimise order/i }), { settle: 6500 });
await showMap(3200);

mark('The same route off a different station');
// ── 9. The same route off a different station ───────────────────────────
// The stops do not change; the walk in does. Switching the alighting
// station redraws the leg and the card, which is the whole argument for
// planning metro-first.
for (const name of ['PMC', 'Kasba Peth']) {
  const btn = p.getByRole('button', { name: new RegExp(`^${name}`) }).first();
  if (await btn.count().catch(() => 0)) {
    await tap(btn, { settle: 1200 });
    await showMap(2200);
  }
}

const rare = p.getByRole('button', { name: /Coming from Deccan or JM Road/i }).first();
if (await rare.count().catch(() => 0)) {
  await tap(rare, { settle: 1200 });
  for (const name of ['Chhatrapati Sambhaji Udyan', 'Deccan Gymkhana']) {
    const btn = p.getByRole('button', { name: new RegExp(`^${name}`) }).first();
    if (await btn.count().catch(() => 0)) {
      await tap(btn, { settle: 1200 });
      await showMap(2200);
      break;
    }
  }
  if (await metro.count()) {
    await metro.scrollIntoViewIfNeeded();
    await hold(3200);
  }
}

mark('Hand-off');
// ── 10. Hand-off ─────────────────────────────────────────────────────────
await tap(p.getByRole('button', { name: 'Start my darshan' }), { settle: 1200 });

mark('The same route, now in Google Maps');
// ── 11. The same route, now in Google Maps ──────────────────────────────
await p.waitForURL(/google\.[a-z.]+\/maps/, { timeout: 15_000 }).catch(() => {});
await p.waitForLoadState('domcontentloaded').catch(() => {});
await hold(2600);

// "Open the Google Maps app?" sits over the route for as long as you let
// it, and staying on the web is the whole point of the hand-off.
//
// Matched by text rather than getByRole: a role query has to walk Google
// Maps' entire accessibility tree, and four of those cost more than a
// minute on this page — which is what turned a 9-second beat into 84.
for (const label of ['Keep using web', 'Accept all', 'I agree']) {
  const btn = p.locator(`button:has-text("${label}")`).first();
  if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await btn.click({ timeout: 3000 }).catch(() => {});
    await hold(900);
    break;
  }
}
await hold(6500);
console.log('  google maps:', p.url().slice(0, 110));

// Playwright stamps the webm at a nominal 25fps, but a headed browser
// under load captures far fewer frames than that — so the file plays back
// at roughly half speed unless it is retimed. Recording the true elapsed
// here is what lets the assembler work out the exact factor instead of
// guessing at it.
const elapsedMs = Date.now() - t0;
await c.close();
await b.close();
const file = fs.readdirSync(OUT).find((f) => f.endsWith('.webm'));
fs.writeFileSync('/tmp/promo/elapsed.txt', String(elapsedMs / 1000));
console.log(`elapsed: ${(elapsedMs / 1000).toFixed(1)}s`);
console.log('recorded:', OUT + '/' + file);
