/**
 * Locates the chowks on Kasba's Laxmi Road schedule.
 *   npx tsx scripts/emit-checkpoint-geometry.mjs
 *
 * ---------------------------------------------------------------------
 * The rule that makes this safe.
 *
 * Searching OSM for Pune chowk names is how "Tilak Chowk" ended up in
 * Nigdi, seventeen kilometres away, the last time this was tried. A name
 * match alone is not evidence.
 *
 * But these ten are not arbitrary places: the mandal published them as
 * the points its procession passes ALONG LAXMI ROAD, and that road is
 * already drawn in visarjan-geometry.ts. So every candidate is checked
 * against the corridor itself — a chowk more than MAX_OFF_CORRIDOR_M
 * from it is not the chowk the schedule means, whatever it is called.
 *
 * That test would have rejected the Nigdi result instantly. Anything it
 * rejects stays unplaced and is listed by name on the page instead.
 */
import { writeFileSync } from 'node:fs';
import { VISARJAN_GEOMETRY } from '../src/content/visarjan-geometry.ts';
import { MANDAL_ROUTE_SCHEDULES } from '../src/content/visarjan.ts';
import { CLOSURE_JUNCTIONS } from '../src/content/diversions.ts';

const ENDPOINT = 'https://overpass-api.de/api/interpreter';
const UA = 'ganpatipune.in visarjan checkpoints/1.0';
const BBOX = '18.49,73.83,18.54,73.89';

/** How far off the drawn corridor a checkpoint may sit, in metres. */
const MAX_OFF_CORRIDOR_M = 350;

/**
 * Matches that are roads, not places.
 *
 * A way's centre is meaningless as a checkpoint: "Lokmanya Tilak Marg"
 * passed the corridor test with 1 m to spare — because the corridor IS
 * that road — and put the procession's starting point at the wrong end
 * of it, 1.3 km from Mandai and out of sequence with every checkpoint
 * after it.
 */
const ROAD_NAME = /\b(marg|road|rd|path|street|lane|मार्ग|रस्ता|पथ)\b/i;

/**
 * Points we already hold from a source better than a name search.
 *
 * The Tilak statue stands at Mandai, and Mandai is on the police's own
 * closure map with a coordinate.
 */
const KNOWN = {
  'Lokmanya Tilak Putala (Mandai)': 'Mandai Chowk',
};

