import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

const reqs = [];
page.on('requestfinished', async (r) => {
  const u = r.url();
  if (/openfreemap|\.pbf|tiles/i.test(u)) {
    const res = await r.response();
    reqs.push(`${res?.status()} ${u.slice(0, 95)}`);
  }
});
page.on('requestfailed', (r) => {
  if (/openfreemap|\.pbf|tiles/i.test(r.url()))
    reqs.push(`FAILED ${r.failure()?.errorText} ${r.url().slice(0, 80)}`);
});
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e).slice(0, 200)));

await page.goto('http://127.0.0.1:3100/map', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);

const info = await page.evaluate(() => {
  const c = document.querySelector('canvas.maplibregl-canvas');
  const box = c?.getBoundingClientRect();
  return {
    canvasCss: box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'none',
    containerCss: (() => {
      const d = document.querySelector('[role="application"]');
      const b = d?.getBoundingClientRect();
      return b ? `${Math.round(b.width)}x${Math.round(b.height)}` : 'none';
    })(),
  };
});
console.log('  container:', info.containerCss, '| canvas:', info.canvasCss);
console.log('  map-related requests:', reqs.length);
reqs.slice(0, 8).forEach((r) => console.log('   ', r));
console.log('  console errors:', errs.length);
errs.slice(0, 6).forEach((e) => console.log('   ', e));
await browser.close();
