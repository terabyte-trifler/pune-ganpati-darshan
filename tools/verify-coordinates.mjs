/**
 * Cross-checks seeded coordinates against OpenStreetMap.
 *
 * The seed's provenance is a prototype, not a survey. In the peths a 300m
 * error puts a visitor in a different lane entirely, so any disagreement with
 * an independently-mapped feature is worth knowing about before people walk
 * on it.
 */
import catalogue from '../src/content/catalogue.json' with { type: 'json' };
import osm from '/tmp/osm-mandals.json' with { type: 'json' };

const R = 6371008.8, rad = (d) => (d * Math.PI) / 180;
const dist = (a, b) => {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** Normalised tokens, so "Garud Ganapati Mandir" matches "Garud Ganpati Mandal". */
const tokens = (s) => s.toLowerCase()
  .replace(/ganapati/g, 'ganpati')
  .replace(/[^a-z\s]/g, ' ')
  .split(/\s+/)
  .filter((w) => w.length > 3 && !['ganpati', 'mandir', 'mandal', 'temple', 'shri',
    'shrimant', 'sarvajanik', 'ganeshotsav', 'chowk'].includes(w));

console.log('  mandal                        seeded          OSM feature                       gap');
console.log('  ' + '-'.repeat(96));

const rows = [];
for (const g of catalogue.ganpatis) {
  const want = tokens(g.name);
  if (want.length === 0) continue;

  // Require every distinctive token to be present, so "Bal Vikas" cannot
  // match "Bal Shivaji".
  const match = osm.sweep.find((f) => {
    const have = tokens(f.name);
    return want.every((w) => have.some((h) => h.startsWith(w) || w.startsWith(h)));
  });
  if (!match) continue;

  const gap = dist({ lat: g.latitude, lng: g.longitude }, { lat: match.lat, lng: match.lng });
  rows.push({ slug: g.slug, name: g.name, gap, osm: match });
  const flag = gap > 250 ? '  <-- CHECK' : gap > 120 ? '  <- minor' : '';
  console.log(`  ${g.slug.slice(0, 27).padEnd(29)} ${g.latitude.toFixed(4)},${g.longitude.toFixed(4)}  ` +
    `${match.name.slice(0, 32).padEnd(34)} ${String(Math.round(gap)).padStart(4)}m${flag}`);
}

const bad = rows.filter((r) => r.gap > 250);
console.log(`\n  ${rows.length} of ${catalogue.ganpatis.length} mandals have an OSM counterpart`);
console.log(`  ${bad.length} disagree by more than 250m — a different lane in the peths`);
