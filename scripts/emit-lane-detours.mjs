/**
 * Regenerate src/content/lane-detours.ts from a detour search.
 *
 * Input is /tmp/detours.json, written by searching, for every pair in
 * lane-against.ts, a chain of waypoints that gets there legally.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const found = JSON.parse(readFileSync('/tmp/detours.json', 'utf8'));
const catalogue = JSON.parse(readFileSync('src/content/catalogue.json', 'utf8'));
const at = Object.fromEntries(
  catalogue.ganpatis.map((g) => [g.slug, { lat: g.latitude, lng: g.longitude }])
);
const round = (n) => Math.round(n * 1e6) / 1e6;

const usable = Object.entries(found)
  .filter(([, v]) => v.via?.length && v.against < 25)
  .sort(([a], [b]) => a.localeCompare(b));

const rows = usable.map(([key, v]) => {
  const [from, to] = key.split('>');
  const A = at[from], B = at[to];
  const via = v.via.map((p) => `{ lat: ${round(p.lat)}, lng: ${round(p.lng)} }`).join(', ');
  return `  // ${String(v.m).padStart(4)} m the legal way round\n` +
    `  { from: '${from}', to: '${to}',\n` +
    `    fromAt: { lat: ${A.lat}, lng: ${A.lng} }, toAt: { lat: ${B.lat}, lng: ${B.lng} },\n` +
    `    via: [${via}],\n` +
    `    distanceM: ${v.m} },`;
});

const stuck = Object.entries(found).filter(([, v]) => !(v.via?.length && v.against < 25));

const header = `import type { LatLng } from '@/lib/geo';

/**
 * The way round, for walks that cannot be made legal in a straight line.
 *
 * A one-way lane cannot be walked back up, and barring it is not enough to
 * make a router find the way round: bar the lanes through the peth core
 * and Valhalla returns no path at all, because as far as OSM is concerned
 * those lanes ARE the streets there. The router has to be sent, not
 * walled off — handed the waypoints that make the legal loop, the way a
 * person would be told to go out to Shanipar chowk and come back in past
 * Guruji Talim.
 *
 * Which waypoints, though, is not something a bearing can answer. A stop
 * fed by a one-way lane can only be reached down that lane — Tulshibaug
 * is entered from Guruji Talim and nowhere else — and getting to Guruji
 * Talim from the wrong side of the peth is the same problem again, one
 * street further out. So the chains were searched for rather than
 * reasoned about.
 *
 * ---------------------------------------------------------------------
 * DERIVED DATA, like lane-against.ts and from the same lanes. For every
 * pair there that still walked against a lane, chains of one and two
 * waypoints were tried — the lane entries that feed the destination, the
 * closure junctions, and the mandals themselves, all being real places on
 * real streets — and the SHORTEST chain that came back clean was kept.
 *
 * Shortest matters. Taking the first clean chain instead sent Hutatma
 * Babu Genu to Tulshibaug the long way round, 1433 m where 666 m does it.
 *
 * ${usable.length} of the ${Object.keys(found).length} pairs have a way round. The other ${stuck.length} have none
 * that this search could find, and stay as they are — the ordering
 * already prices them so a plan avoids the pair altogether.
 *
 * Regenerate with scripts/emit-lane-detours.mjs after lane-against.ts.
 * ---------------------------------------------------------------------
 */
export interface LaneDetour {
  from: string;
  to: string;
  fromAt: LatLng;
  toAt: LatLng;
  /** Waypoints to route through, in order. */
  via: LatLng[];
  /** How long the legal walk is. The illegal one is always shorter. */
  distanceM: number;
}

export const LANE_DETOURS: LaneDetour[] = [
`;

writeFileSync('src/content/lane-detours.ts', header + rows.join('\n') + '\n];\n');
console.log(`emitted ${rows.length} detours; ${stuck.length} pairs have no way round`);
