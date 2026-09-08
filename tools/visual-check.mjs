import { chromium } from '@playwright/test';

const OUT = '/private/tmp/claude-501/-Users-terabyte-trifler/ace7bfd4-ea51-4808-84b6-c6653c2920cc/scratchpad/shots';
const BASE = process.env.BASE ?? 'http://localhost:3001';
const targets = JSON.parse(process.env.TARGETS ?? '[]');

const browser = await chromium.launch();
const problems = [];

for (const { path: p, name, width, height = 900, full = true } of targets) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    isMobile: width < 768,
    hasTouch: width < 768,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  // Not 'networkidle': pages embedding a map stream tiles continuously, so it
  // never fires and every such page times out.
  const res = await page.goto(`${BASE}${p}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(900);

  // Horizontal overflow is an explicit failure condition (§63).
  const overflow = await page.evaluate(() => {
    const de = document.documentElement;
    const offenders = [];
    for (const el of document.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > de.clientWidth + 1 || r.left < -1)) {
        offenders.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} right=${Math.round(r.right)}`);
      }
    }
    return {
      scrollW: de.scrollWidth, clientW: de.clientWidth,
      offenders: offenders.slice(0, 4),
    };
  });

  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });

  const status = res?.status();
  const bad = status !== 200 || overflow.scrollW > overflow.clientW + 1 || errors.length > 0;
  if (bad) problems.push({ name, status, overflow, errors: errors.slice(0, 3) });
  console.log(
    `${bad ? 'FAIL' : ' ok '} ${name.padEnd(26)} ${status} ` +
    `scroll=${overflow.scrollW}/${overflow.clientW}` +
    (errors.length ? ` errors=${errors.length}` : '')
  );
  await ctx.close();
}

await browser.close();
if (problems.length) {
  console.log('\n--- PROBLEMS ---');
  console.log(JSON.stringify(problems, null, 1));
}
