import { chromium } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';

/**
 * Every app icon, from one mark.
 *
 * Regenerate with `node tools/generate-icons.mjs`. Outputs are committed, so
 * this only needs running when the mark changes.
 *
 * Two things this file exists to get right:
 *
 * 1. ONE mark everywhere. The tab favicon, the Android launcher icon and the
 *    iOS home-screen icon are all seen by the same person, sometimes side by
 *    side. They previously showed an abstract ring device that appeared
 *    nowhere else in the product, so the app looked like two different apps.
 *    This uses the Ganpati head from <GanpatiGlyph>, which is the mark the
 *    catalogue already draws on every card.
 *
 * 2. A SEPARATE cut for small sizes. A favicon's whole job is to read at
 *    16px, and at 16px the crown, the trunk curl and the eye highlights are
 *    sub-pixel — they do not shrink, they turn to mud. The small cut drops
 *    them, scales the head up and thickens every stroke. Rendering one
 *    detailed master and downscaling produces a smudge; these are rasterised
 *    natively at each size instead.
 */

const RAAT = '#14100C';
const SHENDUR = '#E2621B';
const CHANDAN = '#F0E6D2';

/** Full mark: crown, trunk, the lot. For 48px and up. */
const detailed = (scale) => `
  <g transform="translate(50,53) scale(${scale}) translate(-50,-50)">
    <path d="M34 32C24 26 12 28 7 37c-5 9-2 22 6 28 6 5 14 5 21 1Z" fill="${CHANDAN}"/>
    <path d="M66 32c10-6 22-4 27 5 5 9 2 22-6 28-6 5-14 5-21 1Z" fill="${CHANDAN}"/>
    <circle cx="50" cy="6" r="4.2" fill="${CHANDAN}"/>
    <path d="M50 11c6 0 11 4 13 10H37c2-6 7-10 13-10Z" fill="${CHANDAN}"/>
    <rect x="33" y="21" width="34" height="5" rx="2.4" fill="${CHANDAN}"/>
    <path d="M50 26c11 0 19 8 19 18v9c0 10-8 18-19 18s-19-8-19-18v-9c0-10 8-18 19-18Z"
          fill="${CHANDAN}" stroke="${SHENDUR}" stroke-width="3"/>
    <path d="M50 57c0 8-.6 14-4 18.5-2.6 3.4-2 7.5 1.8 8.6 3 .9 5.6-.9 5.9-3.6"
          stroke="${CHANDAN}" stroke-width="7" stroke-linecap="round" fill="none"/>
    <ellipse cx="41" cy="41" rx="3.4" ry="4" fill="${SHENDUR}"/>
    <ellipse cx="59" cy="41" rx="3.4" ry="4" fill="${SHENDUR}"/>
  </g>`;

/** Small cut: ears, head, eyes, a trunk stub. For 16px and 32px. */
const simplified = (scale) => `
  <g transform="translate(50,54) scale(${scale}) translate(-50,-50)">
    <ellipse cx="20" cy="46" rx="19" ry="21" fill="${CHANDAN}"/>
    <ellipse cx="80" cy="46" rx="19" ry="21" fill="${CHANDAN}"/>
    <path d="M50 24c13 0 22 9 22 21v8c0 12-9 21-22 21s-22-9-22-21v-8c0-12 9-21 22-21Z"
          fill="${CHANDAN}" stroke="${SHENDUR}" stroke-width="4"/>
    <path d="M50 62v14" stroke="${CHANDAN}" stroke-width="9" stroke-linecap="round"/>
    <circle cx="40" cy="42" r="4.4" fill="${SHENDUR}"/>
    <circle cx="60" cy="42" r="4.4" fill="${SHENDUR}"/>
  </g>`;

/**
 * @param size    pixel size to rasterise at
 * @param variant 'detailed' | 'simplified'
 * @param ground  'brand' (vermilion tile) | 'night' (app ground)
 * @param maskable Android crops to a circle; content must sit in the inner 80%
 * @param radius  corner radius in viewBox units; 0 for a full bleed square
 */
const svg = ({ size, variant, ground, maskable = false, radius = 20 }) => {
  const bg = ground === 'brand' ? SHENDUR : RAAT;
  // Maskable icons get cropped to a circle on Android, so the mark shrinks
  // into the safe zone and the tile bleeds to the edges.
  const scale = maskable ? 0.62 : variant === 'simplified' ? 0.86 : 0.8;
  const r = maskable ? 0 : radius;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
    <rect width="100" height="100" rx="${r}" fill="${bg}"/>
    ${variant === 'simplified' ? simplified(scale) : detailed(scale)}
  </svg>`;
};

/**
 * Pack PNGs into an .ico.
 *
 * The container is trivial — a 6-byte header, a 16-byte directory entry per
 * image, then the payloads — and every browser in use accepts PNG-compressed
 * entries, so this avoids a dependency for thirty lines of buffer writing.
 */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  let offset = 6 + images.length * 16;
  for (const { size, data } of images) {
    const e = Buffer.alloc(16);
    // 0 means 256 in this format; 256 does not fit in a byte.
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // palette size
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += data.length;
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

const browser = await chromium.launch();
const page = await browser.newPage();

async function render(spec) {
  await page.setViewportSize({ width: spec.size, height: spec.size });
  await page.setContent(`<body style="margin:0;padding:0">${svg(spec)}</body>`);
  // `omitBackground` is what puts an alpha channel on the PNG. Without it
  // Chromium writes RGB, and Next refuses the .ico outright at build time
  // with "The PNG is not in RGBA format!". It also leaves the rounded
  // corners transparent rather than filled with the page's white, which is
  // what a tab icon wants anyway.
  return page.screenshot({ omitBackground: true });
}

await mkdir('public/icons', { recursive: true });

/* ---- PWA / platform icons ---- */
for (const [name, size, maskable] of [
  ['icon-192', 192, false],
  ['icon-512', 512, false],
  ['maskable-512', 512, true],
  ['apple-touch-icon', 180, false],
]) {
  const data = await render({
    size,
    variant: 'detailed',
    // Home-screen icons sit on the user's wallpaper; the vermilion tile holds
    // its own there, where the near-black app ground disappears into dark
    // wallpapers.
    ground: 'brand',
    maskable,
    radius: name === 'apple-touch-icon' ? 0 : 20, // iOS applies its own mask
  });
  await writeFile(`public/icons/${name}.png`, data);
  console.log(`  public/icons/${name}.png`);
}

/* ---- favicon.ico ---- */
const frames = [];
for (const size of [16, 32, 48, 64, 128, 256]) {
  frames.push({
    size,
    data: await render({
      size,
      variant: size <= 32 ? 'simplified' : 'detailed',
      ground: 'brand',
      radius: size <= 32 ? 16 : 20,
    }),
  });
}
await writeFile('src/app/favicon.ico', buildIco(frames));
console.log(`  src/app/favicon.ico (${frames.map((f) => f.size).join(', ')})`);

await browser.close();
