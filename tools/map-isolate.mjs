import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 400, height: 700 } });
const tiles = [];
page.on('requestfinished', async (r) => {
  if (r.url().includes('.pbf')) {
    const res = await r.response();
    tiles.push(`${res?.status()} ${r.url().split('/').slice(-3).join('/')}`);
  }
});
const errs = [];
page.on('console', (m) => errs.push(`${m.type()}: ${m.text().slice(0, 150)}`));
page.on('pageerror', (e) => errs.push('pageerror: ' + String(e).slice(0, 150)));

// Minimal page: MapLibre from CDN, the simplest possible OpenFreeMap style.
await page.setContent(`
<html><head>
<link href="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css" rel="stylesheet"/>
<script src="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js"></script>
<style>#m{width:400px;height:700px}</style>
</head><body><div id="m"></div><script>
  window.__state='init';
  const map = new maplibregl.Map({
    container:'m',
    style:{version:8,sources:{o:{type:'vector',url:'https://tiles.openfreemap.org/planet'}},
      layers:[{id:'bg',type:'background',paint:{'background-color':'#14100c'}},
              {id:'w',type:'fill',source:'o','source-layer':'water',paint:{'fill-color':'#0e1418'}},
              {id:'r',type:'line',source:'o','source-layer':'transportation',paint:{'line-color':'#8a7f6d','line-width':1}}]},
    center:[73.8567,18.5204], zoom:14
  });
  map.on('load',()=>{window.__state='loaded'});
  map.on('idle',()=>{window.__state='idle'});
  map.on('error',(e)=>{window.__state='error: '+(e.error&&e.error.message)});
</script></body></html>`, { waitUntil: 'domcontentloaded' });

await page.waitForTimeout(10000);
console.log('  map state:', await page.evaluate(() => window.__state));
console.log('  webgl:', await page.evaluate(() => {
  const c = document.createElement('canvas');
  return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
}));
console.log('  tile requests:', tiles.length);
tiles.slice(0, 5).forEach((t) => console.log('   ', t));
if (errs.length) errs.slice(0, 5).forEach((e) => console.log('   ', e));
await browser.close();
