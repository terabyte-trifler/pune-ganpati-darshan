import { chromium } from '@playwright/test';
import fs from 'node:fs';

/** in / out in seconds, matched to the 105.9s cut. */
const CAPS = [
  // Timings measured off the finished cut second by second, not assumed:
  // un-located home 5.2-11.5 | location tap 11.5-12.7 | located 12.7-16 |
  // report Mati 16-20 | map 21-25 | report Dagdusheth 25-28.5 |
  // home 28.5-31 | time question 31-33 | what to see 33-35.5 |
  // metro card 36-40 | optimise 40-48.8 | stations 49-53 | Maps 54.7-59.4
  { id: 'cL1', in: 3.8, out: 12.5,
    html: `<div class="main">But wait. Which mandal has the <span class="hi">shortest queue</span> right now?</div>
           <div class="en">Don’t worry. Just allow location once.</div>` },
  { id: 'cL2', in: 14.5, out: 18.0,
    html: `<div class="main">And look — nearest mandals will show shortest queues first.</div>` },
  { id: 'c02', in: 18.5, out: 25.9,
    html: `<div class="main">Standing near one? Vote how much crowd you see.</div>
           <div class="en">Short, moving, or heavy.</div>` },
  { id: 'c03', in: 26.4, out: 30.5,
    html: `<div class="main">Every mandal’s crowd status will show on one map.</div>
           <div class="key" style="margin-top:14px">
             <span><i style="background:#5FB872"></i>Short</span>
             <span><i style="background:#F2A93B"></i>Moving</span>
             <span><i style="background:#E5544B"></i>Heavy</span>
           </div>` },
  { id: 'c05', in: 32.1, out: 34.4,
    html: `<div class="main">Now just enter how much time you have.</div>` },
  { id: 'c06', in: 34.9, out: 37.3,
    html: `<div class="main">What to see. How you’ll travel.</div>` },
  { id: 'c07', in: 39.1, out: 41.2,
    html: `<div class="main">It even plans your metro.</div>
           <div class="en">Deccan Gymkhana → Civil Court → Kasba Peth</div>` },
  { id: 'c09', in: 41.7, out: 53.6,
    html: `<div class="kicker">And here is the best feature</div>
           <div class="big">3.6 <span class="u">km</span> → <span class="hi">2.7</span> <span class="u">km</span></div>
           <div class="en">One tap Optimise — reorders from your current location.</div>` },
  { id: 'c11', in: 54.9, out: 57.4,
    html: `<div class="main">Open it all in Google Maps.</div>` },
  { id: 'c12', in: 57.6, out: 59.7,
    html: `<div class="main">ganpatipune.in</div>
           <div class="en">Share this with your family and friends.</div>` },
];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 620 }, deviceScaleFactor: 1 });
await p.goto('file:///tmp/promo/caps/cap.html', { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);

for (const c of CAPS) {
  await p.evaluate((h) => { document.getElementById('c').innerHTML = h; }, c.html);
  await p.waitForTimeout(220);
  await p.locator('#c').screenshot({ path: `/tmp/promo/caps/${c.id}.png`, omitBackground: true });
  console.log(' ✓', c.id);
}
fs.writeFileSync('/tmp/promo/caps/caps.json', JSON.stringify(CAPS, null, 2));
await b.close();
