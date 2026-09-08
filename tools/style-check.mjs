import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const style = readFileSync(process.argv[2], 'utf8');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 400, height: 700 } });
const tiles = [];
page.on('requestfinished', (r) => { if (r.url().includes('.pbf')) tiles.push(r.url()); });

await page.setContent(`
<html><head>
<link href="https://unpkg.com/maplibre-gl@${process.env.MLV ?? "5"}/dist/maplibre-gl.css" rel="stylesheet"/>
<script src="https://unpkg.com/maplibre-gl@${process.env.MLV ?? "5"}/dist/maplibre-gl.js"></script>
<style>#m{width:400px;height:700px}</style>
</head><body><div id="m"></div><script>
  window.__errors = [];
  window.__state = 'init';
  const map = new maplibregl.Map({
    container: 'm', style: ${style}, center: [73.8567, 18.5204], zoom: 14,
  });
  map.on('load', () => { window.__state = 'loaded'; });
  map.on('idle', () => { window.__state = 'idle'; });
  map.on('error', (e) => { window.__errors.push(String(e.error && e.error.message || e.error || e)); });
</script></body></html>`, { waitUntil: 'domcontentloaded' });

await page.waitForTimeout(9000);
console.log('  state:', await page.evaluate(() => window.__state));
console.log('  tiles:', tiles.length);
const errs = await page.evaluate(() => window.__errors);
console.log('  maplibre errors:', errs.length);
[...new Set(errs)].slice(0, 8).forEach((e) => console.log('   ', e.slice(0, 180)));
await browser.close();
