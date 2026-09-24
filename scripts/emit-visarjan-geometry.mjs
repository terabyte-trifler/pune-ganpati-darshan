/**
 * Generates src/content/visarjan-geometry.ts from OpenStreetMap.
 *
 * Run with tsx (it reads the police junction list, which is TypeScript):
 *   npx tsx scripts/emit-visarjan-geometry.mjs
 *
 * ---------------------------------------------------------------------
 * What this draws, and what it refuses to.
 *
 * The notice names seventeen stretches as "<road>, <point> to <point>".
 * Turning that into lines needs the end points, and two attempts at
 * getting them automatically failed in ways worth recording:
 *
 *   - Stitching every OSM way of a road into one polyline collapsed
 *     Karve Road (69 ways) to four points. Silent, and wrong.
 *   - Nominatim put "Tilak Chowk" in Nigdi, 17 km from Tilak Road. A
 *     wrong end point does not draw a short line, it draws a confident
 *     line across the wrong half of the city.
 *
 * So end points come only from the police's own junction list, which is
 * already in the app with coordinates, and a stretch is drawn ONLY when
 * both of its ends are in that list and OSRM can route between them
 * along the road. Everything else stays a row of text on /visarjan.
 *
 * The procession corridor is the exception, and a deliberate one: the
 * four roads the miravnuk takes are peth-length roads, so their OSM
 * geometry clipped to the peth core IS the corridor. Those are drawn as
 * the road, flagged `extent: 'road'`, and the map labels them as the
 * route rather than as a closure.
 */
import { writeFileSync } from 'node:fs';
import { CLOSURE_JUNCTIONS } from '../src/content/diversions.ts';

const ENDPOINT = 'https://overpass-api.de/api/interpreter';
const OSRM = 'https://router.project-osrm.org';
const UA = 'ganpatipune.in visarjan map/1.0';
const BBOX = '18.46,73.79,18.56,73.92';

/** The peth core, for clipping the procession roads. */
const PETH = { minLat: 18.4975, maxLat: 18.5275, minLng: 73.8425, maxLng: 73.8775 };

/** The four roads the miravnuk takes, and their OSM name patterns. */
// Anchored, because a loose pattern is how the wrong road gets drawn:
// "Laxmi" also matched Laxminagar Road, a different road a kilometre
// south, and it was being drawn as part of the procession corridor.
// "Laxmi Path" IS Laxmi Road — the Marathi name, and how OSM tags most
// of it — so it stays. "Tilak Road" matches nothing at all in OSM.
const PROCESSION = [
  { road: 'Laxmi Road', re: '^(Laxmi|Lakshmi) (Path|Road|Rd)$' },
  { road: 'Tilak Road', re: '^(Lokmanya Tilak Marg|Tilak (Road|Rd))$' },
  // Both are tagged under their full formal names. The exclusions matter:
  // Sudhabhau Kelkar Path and the Kelkar Sangrahalay path are different
  // roads that a bare "Kelkar" sweeps in.
  { road: 'Kumthekar Road', re: '^R\\. ?B\\. ?Kumthekar Marg$' },
  { road: 'Kelkar Road', re: '^Narsimha Chintaman Kelkar Marg$' },
];

/**
 * Stretches whose two ends are both named on the police junction map.
 * `from`/`to` are matched against that list, nothing else.
 */
const STRETCHES = [
  { road: 'Shivaji Road', from: 'Gadgil Putala', to: 'Jedhe Chowk' },
  { road: 'Bagade Road', from: 'Sonya Maruti Chowk', to: 'Fadake Haud Chowk' },
  { road: 'Karve Road', from: 'Nalstop Chowk', to: 'Khandojibaba Chowk' },
  // Bajirao (Savarkar Chowk) and Shastri (Alka Talkies) are deliberately
  // absent: neither end point is on the police junction map, and drawing
  // from the nearest junction that is would move the closure. They stay
  // as text rows on /visarjan, which is the accurate place for them.
];

async function overpass(query, attempt = 1) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data: query }),
  });
  const text = await res.text();
  if (!text.trimStart().startsWith('{')) {
    if (attempt >= 6) throw new Error(`Overpass refused after ${attempt} tries`);
    await new Promise((r) => setTimeout(r, 8000 * attempt));
    return overpass(query, attempt + 1);
  }
  return JSON.parse(text);
}

const R = 6371000;
const toRad = (d) => (d * Math.PI) / 180;
function haversine([lng1, lat1], [lng2, lat2]) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const inPeth = ([lng, lat]) =>
  lat >= PETH.minLat && lat <= PETH.maxLat && lng >= PETH.minLng && lng <= PETH.maxLng;

