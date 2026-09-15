/**
 * Regenerate src/content/lane-against.ts from a full pair sweep.
 *
 * Input is /tmp/full-pairs.json, written by measuring every ordered pair
 * of peth mandals through /api/routes itself. See the header this emits.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const measured = JSON.parse(readFileSync('/tmp/full-pairs.json', 'utf8'));
const catalogue = JSON.parse(readFileSync('src/content/catalogue.json', 'utf8'));
const at = Object.fromEntries(
  catalogue.ganpatis.map((g) => [g.slug, { lat: g.latitude, lng: g.longitude }])
);

const dirty = Object.entries(measured)
  .filter(([, m]) => m >= 25)
  .sort(([a], [b]) => a.localeCompare(b));

const mutual = new Set(
  dirty.filter(([k]) => { const [a, b] = k.split('>'); return measured[`${b}>${a}`] >= 25; }).map(([k]) => k)
);

const rows = dirty.map(([key, m]) => {
  const [from, to] = key.split('>');
  const A = at[from], B = at[to];
  return `  // ${String(m).padStart(3)} m against${mutual.has(key) ? ' — and the same walk back; needs a road we do not have' : ''}\n` +
    `  { from: '${from}', to: '${to}',\n` +
    `    fromAt: { lat: ${A.lat}, lng: ${A.lng} }, toAt: { lat: ${B.lat}, lng: ${B.lng} },\n` +
    `    againstM: ${m} },`;
});

const header = `import type { LatLng } from '@/lib/geo';

/**
 * How far each walk between two mandals runs against the crowd.
 *
 * The police lanes are for coming, not for going back. Kasba down to
 * Dagdusheth and on past Tulshibaug runs with the crowd; the same stretch
 * walked the other way is the one thing the lanes exist to prevent. Most
 * of the time the router can be sent round — /api/routes bars the
 * offending lane and asks again, leg by leg — and that clears it. Where
 * it cannot, the walk is illegal however it is drawn, and the only thing
 * left that can fix it is the ORDER the mandals are visited in.
 *
 * Which is why this is consulted during ordering rather than after it.
 * Dagdusheth then Bhau Rangari walks ${measured['dagdusheth-halwai-ganpati>bhau-rangari-ganpati'] ?? '?'} m back up Shivaji Road;
 * Bhau Rangari then Dagdusheth is the same two mandals, with the crowd,
 * and is clean. Nothing needs to be dropped from the plan — it needs
 * turning round.
 *
 * ---------------------------------------------------------------------
 * DERIVED DATA. The lanes in diversions.ts are reported from the ground;
 * this is a consequence of them, measured on 2026-09-16 by routing
 * ALL ${Object.keys(measured).length} ordered pairs of the ${new Set(Object.keys(measured).flatMap((k) => k.split('>'))).size} mandals within 1500 m of a
 * lane through /api/routes itself — the whole pipeline, lane graph and
 * per-leg exclusion retries included — and recording what each one still
 * walked against a lane.
 *
 * The sweep being COMPLETE is the point, not an incidental. An earlier
 * version measured a filtered subset, and a pair missing from it could
 * mean either "clean" or "never asked". Pricing against that table moved
 * one plan from 102 m against the crowd to 353 m: the solver dodged a
 * listed pair straight onto an unlisted one that was worse. Here a pair
 * that is absent has been measured and came back clean, so avoiding a
 * listed pair can only move the plan onto something at least as good.
 *
 * Regenerate with scripts/emit-lane-against.mjs whenever diversions.ts
 * changes, because these numbers describe those lanes and nothing else.
 * ---------------------------------------------------------------------
 */
export interface LaneAgainstPair {
  from: string;
  to: string;
  fromAt: LatLng;
  toAt: LatLng;
  /** Metres this walk runs against a lane, after every retry has been tried. */
  againstM: number;
}

/** Only pairs that walk against a lane. Every other measured pair is clean. */
export const LANE_AGAINST_PAIRS: LaneAgainstPair[] = [
`;

writeFileSync('src/content/lane-against.ts', header + rows.join('\n') + '\n];\n');
console.log(`emitted ${rows.length} dirty of ${Object.keys(measured).length} measured (${mutual.size} dirty both ways)`);
