/**
 * Cross-checks our mandal coordinates against two independent sources.
 *
 * Coordinates are facts about public places, not authorship, and this app
 * sends people walking on them — a 200m error in the peths is a different
 * lane. Where two independent sources agree and we differ, we are wrong.
 *
 * Provenance is recorded per mandal rather than silently overwritten.
 */
import catalogue from '../src/content/catalogue.json' with { type: 'json' };

const R = 6371008.8, rad = (d) => (d * Math.PI) / 180;
const dist = (a, b) => {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** Our slug → the reference site's slug. */
const SLUGS = {
  'kasba-ganpati': 'kasba-ganpati',
  'tambdi-jogeshwari': 'tambdi-jogeshwari',
  'guruji-talim': 'guruji-talim',
  'tulshibaug-ganpati': 'tulshibaug-ganpati',
  'kesariwada-ganpati': 'kesariwada-ganpati',
  'dagdusheth-halwai-ganpati': 'dagdusheth-halwai',
  'bhau-rangari-ganpati': 'bhausaheb-rangari',
  'akhil-mandai-mandal': 'akhil-mandai-mandal',
  'hutatma-babu-genu-mandal': 'babu-genu-mandal',
  'natu-baug-mandal': 'natu-baug-ganpati',
  'hatti-ganpati-mandal': 'hathi-ganpati',
  'nimbalkar-talim-mandal': 'nimbalkar-talim',
  'chhatrapati-rajaram-mandal': 'chhatrapati-rajaram-mandal',
  'jilbya-maruti-mandal': 'jilbya-maruti-ganpati',
  'shanipar-mandal': 'shanipar-mandal',
  'garud-ganpati-mandal': 'garud-ganpati',
  'mati-ganpati': 'mati-ganpati',
  'perugate-bhave-mandal': 'perugate-mitra-mandal',
  'sarasbaug-ganpati': 'sarasbaug-ganpati',
};

async function reference(slug) {
  const res = await fetch(`https://puneganpati.in/mandals/${slug}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; coordinate cross-check)' },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const lat = html.match(/"latitude":\s*([0-9.]+)/);
  const lng = html.match(/"longitude":\s*([0-9.]+)/);
  return lat && lng ? { lat: Number(lat[1]), lng: Number(lng[1]) } : null;
}

const rows = [];
for (const [ours, theirs] of Object.entries(SLUGS)) {
  const mine = catalogue.ganpatis.find((g) => g.slug === ours);
  if (!mine) { console.log(`  (no local mandal ${ours})`); continue; }
  const ref = await reference(theirs);
  await new Promise((r) => setTimeout(r, 350));
  if (!ref) { console.log(`  --  ${ours.padEnd(28)} reference has no coordinate`); continue; }

  const gap = dist({ lat: mine.latitude, lng: mine.longitude }, ref);
  rows.push({ slug: ours, mine: { lat: mine.latitude, lng: mine.longitude }, ref, gap,
              source: mine.coordinate_source });
  const flag = gap > 150 ? ' <-- WRONG' : gap > 60 ? ' <- check' : '';
  console.log(`  ${gap > 150 ? '!!' : '  '} ${ours.padEnd(28)} ours ${mine.latitude.toFixed(4)},${mine.longitude.toFixed(4)}  ref ${ref.lat.toFixed(4)},${ref.lng.toFixed(4)}  ${String(Math.round(gap)).padStart(4)}m${flag}`);
}

const bad = rows.filter((r) => r.gap > 150);
console.log(`\n  ${rows.length} compared · ${bad.length} differ by more than 150m`);
const { writeFileSync } = await import('node:fs');
writeFileSync('/tmp/coord-compare.json', JSON.stringify(rows, null, 2));
