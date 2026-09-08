import { chromium } from '@playwright/test';
const OUT = process.env.SHOTS ?? '/tmp';
const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  isMobile: true, hasTouch: true,
});
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 120)));
page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));

await page.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded' });

// MapLibre paints via requestAnimationFrame, which does not run in a hidden
// tab — so confirm visibility before trusting the screenshot at all.
console.log('  visibilityState:', await page.evaluate(() => document.visibilityState));

// Wait for the map to actually finish rendering rather than a fixed sleep.
const painted = await page.evaluate(() => new Promise((resolve) => {
  const start = Date.now();
  const tick = () => {
    const c = document.querySelector('canvas.maplibregl-canvas');
    if (c && c.width > 0) {
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      return resolve({ canvas: true, w: c.width, h: c.height, gl: Boolean(gl) });
    }
    if (Date.now() - start > 15000) return resolve({ canvas: false });
    requestAnimationFrame(tick);
  };
  tick();
}));
console.log('  canvas:', JSON.stringify(painted));
// Wait for MapLibre to report every tile drawn, rather than sleeping.
await page.waitForSelector('[data-map-idle="true"]', { timeout: 25000 }).catch(() => {});
await page.waitForTimeout(1200);

// Are non-black pixels actually present? A blank canvas screenshots as a
// uniform dark rectangle and would otherwise look "fine".
const variety = await page.evaluate(() => {
  const c = document.querySelector('canvas.maplibregl-canvas');
  if (!c) return null;
  const off = document.createElement('canvas');
  off.width = c.width; off.height = c.height;
  off.getContext('2d').drawImage(c, 0, 0);
  const d = off.getContext('2d').getImageData(0, 0, off.width, off.height).data;
  const seen = new Set();
  for (let i = 0; i < d.length; i += 4 * 997) {
    seen.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
  }
  return seen.size;
});
console.log('  distinct sampled colours on canvas:', variety);

await page.screenshot({ path: `${OUT}/maplibre-map.png` });
if (errors.length) console.log('  console errors:', errors.slice(0, 3));
await browser.close();