/** Search patterns per checkpoint, keyed by the schedule's own place name. */
const PATTERNS = {
  'Lokmanya Tilak Putala (Mandai)': 'Mandai|मंडई|Lokmanya Tilak',
  'Belbaug Chowk': 'Belbaug|Belbag|बेलबाग',
  'Ganpati Chowk': 'Ganpati Chowk|गणपती चौक',
  'Shri Limbraj Maharaj Chowk (Vaibhav Chowk)': 'Limbraj|Vaibhav|लिंबराज|वैभव',
  'Kunte Chowk': 'Kunte|कुंटे',
  'Umbrya Ganpati Chowk': 'Umbrya|Umbrey|उंबऱ्या',
  'Bhanuvilas Chowk': 'Bhanuvilas|Bhanuwilas|भानुविलास',
  'Vijay Talkies Chowk': 'Vijay Talkies|विजय टॉकीज',
  'Garud Ganpati Chowk': 'Garud|गरूड',
  'Tilak Chowk': 'Tilak Chowk|टिळक चौक',
};

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
function haversine([x1, y1], [x2, y2]) {
  const dLat = toRad(y2 - y1);
  const dLng = toRad(x2 - x1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(y1)) * Math.cos(toRad(y2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Shortest distance from a point to any drawn corridor vertex. */
const corridorPoints = VISARJAN_GEOMETRY.filter((g) => g.kind === 'procession')
  .flatMap((g) => g.segments.flat());

function offCorridor(pt) {
  let best = Infinity;
  for (const c of corridorPoints) best = Math.min(best, haversine(pt, c));
  return best;
}

async function main() {
  const names = Object.values(PATTERNS);
  const query = `[out:json][timeout:180];(${names
    .map((re) => `node["name"~"${re}",i](${BBOX});way["name"~"${re}",i](${BBOX});`)
    .join('')});out center tags;`;
  console.log('fetching candidates…');
  const data = await overpass(query);

  const kasba = MANDAL_ROUTE_SCHEDULES.find((s) => s.slug === 'kasba-ganpati');
  const out = [];

  for (const cp of kasba.checkpoints) {
    const known = KNOWN[cp.place];
    if (known) {
      const j = CLOSURE_JUNCTIONS.find((k) => k.name === known);
      if (j) {
        const off = Math.round(offCorridor([j.lng, j.lat]));
        console.log(`  KNOWN  ${cp.time} ${cp.place} — "${j.name}" from the police map, ${off} m off`);
        out.push({
          time: cp.time, place: cp.place, placeMr: cp.placeMr,
          osmName: `${j.name} (Pune City Traffic Police closure map)`,
          offCorridorM: off,
          lng: Number(j.lng.toFixed(6)), lat: Number(j.lat.toFixed(6)),
        });
        continue;
      }
    }

    const re = new RegExp(PATTERNS[cp.place], 'i');
    const candidates = data.elements
      .filter((e) => re.test(e.tags?.name ?? '') && !ROAD_NAME.test(e.tags?.name ?? ''))
      .map((e) => ({
        name: e.tags.name,
        pt: e.type === 'node' ? [e.lon, e.lat] : [e.center?.lon, e.center?.lat],
      }))
      .filter((c) => Number.isFinite(c.pt[0]))
      .map((c) => ({ ...c, off: Math.round(offCorridor(c.pt)) }))
      .sort((a, b) => a.off - b.off);

    const best = candidates[0];
    if (!best) {
      console.warn(`  MISS   ${cp.time} ${cp.place} — nothing named that here`);
      continue;
    }
    if (best.off > MAX_OFF_CORRIDOR_M) {
      console.warn(
        `  REJECT ${cp.time} ${cp.place} — nearest "${best.name}" is ${best.off} m off the corridor`
      );
      continue;
    }
    console.log(`  PLACE  ${cp.time} ${cp.place} — "${best.name}", ${best.off} m off`);
    out.push({
      time: cp.time,
      place: cp.place,
      placeMr: cp.placeMr,
      osmName: best.name,
      offCorridorM: best.off,
      lng: Number(best.pt[0].toFixed(6)),
      lat: Number(best.pt[1].toFixed(6)),
    });
  }

  const body = `// GENERATED by scripts/emit-checkpoint-geometry.mjs — do not hand-edit.
//
// Positions from OpenStreetMap, © OpenStreetMap contributors, ODbL.
//
// Only the chowks that sit ON the drawn procession corridor are here.
// A name match alone is not evidence — searching these names once put
// "Tilak Chowk" in Nigdi — so each was checked against Laxmi Road itself
// and anything further than ${MAX_OFF_CORRIDOR_M} m from it was rejected. The
// times come from the mandal's schedule in ./visarjan.ts and are not
// repeated here, so the two cannot drift apart.

export interface CheckpointPoint {
  /** Matches a checkpoint time in MANDAL_ROUTE_SCHEDULES. */
  time: string;
  place: string;
  placeMr: string;
  /** What OSM calls it, kept so a wrong match can be spotted. */
  osmName: string;
  /** Distance from the drawn corridor, in metres. */
  offCorridorM: number;
  lat: number;
  lng: number;
}

export const CHECKPOINT_POINTS: CheckpointPoint[] = ${JSON.stringify(out, null, 2)};

/** How many the schedule lists, placed or not. */
export const TOTAL_CHECKPOINTS = ${kasba.checkpoints.length};
`;
  /**
   * Once on Laxmi Road the procession only goes one way, so the placed
   * checkpoints must march in one direction — a point that doubles back
   * is in the wrong place however close to the road it looks.
   *
   * The first checkpoint is exempt, and for a real reason: the mandals
   * form up at the Tilak statue by Mandai and then JOIN Laxmi Road at
   * Belbaug Chowk, 44 m back to the east. That step is the approach, not
   * the route, and an unqualified monotonic test reads it as an error
   * and rejects a correct position.
   */
  const walk = out.slice(1);
  const lngs = walk.map((o) => o.lng);
  const monotonic =
    lngs.every((v, i) => i === 0 || v <= lngs[i - 1]) ||
    lngs.every((v, i) => i === 0 || v >= lngs[i - 1]);
  console.log(`\n  walk down the corridor: ${monotonic ? 'consistent' : 'BROKEN — a point doubles back'}`);
  if (!monotonic) {
    for (const o of walk) console.warn(`    ${o.time} ${o.lng} ${o.place}`);
    throw new Error('checkpoint order does not follow the route');
  }
  if (out.length > 1) {
    const approach = Math.round(
      Math.abs(out[0].lng - out[1].lng) * 111_320 * Math.cos((out[0].lat * Math.PI) / 180)
    );
    console.log(`  approach from ${out[0].place} to ${out[1].place}: ${approach} m`);
  }

  writeFileSync(new URL('../src/content/visarjan-checkpoints.ts', import.meta.url), body);
  console.log(`wrote ${out.length} of ${kasba.checkpoints.length} checkpoints`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