const junction = (name) => {
  const j = CLOSURE_JUNCTIONS.find((k) => k.name.toLowerCase() === name.toLowerCase());
  if (!j) throw new Error(`junction not on the police map: ${name}`);
  return [j.lng, j.lat];
};

async function route(a, b) {
  const url = `${OSRM}/route/v1/driving/${a.join(',')};${b.join(',')}?overview=full&geometries=geojson`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  const json = await res.json();
  if (json.code !== 'Ok' || !json.routes?.length) return null;
  const r = json.routes[0];
  // A route much longer than the straight line means it went around
  // something — not the stretch the notice names. Reject rather than draw.
  const direct = haversine(a, b);
  if (r.distance > direct * 1.6 + 200) {
    console.warn(`    rejected: routed ${Math.round(r.distance)}m vs ${Math.round(direct)}m direct`);
    return null;
  }
  return r.geometry.coordinates;
}

async function main() {
  const all = [...PROCESSION];
  const query = `[out:json][timeout:180];(${all
    .map((s) => `way["highway"]["name"~"${s.re}",i](${BBOX});`)
    .join('')});out geom;`;
  console.log('fetching procession roads…');
  const roads = await overpass(query);

  const out = [];

  for (const p of PROCESSION) {
    const re = new RegExp(p.re, 'i');
    // Kept as separate segments rather than stitched: stitching is what
    // silently truncated a road last time, and the map draws a
    // MultiLineString just as well.
    const segments = roads.elements
      .filter((w) => w.geometry?.length && re.test(w.tags?.name ?? ''))
      .map((w) => w.geometry.map((pt) => [pt.lon, pt.lat]))
      .map((line) => line.filter(inPeth))
      .filter((line) => line.length >= 2);
    if (!segments.length) {
      console.warn(`  MISS  ${p.road}`);
      continue;
    }
    const pts = segments.reduce((n, s) => n + s.length, 0);
    console.log(`  ROUTE ${p.road} — ${segments.length} segments, ${pts} pts`);
    out.push({
      road: p.road,
      kind: 'procession',
      extent: 'road',
      segments: segments.map((s) => s.map(round)),
    });
  }

  for (const s of STRETCHES) {
    const a = junction(s.from);
    const b = junction(s.to);
    const line = await route(a, b);
    if (!line) {
      console.warn(`  DROP  ${s.road} (${s.from} → ${s.to})`);
      continue;
    }
    console.log(`  TRIM  ${s.road} — ${line.length} pts, ${s.from} → ${s.to}`);
    out.push({
      road: s.road,
      kind: 'closure',
      extent: 'stretch',
      from: s.from,
      to: s.to,
      segments: [line.map(round)],
    });
    await new Promise((r) => setTimeout(r, 1200));
  }

  const body = `// GENERATED by scripts/emit-visarjan-geometry.mjs — do not hand-edit.
//
// Road geometry from OpenStreetMap, © OpenStreetMap contributors, ODbL.
// Routed stretches via OSRM over the same data. Times and the full list of
// closures live in ./visarjan.ts — this file is only what can be drawn.
//
// Not every closure is here, and that is the point. A line is emitted only
// when both of its end points are named on the police's own junction map;
// the rest stay as text, because a guessed end point draws a confident
// line down the wrong road. See the script header.

export interface VisarjanGeometry {
  /** Matches \`road\` in VISARJAN_CLOSURES. */
  road: string;
  /** 'procession' is the miravnuk's own corridor, not a closure line. */
  kind: 'procession' | 'closure';
  /** 'stretch' is trimmed to the notice's end points; 'road' is the road. */
  extent: 'stretch' | 'road';
  from?: string;
  to?: string;
  /** [lng, lat] pairs, as separate segments. */
  segments: [number, number][][];
}

export const VISARJAN_GEOMETRY: VisarjanGeometry[] = ${JSON.stringify(out, null, 2)};

export const OSM_CREDIT = '© OpenStreetMap contributors';
`;
  writeFileSync(new URL('../src/content/visarjan-geometry.ts', import.meta.url), body);
  const drawn = out.filter((o) => o.kind === 'closure').length;
  console.log(`\nwrote ${out.length} — ${out.length - drawn} procession roads, ${drawn} closures`);
}

function round([x, y]) {
  return [Number(x.toFixed(6)), Number(y.toFixed(6))];
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
