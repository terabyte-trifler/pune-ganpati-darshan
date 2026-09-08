/**
 * Measures the things that actually decide whether a page is usable one-handed
 * on a phone: tap-target size, spacing between adjacent targets, text size,
 * and how much vertical space is spent before the first useful control.
 *
 * Thresholds: 44px targets and 8px separation (WCAG 2.5.5 / platform HIG),
 * 12px minimum body text.
 */
import { chromium } from '@playwright/test';

/**
 * Guard against silently auditing the wrong server.
 *
 * The variable is BASE. Passing a plausible-looking alternative leaves the
 * run on the default port, where it happily measures whatever else is
 * listening and reports its layout as this app's. That produced a page of
 * confident, entirely fictional findings before it was noticed.
 */
for (const wrong of ['BASE_URL', 'PLAYWRIGHT_BASE_URL', 'E2E_BASE_URL']) {
  if (!process.env.BASE && process.env[wrong]) {
    console.error(
      `${wrong} is set but this tool reads BASE. Re-run with BASE=${process.env[wrong]}`
    );
    process.exit(1);
  }
}

const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const PAGES = (process.env.PAGES ?? '/,/explore,/start,/plan,/routes,/saved,/ganpati/kasba-ganpati').split(',');

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3,
  isMobile: true, hasTouch: true,
});

for (const path of PAGES) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const report = await page.evaluate(() => {
    const MIN = 44, GAP = 8, MIN_TEXT = 12;
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };

    // Skip-links are 1x1 until focused; that is correct, not a defect.
    const srOnly = (el) => el.classList.contains('sr-only') ||
      (el.getBoundingClientRect().width <= 1 && el.getBoundingClientRect().height <= 1);

    const targets = [...document.querySelectorAll('a, button, input, select, textarea, [role="button"]')]
      .filter(visible).filter((el) => !srOnly(el))
      .map((el) => {
        const r = el.getBoundingClientRect();
        // A fixed element does not live in document space; adding scrollY to
        // it invented collisions between the bottom nav and whatever content
        // happened to sit at that y. Clearance is checked separately.
        const fixed = getComputedStyle(el).position === 'fixed' ||
          Boolean(el.closest('nav[aria-label="Primary"]'));
        return {
          fixed,
          label: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 34),
          w: Math.round(r.width), h: Math.round(r.height),
          top: Math.round(r.top + window.scrollY), left: Math.round(r.left), right: Math.round(r.right),
          bottom: Math.round(r.bottom + window.scrollY),
        };
      });

    const small = targets.filter((t) => t.h < MIN || t.w < MIN);
    const inFlow = targets.filter((t) => !t.fixed);

    // Adjacent targets that sit closer than the minimum separation.
    const tight = [];
    for (let i = 0; i < inFlow.length; i++) {
      for (let j = i + 1; j < inFlow.length; j++) {
        const a = inFlow[i], b = inFlow[j];
        const dx = Math.max(0, Math.max(a.left, b.left) - Math.min(a.right, b.right));
        const dy = Math.max(0, Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom));
        if (dx === 0 && dy === 0) continue;             // overlapping/nested
        // Full-width rows stacked in a list are a normal pattern: the target
        // spans the row, so there is nowhere to mis-tap sideways.
        const bothFullWidth = a.w > 300 && b.w > 300;
        if (bothFullWidth && dx === 0) continue;
        if (dx < GAP && dy < GAP) tight.push(`${a.label} ↔ ${b.label}`);
      }
    }

    const tinyText = [...document.querySelectorAll('p, span, li, dd, dt, figcaption, label')]
      .filter(visible)
      .filter((el) => el.textContent.trim().length > 3)
      .map((el) => ({ size: parseFloat(getComputedStyle(el).fontSize),
                      text: el.textContent.trim().slice(0, 30) }))
      .filter((t) => t.size < MIN_TEXT);

    // How far down is the first control a visitor can act on?
    const firstAction = targets
      .filter((t) => t.h >= 36 && !/skip to main/i.test(t.label))
      .sort((a, b) => a.top - b.top)[0];

    return {
      targets: targets.length,
      small: small.slice(0, 5),
      smallCount: small.length,
      tight: [...new Set(tight)].slice(0, 3),
      tinyText: tinyText.slice(0, 3),
      tinyCount: tinyText.length,
      firstActionTop: firstAction?.top ?? null,
      firstActionLabel: firstAction?.label ?? null,
      docHeight: document.documentElement.scrollHeight,
    };
  });

  const flags = [];
  if (report.smallCount) flags.push(`${report.smallCount} small targets`);
  if (report.tight.length) flags.push(`${report.tight.length} tight pairs`);
  if (report.tinyCount) flags.push(`${report.tinyCount} tiny text`);

  console.log(`\n  ${path}  (${report.targets} targets, page ${report.docHeight}px)`);
  console.log(`    ${flags.length ? flags.join(' · ') : 'clean'}`);
  console.log(`    first action at ${report.firstActionTop}px: ${report.firstActionLabel}`);
  for (const s of report.small) console.log(`      small: ${s.w}x${s.h}  ${s.label}`);
  for (const t of report.tight) console.log(`      tight: ${t}`);
  for (const t of report.tinyText) console.log(`      ${t.size}px: ${t.text}`);
  await page.close();
}
await browser.close();
