/**
 * Regenerate src/content/lane-leg-metres.ts from a full walk sweep.
 *
 * Input is /tmp/leg-metres.json: every ordered peth pair routed through
 * /api/routes itself, recording how far the legal walk actually is.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const MATERIAL = 1.25;
const measured = JSON.parse(readFileSync('/tmp/leg-metres.json', 'utf8'));

/**
 * A pair that has since been given a way round walks that way round now.
 *
 * The sweep measured what the app drew at the time. Adding a detour chain
 * changes what it draws, so for those pairs the chain's own routed length
 * is the newer and truer number. Where both exist they agree closely —
 * Hutatma Babu Genu to Tulshibaug measured 663 m and its chain 666 m — so
 * this is a correction, not a second opinion.
 */
const detours = JSON.parse(readFileSync('/tmp/detours.json', 'utf8'));
let corrected = 0;
for (const [key, d] of Object.entries(detours)) {
  if (!d.via?.length || d.against >= 25) continue;
  const row = measured[key];
  if (row && d.m > row.m) { row.m = d.m; corrected++; }
}
const catalogue = JSON.parse(readFileSync('src/content/catalogue.json', 'utf8'));
const at = Object.fromEntries(
  catalogue.ganpatis.map((g) => [g.slug, { lat: g.latitude, lng: g.longitude }])
);

const rows = Object.entries(measured)
  .filter(([, v]) => v.straight > 0)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([key, v]) => {
    const [from, to] = key.split('>');
    const A = at[from], B = at[to];
    return `  // x${(v.m / v.straight).toFixed(1)} the straight line\n` +
      `  { from: '${from}', to: '${to}',\n` +
      `    fromAt: { lat: ${A.lat}, lng: ${A.lng} }, toAt: { lat: ${B.lat}, lng: ${B.lng} },\n` +
      `    walkM: ${v.m} },`;
  });

const header = `import type { LatLng } from '@/lib/geo';

/**
 * How far the legal walk between two mandals actually is.
 *
 * The order of a plan is chosen from a cost matrix, and that matrix comes
 * from a routing provider's table. No provider knows the police lanes, so
 * its table answers with the walk it would draw if the lanes were not
 * there — and for the peths that is a different, shorter walk than the one
 * this app will actually draw, because the lanes send people round.
 *
 * Akhil Mandai to Tulshibaug is the case that showed it. The table calls
 * it 283 m, a straight hop north. Tulshibaug can only be entered from
 * Guruji Talim, so the walk this app draws goes out and round and comes
 * down into it: 762 m. Ordering a plan on the 283 m figure puts Tulshibaug
 * wherever a cheap leg would put it, and the visitor walks up to it, turns
 * round for the mandals they passed, and comes up again.
 *
 * So the ordering is told what the walk really costs. Everything else in
 * pedestrian-flow reasons about the lanes from the straight line between
 * two points; this is the distance measured off the route itself.
 *
 * ---------------------------------------------------------------------
 * DERIVED DATA, from the lanes in diversions.ts. All ${Object.keys(measured).length} ordered pairs of
 * the mandals within 1500 m of a lane were routed through /api/routes on
 * 2026-09-16 — the whole pipeline, lane graph, detours and exclusion
 * retries included — and the distance recorded.
 *
 * EVERY measured pair is listed, including the ${Object.values(measured).filter((v) => v.straight > 0 && v.m / v.straight < MATERIAL).length} whose walk is close to
 * their straight line. That is deliberate. An earlier version kept only
 * the pairs that needed correcting, and then a pair's absence meant either
 * "measured, and fine" or "never measured" — so the generalisation that
 * prices the first leg of a plan, which has no row of its own, was also
 * being applied to pairs already known to be fine. Tulshibaug to Jilbya
 * Maruti is a lane the crowd is sent straight down, and it was being
 * charged for a detour its neighbours pay.
 *
 * Now absence means only one thing: nobody measured it, because it starts
 * somewhere no mandal stands — which is to say, where the visitor does.
 *
 * ${corrected} of them are the length of the chain in lane-detours rather than of
 * the sweep, the chain being what this app draws for them now.
 *
 * Regenerate with scripts/emit-lane-leg-metres.mjs whenever the lanes,
 * the detours, or the routing pipeline change — these describe what this
 * app draws, not what the streets are.
 * ---------------------------------------------------------------------
 */
export interface LaneLegMetres {
  from: string;
  to: string;
  fromAt: LatLng;
  toAt: LatLng;
  /** The legal walk, as routed. Always longer than the straight line. */
  walkM: number;
}

export const LANE_LEG_METRES: LaneLegMetres[] = [
`;

writeFileSync('src/content/lane-leg-metres.ts', header + rows.join('\n') + '\n];\n');
console.log(`emitted ${rows.length} of ${Object.keys(measured).length} pairs`);
