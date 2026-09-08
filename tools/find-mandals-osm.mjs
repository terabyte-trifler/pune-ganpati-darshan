/**
 * Looks up missing mandals in OpenStreetMap.
 *
 * Coordinates must be real. This app sends people walking across Pune, and a
 * fabricated position is worse than an absent record — so anything that
 * cannot be located from a verifiable source is reported rather than guessed.
 *
 * Overpass is queried first (structured tags, exact nodes), then Nominatim as
 * a fallback for free-text names. Both are used within their usage policies:
 * a descriptive User-Agent and no more than one request per second.
 */

const OVERPASS = 'https://overpass-api.de/api/interpreter';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const UA = 'PuneGanpatiDarshan/1.0 (open-source mandal catalogue; contact via GitHub)';

// Old-peth core plus a margin, so we do not pull in the whole district.
const BBOX = '18.495,73.835,18.535,73.870';

const WANTED = [
  'Perugate Bhave High School Mitra Mandal',
  'Chimnya Ganpati',
  'Nagarkar Talim Mandal',
  'Shahu Chowk Mandal',
  'Navjawan Mitra Mandal',
  'Mati Ganpati',
  'Bal Vikas Mitra Mandal',
  'Hirabaug Ganpati',
  'Khadakmal Ali Mandal',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Everything in the peth core that looks like a Ganesh mandal or temple. */
async function overpassSweep() {
  const query = `
    [out:json][timeout:40];
    (
      node["name"~"Ganpati|Ganapati|Ganesh|Mandal|Talim|गणपती|मंडळ",i](${BBOX});
      way["name"~"Ganpati|Ganapati|Ganesh|Mandal|Talim|गणपती|मंडळ",i](${BBOX});
    );
    out center tags;`;
  const res = await fetch(OVERPASS, {
    method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'text/plain' }, body: query,
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const json = await res.json();
  return (json.elements ?? []).map((e) => ({
    name: e.tags?.name, nameEn: e.tags?.['name:en'], nameMr: e.tags?.['name:mr'],
    lat: e.lat ?? e.center?.lat, lng: e.lon ?? e.center?.lon,
    kind: e.tags?.amenity ?? e.tags?.building ?? e.tags?.religion ?? 'unknown',
    osm: `${e.type}/${e.id}`,
  })).filter((e) => e.name && e.lat);
}

async function nominatim(name) {
  const url = new URL(NOMINATIM);
  url.search = new URLSearchParams({
    q: `${name}, Pune, Maharashtra`, format: 'jsonv2', limit: '3', countrycodes: 'in',
  });
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return [];
  const json = await res.json();
  return json.map((r) => ({
    display: r.display_name.slice(0, 80), lat: Number(r.lat), lng: Number(r.lon),
    type: r.type, importance: r.importance,
  }));
}

console.log('=== Overpass sweep of the peth core ===');
let sweep = [];
try {
  sweep = await overpassSweep();
  console.log(`  ${sweep.length} candidate features in OSM\n`);
  for (const f of sweep.slice(0, 30)) {
    console.log(`  ${f.lat.toFixed(4)},${f.lng.toFixed(4)}  ${(f.name ?? '').slice(0, 52).padEnd(54)} ${f.osm}`);
  }
} catch (e) {
  console.log('  Overpass failed:', String(e).slice(0, 80));
}

console.log('\n=== Named lookups ===');
const found = [];
for (const name of WANTED) {
  // Prefer an exact-ish match from the structured sweep.
  const key = name.toLowerCase().split(' ')[0];
  const local = sweep.find((f) => (f.name ?? '').toLowerCase().includes(key));

  let result = local
    ? { source: 'overpass', lat: local.lat, lng: local.lng, detail: local.name, osm: local.osm }
    : null;

  if (!result) {
    await sleep(1100);
    const hits = await nominatim(name);
    // Only accept a hit that actually lands in the peth area.
    const inArea = hits.find((h) => h.lat > 18.49 && h.lat < 18.54 && h.lng > 73.83 && h.lng < 73.87);
    if (inArea) result = { source: 'nominatim', lat: inArea.lat, lng: inArea.lng, detail: inArea.display };
  }

  found.push({ name, ...(result ?? {}) });
  console.log(result
    ? `  OK  ${name.padEnd(42)} ${result.lat.toFixed(4)},${result.lng.toFixed(4)}  [${result.source}]`
    : `  --  ${name.padEnd(42)} not found`);
}

const { writeFileSync } = await import('node:fs');
writeFileSync('/tmp/osm-mandals.json', JSON.stringify({ sweep, found }, null, 2));
console.log(`\n  located ${found.filter((f) => f.lat).length}/${WANTED.length}`);
