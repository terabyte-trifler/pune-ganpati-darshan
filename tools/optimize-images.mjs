/**
 * Compresses the downloaded photographs.
 *
 * Next optimises on delivery, but the raw files still sit in the repository
 * and are what a cold cache pulls if optimisation is bypassed. 1400px wide is
 * more than any layout here uses (the largest is a full-bleed hero on a
 * desktop split view).
 */
import { readdir, stat, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const ROOT = 'public/mandals';
let before = 0;
let after = 0;

for (const slug of await readdir(ROOT)) {
  for (const file of await readdir(`${ROOT}/${slug}`)) {
    const path = `${ROOT}/${slug}/${file}`;
    before += (await stat(path)).size;

    const buffer = await sharp(path)
      .rotate()                                   // honour EXIF orientation
      .resize({ width: 1400, withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();

    await writeFile(path, buffer);
    after += buffer.length;
  }
}

const mb = (n) => (n / 1024 / 1024).toFixed(1) + ' MB';
console.log(`  ${mb(before)} → ${mb(after)}  (${Math.round((1 - after / before) * 100)}% smaller)`);
