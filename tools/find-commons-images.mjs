/**
 * Searches Wikimedia Commons for freely-licensed photographs of each mandal.
 *
 * Commons is used because its images carry explicit, machine-readable licences
 * (CC-BY / CC-BY-SA / public domain) that permit reuse with attribution.
 * Photos found elsewhere are overwhelmingly all-rights-reserved, and this app
 * is public.
 */
import catalogue from '../src/content/catalogue.json' with { type: 'json' };

const API = 'https://commons.wikimedia.org/w/api.php';
const ACCEPTABLE = /^(cc[- ]by([- ]sa)?([- ][0-9.]+)?|cc0|public domain|pd-)/i;

async function api(params) {
  const url = new URL(API);
  url.search = new URLSearchParams({ format: 'json', origin: '*', ...params });
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PuneGanpatiDarshan/1.0 (catalogue image sourcing)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function searchFor(term) {
  const search = await api({
    action: 'query', list: 'search', srsearch: `${term} filetype:bitmap`,
    srnamespace: '6', srlimit: '6',
  });
  return (search.query?.search ?? []).map((r) => r.title);
}

async function detailsFor(titles) {
  if (titles.length === 0) return [];
  const info = await api({
    action: 'query', titles: titles.join('|'), prop: 'imageinfo',
    iiprop: 'url|extmetadata|size', iiurlwidth: '1200',
  });
  return Object.values(info.query?.pages ?? {}).map((page) => {
    const ii = page.imageinfo?.[0];
    const meta = ii?.extmetadata ?? {};
    const strip = (v) => (v?.value ?? '').replace(/<[^>]*>/g, '').trim();
    return {
      title: page.title,
      url: ii?.thumburl ?? ii?.url,
      width: ii?.thumbwidth ?? ii?.width,
      height: ii?.thumbheight ?? ii?.height,
      licence: strip(meta.LicenseShortName),
      artist: strip(meta.Artist),
      description: strip(meta.ImageDescription).slice(0, 90),
    };
  });
}

const results = [];
for (const g of catalogue.ganpatis) {
  // Try the specific name first, then a narrower fallback.
  const terms = [g.name, `${g.name_mr ?? ''}`.trim(), `${g.slug.replace(/-/g, ' ')} Pune`]
    .filter(Boolean);

  let found = [];
  for (const term of terms) {
    try {
      const titles = await searchFor(term);
      const details = await detailsFor(titles);
      found = details.filter((d) => d.url && ACCEPTABLE.test(d.licence));
      if (found.length) break;
    } catch { /* keep trying the next term */ }
    await new Promise((r) => setTimeout(r, 250));
  }

  results.push({ slug: g.slug, name: g.name, found });
  const mark = found.length ? `${found.length} usable` : 'none';
  console.log(`  ${found.length ? 'OK ' : '-- '} ${g.slug.padEnd(28)} ${mark}` +
    (found[0] ? `  [${found[0].licence}] ${found[0].title.replace('File:', '').slice(0, 46)}` : ''));
  await new Promise((r) => setTimeout(r, 250));
}

const withImages = results.filter((r) => r.found.length);
console.log(`\n  ${withImages.length}/${results.length} mandals have a freely-licensed photo on Commons`);
await import('node:fs').then((fs) =>
  fs.writeFileSync('/tmp/commons-images.json', JSON.stringify(results, null, 2))
);
