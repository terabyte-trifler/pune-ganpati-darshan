import { chromium } from '@playwright/test';
const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';

async function run(label, contextOpts, init) {
  const browser = await chromium.launch(contextOpts.launch ?? {});
  const ctx = await browser.newContext(contextOpts.context ?? {});
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('UNCAUGHT: ' + String(e).slice(0, 130)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 130)); });
  if (init) await page.addInitScript(init);

  await page.goto(`${BASE}/map`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(7000);

  const state = await page.evaluate(() => {
    const el = document.querySelector('[role="application"]');
    const canvas = document.querySelector('canvas.maplibregl-canvas');
    const heading = [...document.querySelectorAll('h2')]
      .map((h) => h.textContent || '')
      .find((t) => /can.t draw the map|couldn.t start|couldn.t load/i.test(t));
    return {
      ready: el?.getAttribute('data-map-ready'),
      idle: el?.getAttribute('data-map-idle'),
      canvas: Boolean(canvas),
      fallbackHeading: heading ?? null,
      listVisible: document.body.textContent.includes('18 mandals'),
    };
  });
  console.log(`  ${label}`);
  console.log(`    ready=${state.ready} idle=${state.idle} canvas=${state.canvas} ` +
              `listWorks=${state.listVisible}`);
  console.log(`    fallback: ${state.fallbackHeading ?? '(none)'}`);
  if (errs.length) errs.slice(0, 3).forEach((e) => console.log('     !', e));
  await browser.close();
  return state;
}

// 1. Normal browser, service worker allowed (a real returning visitor).
await run('normal (service worker enabled)', {});

// 2. WebGL unavailable — old Android, blocklisted GPU, hardened browser.
await run('WebGL blocked', {}, () => {
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    if (String(type).includes('webgl')) return null;
    return orig.call(this, type, ...rest);
  };
});
