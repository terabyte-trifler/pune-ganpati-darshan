import { chromium } from '@playwright/test';

const svg = (size, maskable) => {
  // Maskable icons need their content inside the safe zone (inner 80%).
  const s = maskable ? 0.62 : 0.78;
  const o = (1 - s) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="#14100C"/>
    <g transform="translate(${o * 100} ${o * 100}) scale(${s})">
      <circle cx="50" cy="50" r="46" fill="none" stroke="#C9A227" stroke-width="2.5" opacity="0.55"/>
      <circle cx="50" cy="50" r="36" fill="none" stroke="#E2621B" stroke-width="2" opacity="0.7"/>
      <circle cx="50" cy="50" r="27" fill="#E2621B"/>
      <path d="M50 30c9 0 16 6 16 14 0 4-2 7.5-4.5 10 4 2.5 7 6.5 7 11.5 0 9-8 15.5-18.5 15.5-2.8 0-4.7-1.9-4.7-4.7s1.9-4.7 4.7-4.7c5.2 0 9-2.8 9-6.1 0-2.8-2.4-5.2-6.6-5.6-2.4 0-4.2-2.4-4.2-4.7 0-1.9.9-3.3 2.8-4.2 2.4-1.4 3.3-3.3 3.3-5.2 0-2.8-1.9-4.7-4.7-4.7s-4.7 1.9-4.7 4.7c0 2.8-1.9 4.7-4.7 4.7s-4.7-1.9-4.7-4.7C34 36 41 30 50 30z" fill="#14100C"/>
      <path d="M34 42c-2-2.4-4.7-3.8-7.5-3.8" stroke="#14100C" stroke-width="4" stroke-linecap="round" fill="none"/>
    </g>
  </svg>`;
};

const browser = await chromium.launch();
const page = await browser.newPage();
const out = 'public/icons';

for (const [name, size, maskable] of [
  ['icon-192', 192, false], ['icon-512', 512, false],
  ['maskable-512', 512, true], ['apple-touch-icon', 180, false],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<body style="margin:0">${svg(size, maskable)}</body>`
  );
  await page.locator('svg').screenshot({ path: `${out}/${name}.png`, omitBackground: false });
  console.log(`${name}.png ${size}x${size}`);
}
await browser.close();
