/** Reads the reference site's map view to find its mandal coordinates. */
import { chromium } from '@playwright/test';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 420, height: 900 } });

// Capture any JSON the page fetches, in case coordinates arrive over the wire.
const payloads = [];
p.on('response', async (r) => {
  const ct = r.headers()['content-type'] ?? '';
  if (/json|text\/x-component/.test(ct) && r.url().includes('puneganpati')) {
    try { payloads.push(await r.text()); } catch {}
  }
});

await p.goto('https://puneganpati.in/find?view=map', { waitUntil: 'domcontentloaded', timeout: 40000 });
await p.waitForTimeout(6000);

// Coordinates may sit in the RSC flight payload embedded in the document.
const inline = await p.evaluate(() =>
  [...document.querySelectorAll('script')].map((s) => s.textContent ?? '').join('\n')
);

const haystack = [inline, ...payloads].join('\n');
// Pune bounding box, so we only pick up plausible mandal coordinates.
const pairs = [...haystack.matchAll(/(1[78]\.\d{3,})[^0-9]{1,20}(7[34]\.\d{3,})/g)]
  .map((m) => [Number(m[1]), Number(m[2])])
  .filter(([lat, lng]) => lat > 18.3 && lat < 18.8 && lng > 73.6 && lng < 74.1);

console.log('  script bytes:', inline.length, '| json payloads:', payloads.length);
console.log('  coordinate-like pairs found:', pairs.length);
console.log('  sample:', JSON.stringify(pairs.slice(0, 6)));

// Any named markers rendered into the DOM?
const markers = await p.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('[aria-label],[title]')) {
    const label = el.getAttribute('aria-label') || el.getAttribute('title') || '';
    if (/ganpati|mandal|talim|ganesh/i.test(label)) out.push(label.slice(0, 50));
  }
  return [...new Set(out)].slice(0, 10);
});
console.log('  labelled markers:', markers.length ? markers.join(' | ').slice(0, 200) : 'none');
await b.close();
