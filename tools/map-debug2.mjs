import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://127.0.0.1:3100/map', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const chain = await page.evaluate(() => {
  const out = [];
  let el = document.querySelector('[role="application"]');
  while (el && el !== document.documentElement) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    out.push({
      tag: el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''),
      cls: (el.className || '').toString().slice(0, 62),
      size: `${Math.round(r.width)}x${Math.round(r.height)}`,
      pos: cs.position,
      display: cs.display,
      height: cs.height,
    });
    el = el.parentElement;
  }
  return out;
});
for (const n of chain) {
  console.log(`  ${n.size.padStart(9)}  ${n.pos.padEnd(8)} ${n.display.padEnd(6)} h=${n.height.padEnd(8)} ${n.tag} ${n.cls}`);
}
await browser.close();
