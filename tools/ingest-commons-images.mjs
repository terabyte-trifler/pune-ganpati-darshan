/**
 * Downloads verified Wikimedia Commons photographs into public/mandals/ and
 * writes rows into ganpati_images with attribution.
 *
 * Self-hosted rather than hot-linked: Wikimedia asks that its thumbnail
 * service not be used as a CDN, and local files let Next optimise them and
 * keep working when the network is poor — which is the whole point of this
 * app's offline behaviour.
 *
 * CC BY-SA requires attribution, a licence link, and an indication that the
 * image was changed. Every row records photographer and licence, the UI
 * renders both, and the resize is disclosed on /licences.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import catalogue from '../src/content/catalogue.json' with { type: 'json' };
import candidates from '/tmp/commons-images.json' with { type: 'json' };

const MAX_PER_MANDAL = 3;

/** Distinctive words from a mandal name, used to confirm a photo is really it. */
function keyTokens(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !['shri', 'shrimant', 'ganpati', 'ganesh',
      'mandal', 'temple', 'mandir', 'sarvajanik', 'ganeshotsav'].includes(w));
}

const rows = [];
for (const entry of candidates) {
  if (entry.found.length === 0) continue;
  const tokens = keyTokens(entry.name);

  // Commons search is fuzzy; require a distinctive name token in the filename
  // so we never label a photo as a mandal it is not.
  const verified = entry.found.filter((f) => {
    const haystack = f.title.toLowerCase();
    return tokens.some((t) => haystack.includes(t));
  });

  if (verified.length === 0) {
    console.log(`  SKIP ${entry.slug} — ${entry.found.length} results, none verifiably this mandal`);
    continue;
  }

  const dir = `public/mandals/${entry.slug}`;
  await mkdir(dir, { recursive: true });

  let index = 0;
  for (const image of verified.slice(0, MAX_PER_MANDAL)) {
    const file = `${dir}/${index + 1}.jpg`;
    if (!existsSync(file)) {
      const res = await fetch(image.url, {
        headers: { 'User-Agent': 'PuneGanpatiDarshan/1.0 (catalogue image sourcing)' },
      });
      if (!res.ok) { console.log(`  fetch failed ${image.title}`); continue; }
      await writeFile(file, Buffer.from(await res.arrayBuffer()));
      await new Promise((r) => setTimeout(r, 200));
    }

    rows.push({
      slug: entry.slug,
      url: `/mandals/${entry.slug}/${index + 1}.jpg`,
      alt: `${entry.name}, Pune`,
      credit: `${image.artist || 'Unknown'} / ${image.licence} via Wikimedia Commons`,
      width: image.width,
      height: image.height,
      sort_order: index,
      is_primary: index === 0,
      source: image.title,
    });
    index++;
  }
  console.log(`  ${entry.slug.padEnd(28)} ${index} image(s)`);
}

await writeFile('/tmp/image-rows.json', JSON.stringify(rows, null, 2));
console.log(`\n  ${rows.length} images across ${new Set(rows.map((r) => r.slug)).size} mandals`);
console.log(`  ${catalogue.ganpatis.length - new Set(rows.map((r) => r.slug)).size} mandals keep the generated fallback`);
