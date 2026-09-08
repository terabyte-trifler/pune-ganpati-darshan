/**
 * Renders the reference site's inner pages in a real browser to understand
 * WHAT each surface does — its information architecture and controls.
 * Structure only; no markup, styling or code is copied.
 */
import { chromium } from '@playwright/test';

const PAGES = process.env.PAGES?.split(',') ?? ['/start'];
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 400, height: 900 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
});

for (const path of PAGES) {
  const page = await ctx.newPage();
  try {
    await page.goto(`https://puneganpati.in${path}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(3500);

    const info = await page.evaluate(() => {
      const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
      return {
        title: document.title,
        h1: [...document.querySelectorAll('h1')].map(txt).slice(0, 4),
        h2: [...document.querySelectorAll('h2')].map(txt).slice(0, 12),
        h3: [...document.querySelectorAll('h3')].map(txt).slice(0, 12),
        buttons: [...document.querySelectorAll('button')].map(txt).filter(Boolean).slice(0, 18),
        links: [...new Set([...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute('href')))].slice(0, 25),
        hasCanvas: document.querySelectorAll('canvas').length,
        hasIframe: document.querySelectorAll('iframe').length,
        hasSvgMap: document.querySelectorAll('svg').length,
        imgs: document.querySelectorAll('img').length,
        bodyStart: txt(document.body).slice(0, 320),
      };
    });

    console.log(`\n=== ${path} ===`);
    console.log('  title:', info.title);
    if (info.h1.length) console.log('  h1:', JSON.stringify(info.h1));
    if (info.h2.length) console.log('  h2:', JSON.stringify(info.h2));
    if (info.h3.length) console.log('  h3:', JSON.stringify(info.h3));
    if (info.buttons.length) console.log('  buttons:', JSON.stringify(info.buttons));
    console.log('  canvas:', info.hasCanvas, '| iframes:', info.hasIframe, '| imgs:', info.imgs);
    console.log('  links:', info.links.join(' '));
    console.log('  text:', info.bodyStart);
  } catch (e) {
    console.log(`\n=== ${path} === FAILED: ${String(e).slice(0, 100)}`);
  }
  await page.close();
}
await browser.close();
