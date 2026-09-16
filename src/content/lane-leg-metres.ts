import type { LatLng } from '@/lib/geo';

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
 * DERIVED DATA, from the lanes in diversions.ts. All 756 ordered pairs of
 * the mandals within 1500 m of a lane were routed through /api/routes on
 * 2026-09-16 — the whole pipeline, lane graph, detours and exclusion
 * retries included — and the distance recorded.
 *
 * EVERY measured pair is listed, including the 318 whose walk is close to
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
 * 62 of them are the length of the chain in lane-detours rather than of
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
  // x1.5 the straight line
  { from: 'akhil-mandai-mandal', to: 'balvikas-mandal',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    walkM: 946 },
  // x1.6 the straight line
  { from: 'akhil-mandai-mandal', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.517583, lng: 73.855362 },
    walkM: 1008 },
  // x1.1 the straight line
  { from: 'akhil-mandai-mandal', to: 'chhatrapati-rajaram-mandal',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.512444, lng: 73.847482 },
    walkM: 1016 },
  // x1.1 the straight line
  { from: 'akhil-mandai-mandal', to: 'chimnya-ganpati',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.5111804596016, lng: 73.8521904497267 },
    walkM: 483 },
  // x1.3 the straight line
  { from: 'akhil-mandai-mandal', to: 'chinchechi-talim-ganpati',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.5086, lng: 73.8555 },
    walkM: 467 },
  // x4.1 the straight line
  { from: 'akhil-mandai-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.51514, lng: 73.856379 },
    walkM: 1512 },
  // x1.2 the straight line
  { from: 'akhil-mandai-mandal', to: 'garud-ganpati-mandal',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.5137, lng: 73.8456 },
    walkM: 1381 },
  // x1.8 the straight line
  { from: 'akhil-mandai-mandal', to: 'guruji-talim',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.514997, lng: 73.854992 },
    walkM: 679 },
  // x1.0 the straight line
  { from: 'akhil-mandai-mandal', to: 'hatti-ganpati-mandal',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.511223, lng: 73.845858 },
    walkM: 1080 },
  // x1.4 the straight line
  { from: 'akhil-mandai-mandal', to: 'hira-bagh-mandal',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.5042217511876, lng: 73.8557645094566 },
    walkM: 1176 },
  // x1.7 the straight line
  { from: 'akhil-mandai-mandal', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    walkM: 892 },
  // x7.2 the straight line
  { from: 'akhil-mandai-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.51389, lng: 73.856342 },
    walkM: 1647 },
  // x1.4 the straight line
  { from: 'akhil-mandai-mandal', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.513319, lng: 73.854938 },
    walkM: 298 },
  // x1.7 the straight line
  { from: 'akhil-mandai-mandal', to: 'kasba-ganpati',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.519055, lng: 73.857142 },
    walkM: 1341 },
  // x1.4 the straight line
  { from: 'akhil-mandai-mandal', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.515811, lng: 73.849008 },
    walkM: 1240 },
  // x1.3 the straight line
  { from: 'akhil-mandai-mandal', to: 'mati-ganpati',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.5159, lng: 73.8468 },
    walkM: 1394 },
  // x1.4 the straight line
  { from: 'akhil-mandai-mandal', to: 'natu-baug-mandal',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.510703, lng: 73.853821 },
    walkM: 374 },
  // x1.2 the straight line
  { from: 'akhil-mandai-mandal', to: 'navjavan-mandal',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.512919576416, lng: 73.8487282111353 },
    walkM: 925 },
  // x1.0 the straight line
  { from: 'akhil-mandai-mandal', to: 'nimbalkar-talim-mandal',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.5119, lng: 73.8522 },
    walkM: 415 },
  // x1.4 the straight line
  { from: 'akhil-mandai-mandal', to: 'perugate-bhave-mandal',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.509777, lng: 73.84944 },
    walkM: 1004 },
  // x1.7 the straight line
  { from: 'akhil-mandai-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.5188, lng: 73.8571 },
    walkM: 1311 },
  // x1.2 the straight line
  { from: 'akhil-mandai-mandal', to: 'sarasbaug-ganpati',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.500881, lng: 73.85295 },
    walkM: 1569 },
  // x1.4 the straight line
  { from: 'akhil-mandai-mandal', to: 'seva-mitra-mandal',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.5086563388099, lng: 73.8575649915299 },
    walkM: 546 },
  // x1.3 the straight line
  { from: 'akhil-mandai-mandal', to: 'shanipar-mandal',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.512619, lng: 73.852601 },
    walkM: 509 },
  // x1.6 the straight line
  { from: 'akhil-mandai-mandal', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.51662, lng: 73.854894 },
    walkM: 873 },
  // x1.4 the straight line
  { from: 'akhil-mandai-mandal', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.5217, lng: 73.8619 },
    walkM: 1815 },
  // x2.7 the straight line
  { from: 'akhil-mandai-mandal', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.514268, lng: 73.855306 },
    walkM: 769 },
  // x1.2 the straight line
  { from: 'balvikas-mandal', to: 'akhil-mandai-mandal',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.511852, lng: 73.856135 },
    walkM: 758 },
  // x1.9 the straight line
  { from: 'balvikas-mandal', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.517583, lng: 73.855362 },
    walkM: 70 },
  // x1.3 the straight line
  { from: 'balvikas-mandal', to: 'chhatrapati-rajaram-mandal',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.512444, lng: 73.847482 },
    walkM: 1259 },
  // x1.2 the straight line
  { from: 'balvikas-mandal', to: 'chimnya-ganpati',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.5111804596016, lng: 73.8521904497267 },
    walkM: 894 },
  // x1.0 the straight line
  { from: 'balvikas-mandal', to: 'chinchechi-talim-ganpati',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.5086, lng: 73.8555 },
    walkM: 1019 },
  // x1.4 the straight line
  { from: 'balvikas-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.51514, lng: 73.856379 },
    walkM: 408 },
  // x1.2 the straight line
  { from: 'balvikas-mandal', to: 'garud-ganpati-mandal',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.5137, lng: 73.8456 },
    walkM: 1263 },
  // x1.0 the straight line
  { from: 'balvikas-mandal', to: 'guruji-talim',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.514997, lng: 73.854992 },
    walkM: 275 },
  // x1.2 the straight line
  { from: 'balvikas-mandal', to: 'hatti-ganpati-mandal',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.511223, lng: 73.845858 },
    walkM: 1483 },
  // x1.2 the straight line
  { from: 'balvikas-mandal', to: 'hira-bagh-mandal',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.5042217511876, lng: 73.8557645094566 },
    walkM: 1708 },
  // x1.4 the straight line
  { from: 'balvikas-mandal', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    walkM: 673 },
  // x1.3 the straight line
  { from: 'balvikas-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.51389, lng: 73.856342 },
    walkM: 543 },
  // x1.1 the straight line
  { from: 'balvikas-mandal', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.513319, lng: 73.854938 },
    walkM: 498 },
  // x5.3 the straight line
  { from: 'balvikas-mandal', to: 'kasba-ganpati',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.519055, lng: 73.857142 },
    walkM: 1521 },
  // x1.1 the straight line
  { from: 'balvikas-mandal', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.515811, lng: 73.849008 },
    walkM: 710 },
  // x1.1 the straight line
  { from: 'balvikas-mandal', to: 'mati-ganpati',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.5159, lng: 73.8468 },
    walkM: 942 },
  // x1.1 the straight line
  { from: 'balvikas-mandal', to: 'natu-baug-mandal',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.510703, lng: 73.853821 },
    walkM: 829 },
  // x1.3 the straight line
  { from: 'balvikas-mandal', to: 'navjavan-mandal',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.512919576416, lng: 73.8487282111353 },
    walkM: 1089 },
  // x1.2 the straight line
  { from: 'balvikas-mandal', to: 'nimbalkar-talim-mandal',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.5119, lng: 73.8522 },
    walkM: 826 },
  // x1.4 the straight line
  { from: 'balvikas-mandal', to: 'perugate-bhave-mandal',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.509777, lng: 73.84944 },
    walkM: 1433 },
  // x1.7 the straight line
  { from: 'balvikas-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.5188, lng: 73.8571 },
    walkM: 447 },
  // x1.1 the straight line
  { from: 'balvikas-mandal', to: 'sarasbaug-ganpati',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.500881, lng: 73.85295 },
    walkM: 2023 },
  // x1.2 the straight line
  { from: 'balvikas-mandal', to: 'seva-mitra-mandal',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.5086563388099, lng: 73.8575649915299 },
    walkM: 1195 },
  // x1.2 the straight line
  { from: 'balvikas-mandal', to: 'shanipar-mandal',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.512619, lng: 73.852601 },
    walkM: 692 },
  // x1.0 the straight line
  { from: 'balvikas-mandal', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.51662, lng: 73.854894 },
    walkM: 96 },
  // x2.3 the straight line
  { from: 'balvikas-mandal', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.5217, lng: 73.8619 },
    walkM: 1989 },
  // x1.0 the straight line
  { from: 'balvikas-mandal', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.514268, lng: 73.855306 },
    walkM: 360 },
  // x1.2 the straight line
  { from: 'bhau-rangari-ganpati', to: 'akhil-mandai-mandal',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.511852, lng: 73.856135 },
    walkM: 754 },
  // x1.9 the straight line
  { from: 'bhau-rangari-ganpati', to: 'balvikas-mandal',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    walkM: 70 },
  // x1.3 the straight line
  { from: 'bhau-rangari-ganpati', to: 'chhatrapati-rajaram-mandal',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.512444, lng: 73.847482 },
    walkM: 1329 },
  // x1.2 the straight line
  { from: 'bhau-rangari-ganpati', to: 'chimnya-ganpati',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.5111804596016, lng: 73.8521904497267 },
    walkM: 964 },
  // x1.1 the straight line
  { from: 'bhau-rangari-ganpati', to: 'chinchechi-talim-ganpati',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.5086, lng: 73.8555 },
    walkM: 1089 },
  // x1.2 the straight line
  { from: 'bhau-rangari-ganpati', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.51514, lng: 73.856379 },
    walkM: 353 },
  // x1.2 the straight line
  { from: 'bhau-rangari-ganpati', to: 'garud-ganpati-mandal',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.5137, lng: 73.8456 },
    walkM: 1333 },
  // x1.2 the straight line
  { from: 'bhau-rangari-ganpati', to: 'guruji-talim',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.514997, lng: 73.854992 },
    walkM: 345 },
  // x1.3 the straight line
  { from: 'bhau-rangari-ganpati', to: 'hatti-ganpati-mandal',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.511223, lng: 73.845858 },
    walkM: 1553 },
  // x1.2 the straight line
  { from: 'bhau-rangari-ganpati', to: 'hira-bagh-mandal',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.5042217511876, lng: 73.8557645094566 },
    walkM: 1778 },
  // x1.3 the straight line
  { from: 'bhau-rangari-ganpati', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    walkM: 603 },
  // x1.1 the straight line
  { from: 'bhau-rangari-ganpati', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.51389, lng: 73.856342 },
    walkM: 483 },
  // x1.2 the straight line
  { from: 'bhau-rangari-ganpati', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.513319, lng: 73.854938 },
    walkM: 568 },
  // x6.4 the straight line
  { from: 'bhau-rangari-ganpati', to: 'kasba-ganpati',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.519055, lng: 73.857142 },
    walkM: 1592 },
  // x1.1 the straight line
  { from: 'bhau-rangari-ganpati', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.515811, lng: 73.849008 },
    walkM: 780 },
  // x1.1 the straight line
  { from: 'bhau-rangari-ganpati', to: 'mati-ganpati',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.5159, lng: 73.8468 },
    walkM: 1012 },
  // x1.1 the straight line
  { from: 'bhau-rangari-ganpati', to: 'natu-baug-mandal',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.510703, lng: 73.853821 },
    walkM: 899 },
  // x1.3 the straight line
  { from: 'bhau-rangari-ganpati', to: 'navjavan-mandal',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.512919576416, lng: 73.8487282111353 },
    walkM: 1160 },
  // x1.3 the straight line
  { from: 'bhau-rangari-ganpati', to: 'nimbalkar-talim-mandal',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.5119, lng: 73.8522 },
    walkM: 896 },
  // x1.4 the straight line
  { from: 'bhau-rangari-ganpati', to: 'perugate-bhave-mandal',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.509777, lng: 73.84944 },
    walkM: 1503 },
  // x1.9 the straight line
  { from: 'bhau-rangari-ganpati', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.5188, lng: 73.8571 },
    walkM: 438 },
  // x1.1 the straight line
  { from: 'bhau-rangari-ganpati', to: 'sarasbaug-ganpati',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.500881, lng: 73.85295 },
    walkM: 2093 },
  // x1.1 the straight line
  { from: 'bhau-rangari-ganpati', to: 'seva-mitra-mandal',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.5086563388099, lng: 73.8575649915299 },
    walkM: 1141 },
  // x1.2 the straight line
  { from: 'bhau-rangari-ganpati', to: 'shanipar-mandal',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.512619, lng: 73.852601 },
    walkM: 763 },
  // x1.4 the straight line
  { from: 'bhau-rangari-ganpati', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.51662, lng: 73.854894 },
    walkM: 166 },
  // x2.4 the straight line
  { from: 'bhau-rangari-ganpati', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.5217, lng: 73.8619 },
    walkM: 1980 },
  // x1.2 the straight line
  { from: 'bhau-rangari-ganpati', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.514268, lng: 73.855306 },
    walkM: 431 },
  // x1.1 the straight line
  { from: 'chhatrapati-rajaram-mandal', to: 'akhil-mandai-mandal',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.511852, lng: 73.856135 },
    walkM: 1016 },
  // x1.3 the straight line
  { from: 'chhatrapati-rajaram-mandal', to: 'balvikas-mandal',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    walkM: 1273 },
  // x1.3 the straight line
  { from: 'chhatrapati-rajaram-mandal', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.517583, lng: 73.855362 },
    walkM: 1343 },
  // x1.3 the straight line
  { from: 'chhatrapati-rajaram-mandal', to: 'chimnya-ganpati',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.5111804596016, lng: 73.8521904497267 },
    walkM: 665 },
  // x1.3 the straight line
  { from: 'chhatrapati-rajaram-mandal', to: 'chinchechi-talim-ganpati',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.5086, lng: 73.8555 },
    walkM: 1245 },
  // x1.6 the straight line
  { from: 'chhatrapati-rajaram-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.51514, lng: 73.856379 },
    walkM: 1580 },
  // x1.5 the straight line
  { from: 'chhatrapati-rajaram-mandal', to: 'garud-ganpati-mandal',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.5137, lng: 73.8456 },
    walkM: 373 },
  // x1.2 the straight line
  { from: 'chhatrapati-rajaram-mandal', to: 'guruji-talim',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.514997, lng: 73.854992 },
    walkM: 998 },
  // x1.3 the straight line
  { from: 'chhatrapati-rajaram-mandal', to: 'hatti-ganpati-mandal',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.511223, lng: 73.845858 },
    walkM: 283 },
  // x1.1 the straight line
  { from: 'chhatrapati-rajaram-mandal', to: 'hira-bagh-mandal',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.5042217511876, lng: 73.8557645094566 },
    walkM: 1443 },
  // x1.6 the straight line
  { from: 'chhatrapati-rajaram-mandal', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    walkM: 2063 },
  // x1.3 the straight line
  { from: 'chhatrapati-rajaram-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.51389, lng: 73.856342 },
    walkM: 1266 },
  // x1.1 the straight line
  { from: 'chhatrapati-rajaram-mandal', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.513319, lng: 73.854938 },
    walkM: 850 },
  // x1.5 the straight line
  { from: 'chhatrapati-rajaram-mandal', to: 'kasba-ganpati',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.519055, lng: 73.857142 },
    walkM: 1927 },
  // x1.5 the straight line
  { from: 'chhatrapati-rajaram-mandal', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.515811, lng: 73.849008 },
    walkM: 621 },
  // x1.0 the straight line
  { from: 'chhatrapati-rajaram-mandal', to: 'mati-ganpati',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.5159, lng: 73.8468 },
    walkM: 389 },
  // x1.3 the straight line
  { from: 'chhatrapati-rajaram-mandal', to: 'natu-baug-mandal',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.510703, lng: 73.853821 },
    walkM: 895 },
  // x1.2 the straight line
  { from: 'chhatrapati-rajaram-mandal', to: 'navjavan-mandal',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.512919576416, lng: 73.8487282111353 },
    walkM: 166 },
  // x1.2 the straight line
  { from: 'chhatrapati-rajaram-mandal', to: 'nimbalkar-talim-mandal',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.5119, lng: 73.8522 },
    walkM: 600 },
  // x1.3 the straight line
  { from: 'chhatrapati-rajaram-mandal', to: 'perugate-bhave-mandal',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.509777, lng: 73.84944 },
    walkM: 475 },
  // x1.3 the straight line
  { from: 'chhatrapati-rajaram-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.5188, lng: 73.8571 },
    walkM: 1629 },
  // x1.2 the straight line
  { from: 'chhatrapati-rajaram-mandal', to: 'sarasbaug-ganpati',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.500881, lng: 73.85295 },
    walkM: 1717 },
  // x1.3 the straight line
  { from: 'chhatrapati-rajaram-mandal', to: 'seva-mitra-mandal',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.5086563388099, lng: 73.8575649915299 },
    walkM: 1495 },
  // x1.1 the straight line
  { from: 'chhatrapati-rajaram-mandal', to: 'shanipar-mandal',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.512619, lng: 73.852601 },
    walkM: 583 },
  // x1.3 the straight line
  { from: 'chhatrapati-rajaram-mandal', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.51662, lng: 73.854894 },
    walkM: 1176 },
  // x1.4 the straight line
  { from: 'chhatrapati-rajaram-mandal', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.5217, lng: 73.8619 },
    walkM: 2485 },
  // x1.3 the straight line
  { from: 'chhatrapati-rajaram-mandal', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.514268, lng: 73.855306 },
    walkM: 1083 },
  // x1.1 the straight line
  { from: 'chimnya-ganpati', to: 'akhil-mandai-mandal',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.511852, lng: 73.856135 },
    walkM: 483 },
  // x1.2 the straight line
  { from: 'chimnya-ganpati', to: 'balvikas-mandal',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    walkM: 894 },
  // x1.2 the straight line
  { from: 'chimnya-ganpati', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.517583, lng: 73.855362 },
    walkM: 964 },
  // x1.3 the straight line
  { from: 'chimnya-ganpati', to: 'chhatrapati-rajaram-mandal',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.512444, lng: 73.847482 },
    walkM: 665 },
  // x1.3 the straight line
  { from: 'chimnya-ganpati', to: 'chinchechi-talim-ganpati',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.5086, lng: 73.8555 },
    walkM: 579 },
  // x1.9 the straight line
  { from: 'chimnya-ganpati', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.51514, lng: 73.856379 },
    walkM: 1177 },
  // x1.4 the straight line
  { from: 'chimnya-ganpati', to: 'garud-ganpati-mandal',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.5137, lng: 73.8456 },
    walkM: 1030 },
  // x1.2 the straight line
  { from: 'chimnya-ganpati', to: 'guruji-talim',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.514997, lng: 73.854992 },
    walkM: 632 },
  // x1.1 the straight line
  { from: 'chimnya-ganpati', to: 'hatti-ganpati-mandal',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.511223, lng: 73.845858 },
    walkM: 730 },
  // x1.2 the straight line
  { from: 'chimnya-ganpati', to: 'hira-bagh-mandal',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.5042217511876, lng: 73.8557645094566 },
    walkM: 1023 },
  // x1.4 the straight line
  { from: 'chimnya-ganpati', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    walkM: 1236 },
  // x1.7 the straight line
  { from: 'chimnya-ganpati', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.51389, lng: 73.856342 },
    walkM: 902 },
  // x1.2 the straight line
  { from: 'chimnya-ganpati', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.513319, lng: 73.854938 },
    walkM: 468 },
  // x1.5 the straight line
  { from: 'chimnya-ganpati', to: 'kasba-ganpati',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.519055, lng: 73.857142 },
    walkM: 1545 },
  // x1.4 the straight line
  { from: 'chimnya-ganpati', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.515811, lng: 73.849008 },
    walkM: 876 },
  // x1.3 the straight line
  { from: 'chimnya-ganpati', to: 'mati-ganpati',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.5159, lng: 73.8468 },
    walkM: 1044 },
  // x1.3 the straight line
  { from: 'chimnya-ganpati', to: 'natu-baug-mandal',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.510703, lng: 73.853821 },
    walkM: 229 },
  // x1.4 the straight line
  { from: 'chimnya-ganpati', to: 'navjavan-mandal',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.512919576416, lng: 73.8487282111353 },
    walkM: 575 },
  // x1.0 the straight line
  { from: 'chimnya-ganpati', to: 'nimbalkar-talim-mandal',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.5119, lng: 73.8522 },
    walkM: 78 },
  // x1.6 the straight line
  { from: 'chimnya-ganpati', to: 'perugate-bhave-mandal',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.509777, lng: 73.84944 },
    walkM: 521 },
  // x1.3 the straight line
  { from: 'chimnya-ganpati', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.5188, lng: 73.8571 },
    walkM: 1264 },
  // x1.2 the straight line
  { from: 'chimnya-ganpati', to: 'sarasbaug-ganpati',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.500881, lng: 73.85295 },
    walkM: 1338 },
  // x1.3 the straight line
  { from: 'chimnya-ganpati', to: 'seva-mitra-mandal',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.5086563388099, lng: 73.8575649915299 },
    walkM: 833 },
  // x1.2 the straight line
  { from: 'chimnya-ganpati', to: 'shanipar-mandal',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.512619, lng: 73.852601 },
    walkM: 201 },
  // x1.2 the straight line
  { from: 'chimnya-ganpati', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.51662, lng: 73.854894 },
    walkM: 811 },
  // x1.4 the straight line
  { from: 'chimnya-ganpati', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.5217, lng: 73.8619 },
    walkM: 2103 },
  // x1.6 the straight line
  { from: 'chimnya-ganpati', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.514268, lng: 73.855306 },
    walkM: 782 },
  // x1.3 the straight line
  { from: 'chinchechi-talim-ganpati', to: 'akhil-mandai-mandal',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.511852, lng: 73.856135 },
    walkM: 467 },
  // x1.2 the straight line
  { from: 'chinchechi-talim-ganpati', to: 'balvikas-mandal',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    walkM: 1204 },
  // x1.3 the straight line
  { from: 'chinchechi-talim-ganpati', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.517583, lng: 73.855362 },
    walkM: 1268 },
  // x1.3 the straight line
  { from: 'chinchechi-talim-ganpati', to: 'chhatrapati-rajaram-mandal',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.512444, lng: 73.847482 },
    walkM: 1243 },
  // x1.3 the straight line
  { from: 'chinchechi-talim-ganpati', to: 'chimnya-ganpati',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.5111804596016, lng: 73.8521904497267 },
    walkM: 579 },
  // x2.0 the straight line
  { from: 'chinchechi-talim-ganpati', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.51514, lng: 73.856379 },
    walkM: 1481 },
  // x1.3 the straight line
  { from: 'chinchechi-talim-ganpati', to: 'garud-ganpati-mandal',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.5137, lng: 73.8456 },
    walkM: 1511 },
  // x1.3 the straight line
  { from: 'chinchechi-talim-ganpati', to: 'guruji-talim',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.514997, lng: 73.854992 },
    walkM: 937 },
  // x1.1 the straight line
  { from: 'chinchechi-talim-ganpati', to: 'hatti-ganpati-mandal',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.511223, lng: 73.845858 },
    walkM: 1206 },
  // x1.5 the straight line
  { from: 'chinchechi-talim-ganpati', to: 'hira-bagh-mandal',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.5042217511876, lng: 73.8557645094566 },
    walkM: 709 },
  // x1.3 the straight line
  { from: 'chinchechi-talim-ganpati', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    walkM: 1148 },
  // x2.7 the straight line
  { from: 'chinchechi-talim-ganpati', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.51389, lng: 73.856342 },
    walkM: 1626 },
  // x1.1 the straight line
  { from: 'chinchechi-talim-ganpati', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.513319, lng: 73.854938 },
    walkM: 559 },
  // x1.5 the straight line
  { from: 'chinchechi-talim-ganpati', to: 'kasba-ganpati',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.519055, lng: 73.857142 },
    walkM: 1769 },
  // x1.4 the straight line
  { from: 'chinchechi-talim-ganpati', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.515811, lng: 73.849008 },
    walkM: 1453 },
  // x1.3 the straight line
  { from: 'chinchechi-talim-ganpati', to: 'mati-ganpati',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.5159, lng: 73.8468 },
    walkM: 1622 },
  // x1.4 the straight line
  { from: 'chinchechi-talim-ganpati', to: 'natu-baug-mandal',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.510703, lng: 73.853821 },
    walkM: 402 },
  // x1.3 the straight line
  { from: 'chinchechi-talim-ganpati', to: 'navjavan-mandal',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.512919576416, lng: 73.8487282111353 },
    walkM: 1152 },
  // x1.3 the straight line
  { from: 'chinchechi-talim-ganpati', to: 'nimbalkar-talim-mandal',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.5119, lng: 73.8522 },
    walkM: 657 },
  // x1.4 the straight line
  { from: 'chinchechi-talim-ganpati', to: 'perugate-bhave-mandal',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.509777, lng: 73.84944 },
    walkM: 939 },
  // x1.5 the straight line
  { from: 'chinchechi-talim-ganpati', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.5188, lng: 73.8571 },
    walkM: 1739 },
  // x1.3 the straight line
  { from: 'chinchechi-talim-ganpati', to: 'sarasbaug-ganpati',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.500881, lng: 73.85295 },
    walkM: 1162 },
  // x1.2 the straight line
  { from: 'chinchechi-talim-ganpati', to: 'seva-mitra-mandal',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.5086563388099, lng: 73.8575649915299 },
    walkM: 259 },
  // x1.4 the straight line
  { from: 'chinchechi-talim-ganpati', to: 'shanipar-mandal',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.512619, lng: 73.852601 },
    walkM: 771 },
  // x1.3 the straight line
  { from: 'chinchechi-talim-ganpati', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.51662, lng: 73.854894 },
    walkM: 1134 },
  // x1.5 the straight line
  { from: 'chinchechi-talim-ganpati', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.5217, lng: 73.8619 },
    walkM: 2335 },
  // x1.6 the straight line
  { from: 'chinchechi-talim-ganpati', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.514268, lng: 73.855306 },
    walkM: 1026 },
  // x1.2 the straight line
  { from: 'dagdusheth-halwai-ganpati', to: 'akhil-mandai-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.511852, lng: 73.856135 },
    walkM: 437 },
  // x3.8 the straight line
  { from: 'dagdusheth-halwai-ganpati', to: 'balvikas-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    walkM: 1108 },
  // x3.6 the straight line
  { from: 'dagdusheth-halwai-ganpati', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.517583, lng: 73.855362 },
    walkM: 1046 },
  // x1.2 the straight line
  { from: 'dagdusheth-halwai-ganpati', to: 'chhatrapati-rajaram-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.512444, lng: 73.847482 },
    walkM: 1199 },
  // x1.4 the straight line
  { from: 'dagdusheth-halwai-ganpati', to: 'chimnya-ganpati',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.5111804596016, lng: 73.8521904497267 },
    walkM: 866 },
  // x1.3 the straight line
  { from: 'dagdusheth-halwai-ganpati', to: 'chinchechi-talim-ganpati',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.5086, lng: 73.8555 },
    walkM: 939 },
  // x1.1 the straight line
  { from: 'dagdusheth-halwai-ganpati', to: 'garud-ganpati-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.5137, lng: 73.8456 },
    walkM: 1308 },
  // x6.4 the straight line
  { from: 'dagdusheth-halwai-ganpati', to: 'guruji-talim',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.514997, lng: 73.854992 },
    walkM: 944 },
  // x1.2 the straight line
  { from: 'dagdusheth-halwai-ganpati', to: 'hatti-ganpati-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.511223, lng: 73.845858 },
    walkM: 1445 },
  // x1.2 the straight line
  { from: 'dagdusheth-halwai-ganpati', to: 'hira-bagh-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.5042217511876, lng: 73.8557645094566 },
    walkM: 1468 },
  // x1.3 the straight line
  { from: 'dagdusheth-halwai-ganpati', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    walkM: 392 },
  // x1.0 the straight line
  { from: 'dagdusheth-halwai-ganpati', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.51389, lng: 73.856342 },
    walkM: 142 },
  // x2.4 the straight line
  { from: 'dagdusheth-halwai-ganpati', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.513319, lng: 73.854938 },
    walkM: 606 },
  // x2.3 the straight line
  { from: 'dagdusheth-halwai-ganpati', to: 'kasba-ganpati',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.519055, lng: 73.857142 },
    walkM: 1037 },
  // x1.7 the straight line
  { from: 'dagdusheth-halwai-ganpati', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.515811, lng: 73.849008 },
    walkM: 1305 },
  // x1.3 the straight line
  { from: 'dagdusheth-halwai-ganpati', to: 'mati-ganpati',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.5159, lng: 73.8468 },
    walkM: 1340 },
  // x1.3 the straight line
  { from: 'dagdusheth-halwai-ganpati', to: 'natu-baug-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.510703, lng: 73.853821 },
    walkM: 757 },
  // x1.3 the straight line
  { from: 'dagdusheth-halwai-ganpati', to: 'navjavan-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.512919576416, lng: 73.8487282111353 },
    walkM: 1110 },
  // x1.3 the straight line
  { from: 'dagdusheth-halwai-ganpati', to: 'nimbalkar-talim-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.5119, lng: 73.8522 },
    walkM: 755 },
  // x1.4 the straight line
  { from: 'dagdusheth-halwai-ganpati', to: 'perugate-bhave-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.509777, lng: 73.84944 },
    walkM: 1366 },
  // x2.4 the straight line
  { from: 'dagdusheth-halwai-ganpati', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.5188, lng: 73.8571 },
    walkM: 1004 },
  // x1.2 the straight line
  { from: 'dagdusheth-halwai-ganpati', to: 'sarasbaug-ganpati',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.500881, lng: 73.85295 },
    walkM: 1985 },
  // x1.1 the straight line
  { from: 'dagdusheth-halwai-ganpati', to: 'seva-mitra-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.5086563388099, lng: 73.8575649915299 },
    walkM: 787 },
  // x1.3 the straight line
  { from: 'dagdusheth-halwai-ganpati', to: 'shanipar-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.512619, lng: 73.852601 },
    walkM: 620 },
  // x4.1 the straight line
  { from: 'dagdusheth-halwai-ganpati', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.51662, lng: 73.854894 },
    walkM: 922 },
  // x1.4 the straight line
  { from: 'dagdusheth-halwai-ganpati', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.5217, lng: 73.8619 },
    walkM: 1340 },
  // x6.9 the straight line
  { from: 'dagdusheth-halwai-ganpati', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.514268, lng: 73.855306 },
    walkM: 1034 },
  // x1.2 the straight line
  { from: 'garud-ganpati-mandal', to: 'akhil-mandai-mandal',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.511852, lng: 73.856135 },
    walkM: 1385 },
  // x1.2 the straight line
  { from: 'garud-ganpati-mandal', to: 'balvikas-mandal',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    walkM: 1263 },
  // x1.2 the straight line
  { from: 'garud-ganpati-mandal', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.517583, lng: 73.855362 },
    walkM: 1333 },
  // x1.5 the straight line
  { from: 'garud-ganpati-mandal', to: 'chhatrapati-rajaram-mandal',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.512444, lng: 73.847482 },
    walkM: 373 },
  // x1.4 the straight line
  { from: 'garud-ganpati-mandal', to: 'chimnya-ganpati',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.5111804596016, lng: 73.8521904497267 },
    walkM: 1034 },
  // x1.3 the straight line
  { from: 'garud-ganpati-mandal', to: 'chinchechi-talim-ganpati',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.5086, lng: 73.8555 },
    walkM: 1511 },
  // x1.3 the straight line
  { from: 'garud-ganpati-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.51514, lng: 73.856379 },
    walkM: 1521 },
  // x1.1 the straight line
  { from: 'garud-ganpati-mandal', to: 'guruji-talim',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.514997, lng: 73.854992 },
    walkM: 1084 },
  // x1.1 the straight line
  { from: 'garud-ganpati-mandal', to: 'hatti-ganpati-mandal',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.511223, lng: 73.845858 },
    walkM: 304 },
  // x1.1 the straight line
  { from: 'garud-ganpati-mandal', to: 'hira-bagh-mandal',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.5042217511876, lng: 73.8557645094566 },
    walkM: 1653 },
  // x1.2 the straight line
  { from: 'garud-ganpati-mandal', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    walkM: 1783 },
  // x1.5 the straight line
  { from: 'garud-ganpati-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.51389, lng: 73.856342 },
    walkM: 1688 },
  // x1.1 the straight line
  { from: 'garud-ganpati-mandal', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.513319, lng: 73.854938 },
    walkM: 1130 },
  // x1.6 the straight line
  { from: 'garud-ganpati-mandal', to: 'kasba-ganpati',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.519055, lng: 73.857142 },
    walkM: 2207 },
  // x1.3 the straight line
  { from: 'garud-ganpati-mandal', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.515811, lng: 73.849008 },
    walkM: 562 },
  // x1.2 the straight line
  { from: 'garud-ganpati-mandal', to: 'mati-ganpati',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.5159, lng: 73.8468 },
    walkM: 330 },
  // x1.4 the straight line
  { from: 'garud-ganpati-mandal', to: 'natu-baug-mandal',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.510703, lng: 73.853821 },
    walkM: 1267 },
  // x1.3 the straight line
  { from: 'garud-ganpati-mandal', to: 'navjavan-mandal',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.512919576416, lng: 73.8487282111353 },
    walkM: 457 },
  // x1.3 the straight line
  { from: 'garud-ganpati-mandal', to: 'nimbalkar-talim-mandal',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.5119, lng: 73.8522 },
    walkM: 969 },
  // x1.4 the straight line
  { from: 'garud-ganpati-mandal', to: 'perugate-bhave-mandal',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.509777, lng: 73.84944 },
    walkM: 812 },
  // x1.2 the straight line
  { from: 'garud-ganpati-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.5188, lng: 73.8571 },
    walkM: 1635 },
  // x1.2 the straight line
  { from: 'garud-ganpati-mandal', to: 'sarasbaug-ganpati',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.500881, lng: 73.85295 },
    walkM: 1927 },
  // x1.2 the straight line
  { from: 'garud-ganpati-mandal', to: 'seva-mitra-mandal',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.5086563388099, lng: 73.8575649915299 },
    walkM: 1705 },
  // x1.3 the straight line
  { from: 'garud-ganpati-mandal', to: 'shanipar-mandal',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.512619, lng: 73.852601 },
    walkM: 960 },
  // x1.2 the straight line
  { from: 'garud-ganpati-mandal', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.51662, lng: 73.854894 },
    walkM: 1199 },
  // x1.4 the straight line
  { from: 'garud-ganpati-mandal', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.5217, lng: 73.8619 },
    walkM: 2765 },
  // x1.4 the straight line
  { from: 'garud-ganpati-mandal', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.514268, lng: 73.855306 },
    walkM: 1471 },
  // x1.3 the straight line
  { from: 'guruji-talim', to: 'akhil-mandai-mandal',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.511852, lng: 73.856135 },
    walkM: 483 },
  // x1.0 the straight line
  { from: 'guruji-talim', to: 'balvikas-mandal',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    walkM: 275 },
  // x1.2 the straight line
  { from: 'guruji-talim', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.517583, lng: 73.855362 },
    walkM: 345 },
  // x1.2 the straight line
  { from: 'guruji-talim', to: 'chhatrapati-rajaram-mandal',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.512444, lng: 73.847482 },
    walkM: 998 },
  // x1.2 the straight line
  { from: 'guruji-talim', to: 'chimnya-ganpati',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.5111804596016, lng: 73.8521904497267 },
    walkM: 633 },
  // x1.0 the straight line
  { from: 'guruji-talim', to: 'chinchechi-talim-ganpati',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.5086, lng: 73.8555 },
    walkM: 744 },
  // x1.4 the straight line
  { from: 'guruji-talim', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.51514, lng: 73.856379 },
    walkM: 202 },
  // x1.1 the straight line
  { from: 'guruji-talim', to: 'garud-ganpati-mandal',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.5137, lng: 73.8456 },
    walkM: 1084 },
  // x1.2 the straight line
  { from: 'guruji-talim', to: 'hatti-ganpati-mandal',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.511223, lng: 73.845858 },
    walkM: 1222 },
  // x1.2 the straight line
  { from: 'guruji-talim', to: 'hira-bagh-mandal',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.5042217511876, lng: 73.8557645094566 },
    walkM: 1447 },
  // x1.1 the straight line
  { from: 'guruji-talim', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    walkM: 505 },
  // x1.3 the straight line
  { from: 'guruji-talim', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.51389, lng: 73.856342 },
    walkM: 244 },
  // x1.1 the straight line
  { from: 'guruji-talim', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.513319, lng: 73.854938 },
    walkM: 214 },
  // x2.5 the straight line
  { from: 'guruji-talim', to: 'kasba-ganpati',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.519055, lng: 73.857142 },
    walkM: 1246 },
  // x1.3 the straight line
  { from: 'guruji-talim', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.515811, lng: 73.849008 },
    walkM: 825 },
  // x1.2 the straight line
  { from: 'guruji-talim', to: 'mati-ganpati',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.5159, lng: 73.8468 },
    walkM: 1033 },
  // x1.2 the straight line
  { from: 'guruji-talim', to: 'natu-baug-mandal',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.510703, lng: 73.853821 },
    walkM: 568 },
  // x1.2 the straight line
  { from: 'guruji-talim', to: 'navjavan-mandal',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.512919576416, lng: 73.8487282111353 },
    walkM: 828 },
  // x1.2 the straight line
  { from: 'guruji-talim', to: 'nimbalkar-talim-mandal',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.5119, lng: 73.8522 },
    walkM: 565 },
  // x1.4 the straight line
  { from: 'guruji-talim', to: 'perugate-bhave-mandal',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.509777, lng: 73.84944 },
    walkM: 1172 },
  // x1.5 the straight line
  { from: 'guruji-talim', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.5188, lng: 73.8571 },
    walkM: 722 },
  // x1.1 the straight line
  { from: 'guruji-talim', to: 'sarasbaug-ganpati',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.500881, lng: 73.85295 },
    walkM: 1762 },
  // x1.3 the straight line
  { from: 'guruji-talim', to: 'seva-mitra-mandal',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.5086563388099, lng: 73.8575649915299 },
    walkM: 1010 },
  // x1.2 the straight line
  { from: 'guruji-talim', to: 'shanipar-mandal',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.512619, lng: 73.852601 },
    walkM: 431 },
  // x1.0 the straight line
  { from: 'guruji-talim', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.51662, lng: 73.854894 },
    walkM: 178 },
  // x1.7 the straight line
  { from: 'guruji-talim', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.5217, lng: 73.8619 },
    walkM: 1805 },
  // x1.3 the straight line
  { from: 'guruji-talim', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.514268, lng: 73.855306 },
    walkM: 113 },
  // x1.0 the straight line
  { from: 'hatti-ganpati-mandal', to: 'akhil-mandai-mandal',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.511852, lng: 73.856135 },
    walkM: 1080 },
  // x1.2 the straight line
  { from: 'hatti-ganpati-mandal', to: 'balvikas-mandal',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    walkM: 1483 },
  // x1.3 the straight line
  { from: 'hatti-ganpati-mandal', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.517583, lng: 73.855362 },
    walkM: 1553 },
  // x1.3 the straight line
  { from: 'hatti-ganpati-mandal', to: 'chhatrapati-rajaram-mandal',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.512444, lng: 73.847482 },
    walkM: 283 },
  // x1.1 the straight line
  { from: 'hatti-ganpati-mandal', to: 'chimnya-ganpati',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.5111804596016, lng: 73.8521904497267 },
    walkM: 730 },
  // x1.1 the straight line
  { from: 'hatti-ganpati-mandal', to: 'chinchechi-talim-ganpati',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.5086, lng: 73.8555 },
    walkM: 1206 },
  // x1.5 the straight line
  { from: 'hatti-ganpati-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.51514, lng: 73.856379 },
    walkM: 1826 },
  // x1.1 the straight line
  { from: 'hatti-ganpati-mandal', to: 'garud-ganpati-mandal',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.5137, lng: 73.8456 },
    walkM: 304 },
  // x1.2 the straight line
  { from: 'hatti-ganpati-mandal', to: 'guruji-talim',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.514997, lng: 73.854992 },
    walkM: 1222 },
  // x1.0 the straight line
  { from: 'hatti-ganpati-mandal', to: 'hira-bagh-mandal',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.5042217511876, lng: 73.8557645094566 },
    walkM: 1348 },
  // x1.3 the straight line
  { from: 'hatti-ganpati-mandal', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    walkM: 1966 },
  // x1.7 the straight line
  { from: 'hatti-ganpati-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.51389, lng: 73.856342 },
    walkM: 1992 },
  // x1.1 the straight line
  { from: 'hatti-ganpati-mandal', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.513319, lng: 73.854938 },
    walkM: 1057 },
  // x1.4 the straight line
  { from: 'hatti-ganpati-mandal', to: 'kasba-ganpati',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.519055, lng: 73.857142 },
    walkM: 2134 },
  // x1.4 the straight line
  { from: 'hatti-ganpati-mandal', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.515811, lng: 73.849008 },
    walkM: 867 },
  // x1.2 the straight line
  { from: 'hatti-ganpati-mandal', to: 'mati-ganpati',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.5159, lng: 73.8468 },
    walkM: 635 },
  // x1.1 the straight line
  { from: 'hatti-ganpati-mandal', to: 'natu-baug-mandal',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.510703, lng: 73.853821 },
    walkM: 962 },
  // x1.3 the straight line
  { from: 'hatti-ganpati-mandal', to: 'navjavan-mandal',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.512919576416, lng: 73.8487282111353 },
    walkM: 447 },
  // x1.0 the straight line
  { from: 'hatti-ganpati-mandal', to: 'nimbalkar-talim-mandal',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.5119, lng: 73.8522 },
    walkM: 664 },
  // x1.3 the straight line
  { from: 'hatti-ganpati-mandal', to: 'perugate-bhave-mandal',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.509777, lng: 73.84944 },
    walkM: 530 },
  // x1.2 the straight line
  { from: 'hatti-ganpati-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.5188, lng: 73.8571 },
    walkM: 1814 },
  // x1.2 the straight line
  { from: 'hatti-ganpati-mandal', to: 'sarasbaug-ganpati',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.500881, lng: 73.85295 },
    walkM: 1623 },
  // x1.1 the straight line
  { from: 'hatti-ganpati-mandal', to: 'seva-mitra-mandal',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.5086563388099, lng: 73.8575649915299 },
    walkM: 1400 },
  // x1.1 the straight line
  { from: 'hatti-ganpati-mandal', to: 'shanipar-mandal',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.512619, lng: 73.852601 },
    walkM: 790 },
  // x1.2 the straight line
  { from: 'hatti-ganpati-mandal', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.51662, lng: 73.854894 },
    walkM: 1400 },
  // x1.3 the straight line
  { from: 'hatti-ganpati-mandal', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.5217, lng: 73.8619 },
    walkM: 2692 },
  // x1.7 the straight line
  { from: 'hatti-ganpati-mandal', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.514268, lng: 73.855306 },
    walkM: 1771 },
  // x1.4 the straight line
  { from: 'hira-bagh-mandal', to: 'akhil-mandai-mandal',
    fromAt: { lat: 18.5042217511876, lng: 73.8557645094566 }, toAt: { lat: 18.511852, lng: 73.856135 },
    walkM: 1158 },
  // x1.2 the straight line
  { from: 'hira-bagh-mandal', to: 'balvikas-mandal',
    fromAt: { lat: 18.5042217511876, lng: 73.8557645094566 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    walkM: 1708 },
  // x1.2 the straight line
  { from: 'hira-bagh-mandal', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.5042217511876, lng: 73.8557645094566 }, toAt: { lat: 18.517583, lng: 73.855362 },
    walkM: 1778 },
  // x1.1 the straight line
  { from: 'hira-bagh-mandal', to: 'chhatrapati-rajaram-mandal',
    fromAt: { lat: 18.5042217511876, lng: 73.8557645094566 }, toAt: { lat: 18.512444, lng: 73.847482 },
    walkM: 1443 },
  // x1.2 the straight line
  { from: 'hira-bagh-mandal', to: 'chimnya-ganpati',
    fromAt: { lat: 18.5042217511876, lng: 73.8557645094566 }, toAt: { lat: 18.5111804596016, lng: 73.8521904497267 },
    walkM: 1023 },
  // x1.5 the straight line
  { from: 'hira-bagh-mandal', to: 'chinchechi-talim-ganpati',
    fromAt: { lat: 18.5042217511876, lng: 73.8557645094566 }, toAt: { lat: 18.5086, lng: 73.8555 },
    walkM: 711 },
  // x1.2 the straight line
  { from: 'hira-bagh-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.5042217511876, lng: 73.8557645094566 }, toAt: { lat: 18.51514, lng: 73.856379 },
    walkM: 1479 },
  // x1.1 the straight line
  { from: 'hira-bagh-mandal', to: 'garud-ganpati-mandal',
    fromAt: { lat: 18.5042217511876, lng: 73.8557645094566 }, toAt: { lat: 18.5137, lng: 73.8456 },
    walkM: 1653 },
  // x1.2 the straight line
  { from: 'hira-bagh-mandal', to: 'guruji-talim',
    fromAt: { lat: 18.5042217511876, lng: 73.8557645094566 }, toAt: { lat: 18.514997, lng: 73.854992 },
    walkM: 1447 },
  // x1.0 the straight line
  { from: 'hira-bagh-mandal', to: 'hatti-ganpati-mandal',
    fromAt: { lat: 18.5042217511876, lng: 73.8557645094566 }, toAt: { lat: 18.511223, lng: 73.845858 },
    walkM: 1348 },
  // x1.2 the straight line
  { from: 'hira-bagh-mandal', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.5042217511876, lng: 73.8557645094566 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    walkM: 1612 },
  // x1.3 the straight line
  { from: 'hira-bagh-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.5042217511876, lng: 73.8557645094566 }, toAt: { lat: 18.51389, lng: 73.856342 },
    walkM: 1433 },
  // x1.3 the straight line
  { from: 'hira-bagh-mandal', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.5042217511876, lng: 73.8557645094566 }, toAt: { lat: 18.513319, lng: 73.854938 },
    walkM: 1283 },
  // x1.2 the straight line
  { from: 'hira-bagh-mandal', to: 'kasba-ganpati',
    fromAt: { lat: 18.5042217511876, lng: 73.8557645094566 }, toAt: { lat: 18.519055, lng: 73.857142 },
    walkM: 2063 },
  // x1.2 the straight line
  { from: 'hira-bagh-mandal', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.5042217511876, lng: 73.8557645094566 }, toAt: { lat: 18.515811, lng: 73.849008 },
    walkM: 1766 },
  // x1.1 the straight line
  { from: 'hira-bagh-mandal', to: 'mati-ganpati',
    fromAt: { lat: 18.5042217511876, lng: 73.8557645094566 }, toAt: { lat: 18.5159, lng: 73.8468 },
    walkM: 1839 },
  // x1.2 the straight line
  { from: 'hira-bagh-mandal', to: 'natu-baug-mandal',
    fromAt: { lat: 18.5042217511876, lng: 73.8557645094566 }, toAt: { lat: 18.510703, lng: 73.853821 },
    walkM: 879 },
  // x1.1 the straight line
  { from: 'hira-bagh-mandal', to: 'navjavan-mandal',
    fromAt: { lat: 18.5042217511876, lng: 73.8557645094566 }, toAt: { lat: 18.512919576416, lng: 73.8487282111353 },
    walkM: 1364 },
  // x1.2 the straight line
  { from: 'hira-bagh-mandal', to: 'nimbalkar-talim-mandal',
    fromAt: { lat: 18.5042217511876, lng: 73.8557645094566 }, toAt: { lat: 18.5119, lng: 73.8522 },
    walkM: 1101 },
  // x1.2 the straight line
  { from: 'hira-bagh-mandal', to: 'perugate-bhave-mandal',
    fromAt: { lat: 18.5042217511876, lng: 73.8557645094566 }, toAt: { lat: 18.509777, lng: 73.84944 },
    walkM: 1081 },
  // x1.2 the straight line
  { from: 'hira-bagh-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.5042217511876, lng: 73.8557645094566 }, toAt: { lat: 18.5188, lng: 73.8571 },
    walkM: 1979 },
  // x1.4 the straight line
  { from: 'hira-bagh-mandal', to: 'sarasbaug-ganpati',
    fromAt: { lat: 18.5042217511876, lng: 73.8557645094566 }, toAt: { lat: 18.500881, lng: 73.85295 },
    walkM: 681 },
  // x1.3 the straight line
  { from: 'hira-bagh-mandal', to: 'seva-mitra-mandal',
    fromAt: { lat: 18.5042217511876, lng: 73.8557645094566 }, toAt: { lat: 18.5086563388099, lng: 73.8575649915299 },
    walkM: 682 },
  // x1.2 the straight line
  { from: 'hira-bagh-mandal', to: 'shanipar-mandal',
    fromAt: { lat: 18.5042217511876, lng: 73.8557645094566 }, toAt: { lat: 18.512619, lng: 73.852601 },
    walkM: 1224 },
  // x1.2 the straight line
  { from: 'hira-bagh-mandal', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.5042217511876, lng: 73.8557645094566 }, toAt: { lat: 18.51662, lng: 73.854894 },
    walkM: 1626 },
  // x1.2 the straight line
  { from: 'hira-bagh-mandal', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.5042217511876, lng: 73.8557645094566 }, toAt: { lat: 18.5217, lng: 73.8619 },
    walkM: 2535 },
  // x1.4 the straight line
  { from: 'hira-bagh-mandal', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.5042217511876, lng: 73.8557645094566 }, toAt: { lat: 18.514268, lng: 73.855306 },
    walkM: 1533 },
  // x1.4 the straight line
  { from: 'honaji-tarun-mandal', to: 'akhil-mandai-mandal',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.511852, lng: 73.856135 },
    walkM: 748 },
  // x3.7 the straight line
  { from: 'honaji-tarun-mandal', to: 'balvikas-mandal',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    walkM: 1833 },
  // x4.1 the straight line
  { from: 'honaji-tarun-mandal', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.517583, lng: 73.855362 },
    walkM: 1903 },
  // x1.2 the straight line
  { from: 'honaji-tarun-mandal', to: 'chhatrapati-rajaram-mandal',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.512444, lng: 73.847482 },
    walkM: 1503 },
  // x1.3 the straight line
  { from: 'honaji-tarun-mandal', to: 'chimnya-ganpati',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.5111804596016, lng: 73.8521904497267 },
    walkM: 1138 },
  // x1.3 the straight line
  { from: 'honaji-tarun-mandal', to: 'chinchechi-talim-ganpati',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.5086, lng: 73.8555 },
    walkM: 1160 },
  // x2.5 the straight line
  { from: 'honaji-tarun-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.51514, lng: 73.856379 },
    walkM: 764 },
  // x1.1 the straight line
  { from: 'honaji-tarun-mandal', to: 'garud-ganpati-mandal',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.5137, lng: 73.8456 },
    walkM: 1589 },
  // x1.1 the straight line
  { from: 'honaji-tarun-mandal', to: 'guruji-talim',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.514997, lng: 73.854992 },
    walkM: 505 },
  // x1.2 the straight line
  { from: 'honaji-tarun-mandal', to: 'hatti-ganpati-mandal',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.511223, lng: 73.845858 },
    walkM: 1727 },
  // x1.2 the straight line
  { from: 'honaji-tarun-mandal', to: 'hira-bagh-mandal',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.5042217511876, lng: 73.8557645094566 },
    walkM: 1612 },
  // x1.3 the straight line
  { from: 'honaji-tarun-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.51389, lng: 73.856342 },
    walkM: 477 },
  // x1.4 the straight line
  { from: 'honaji-tarun-mandal', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.513319, lng: 73.854938 },
    walkM: 714 },
  // x1.4 the straight line
  { from: 'honaji-tarun-mandal', to: 'kasba-ganpati',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.519055, lng: 73.857142 },
    walkM: 628 },
  // x1.1 the straight line
  { from: 'honaji-tarun-mandal', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.515811, lng: 73.849008 },
    walkM: 1230 },
  // x1.1 the straight line
  { from: 'honaji-tarun-mandal', to: 'mati-ganpati',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.5159, lng: 73.8468 },
    walkM: 1462 },
  // x1.4 the straight line
  { from: 'honaji-tarun-mandal', to: 'natu-baug-mandal',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.510703, lng: 73.853821 },
    walkM: 1073 },
  // x1.2 the straight line
  { from: 'honaji-tarun-mandal', to: 'navjavan-mandal',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.512919576416, lng: 73.8487282111353 },
    walkM: 1333 },
  // x1.3 the straight line
  { from: 'honaji-tarun-mandal', to: 'nimbalkar-talim-mandal',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.5119, lng: 73.8522 },
    walkM: 1070 },
  // x1.4 the straight line
  { from: 'honaji-tarun-mandal', to: 'perugate-bhave-mandal',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.509777, lng: 73.84944 },
    walkM: 1677 },
  // x1.4 the straight line
  { from: 'honaji-tarun-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.5188, lng: 73.8571 },
    walkM: 590 },
  // x1.3 the straight line
  { from: 'honaji-tarun-mandal', to: 'sarasbaug-ganpati',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.500881, lng: 73.85295 },
    walkM: 2267 },
  // x1.2 the straight line
  { from: 'honaji-tarun-mandal', to: 'seva-mitra-mandal',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.5086563388099, lng: 73.8575649915299 },
    walkM: 944 },
  // x1.2 the straight line
  { from: 'honaji-tarun-mandal', to: 'shanipar-mandal',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.512619, lng: 73.852601 },
    walkM: 936 },
  // x3.7 the straight line
  { from: 'honaji-tarun-mandal', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.51662, lng: 73.854894 },
    walkM: 1769 },
  // x1.3 the straight line
  { from: 'honaji-tarun-mandal', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.5217, lng: 73.8619 },
    walkM: 942 },
  // x1.3 the straight line
  { from: 'honaji-tarun-mandal', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.514268, lng: 73.855306 },
    walkM: 591 },
  // x1.2 the straight line
  { from: 'hutatma-babu-genu-mandal', to: 'akhil-mandai-mandal',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.511852, lng: 73.856135 },
    walkM: 277 },
  // x2.0 the straight line
  { from: 'hutatma-babu-genu-mandal', to: 'balvikas-mandal',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    walkM: 843 },
  // x2.1 the straight line
  { from: 'hutatma-babu-genu-mandal', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.517583, lng: 73.855362 },
    walkM: 909 },
  // x1.1 the straight line
  { from: 'hutatma-babu-genu-mandal', to: 'chhatrapati-rajaram-mandal',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.512444, lng: 73.847482 },
    walkM: 1040 },
  // x1.3 the straight line
  { from: 'hutatma-babu-genu-mandal', to: 'chimnya-ganpati',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.5111804596016, lng: 73.8521904497267 },
    walkM: 702 },
  // x1.2 the straight line
  { from: 'hutatma-babu-genu-mandal', to: 'chinchechi-talim-ganpati',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.5086, lng: 73.8555 },
    walkM: 711 },
  // x8.1 the straight line
  { from: 'hutatma-babu-genu-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.51514, lng: 73.856379 },
    walkM: 1121 },
  // x1.2 the straight line
  { from: 'hutatma-babu-genu-mandal', to: 'garud-ganpati-mandal',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.5137, lng: 73.8456 },
    walkM: 1405 },
  // x3.1 the straight line
  { from: 'hutatma-babu-genu-mandal', to: 'guruji-talim',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.514997, lng: 73.854992 },
    walkM: 577 },
  // x1.1 the straight line
  { from: 'hutatma-babu-genu-mandal', to: 'hatti-ganpati-mandal',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.511223, lng: 73.845858 },
    walkM: 1247 },
  // x1.3 the straight line
  { from: 'hutatma-babu-genu-mandal', to: 'hira-bagh-mandal',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.5042217511876, lng: 73.8557645094566 },
    walkM: 1422 },
  // x2.1 the straight line
  { from: 'hutatma-babu-genu-mandal', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    walkM: 776 },
  // x1.2 the straight line
  { from: 'hutatma-babu-genu-mandal', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.513319, lng: 73.854938 },
    walkM: 189 },
  // x2.1 the straight line
  { from: 'hutatma-babu-genu-mandal', to: 'kasba-ganpati',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.519055, lng: 73.857142 },
    walkM: 1247 },
  // x1.4 the straight line
  { from: 'hutatma-babu-genu-mandal', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.515811, lng: 73.849008 },
    walkM: 1142 },
  // x1.4 the straight line
  { from: 'hutatma-babu-genu-mandal', to: 'mati-ganpati',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.5159, lng: 73.8468 },
    walkM: 1407 },
  // x1.3 the straight line
  { from: 'hutatma-babu-genu-mandal', to: 'natu-baug-mandal',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.510703, lng: 73.853821 },
    walkM: 594 },
  // x1.2 the straight line
  { from: 'hutatma-babu-genu-mandal', to: 'navjavan-mandal',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.512919576416, lng: 73.8487282111353 },
    walkM: 948 },
  // x1.2 the straight line
  { from: 'hutatma-babu-genu-mandal', to: 'nimbalkar-talim-mandal',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.5119, lng: 73.8522 },
    walkM: 591 },
  // x1.4 the straight line
  { from: 'hutatma-babu-genu-mandal', to: 'perugate-bhave-mandal',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.509777, lng: 73.84944 },
    walkM: 1197 },
  // x2.2 the straight line
  { from: 'hutatma-babu-genu-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.5188, lng: 73.8571 },
    walkM: 1209 },
  // x1.2 the straight line
  { from: 'hutatma-babu-genu-mandal', to: 'sarasbaug-ganpati',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.500881, lng: 73.85295 },
    walkM: 1787 },
  // x1.2 the straight line
  { from: 'hutatma-babu-genu-mandal', to: 'seva-mitra-mandal',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.5086563388099, lng: 73.8575649915299 },
    walkM: 741 },
  // x1.1 the straight line
  { from: 'hutatma-babu-genu-mandal', to: 'shanipar-mandal',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.512619, lng: 73.852601 },
    walkM: 457 },
  // x2.2 the straight line
  { from: 'hutatma-babu-genu-mandal', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.51662, lng: 73.854894 },
    walkM: 757 },
  // x1.3 the straight line
  { from: 'hutatma-babu-genu-mandal', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.5217, lng: 73.8619 },
    walkM: 1389 },
  // x5.7 the straight line
  { from: 'hutatma-babu-genu-mandal', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.514268, lng: 73.855306 },
    walkM: 666 },
  // x1.4 the straight line
  { from: 'jilbya-maruti-mandal', to: 'akhil-mandai-mandal',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.511852, lng: 73.856135 },
    walkM: 298 },
  // x1.4 the straight line
  { from: 'jilbya-maruti-mandal', to: 'balvikas-mandal',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    walkM: 658 },
  // x1.5 the straight line
  { from: 'jilbya-maruti-mandal', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.517583, lng: 73.855362 },
    walkM: 720 },
  // x1.1 the straight line
  { from: 'jilbya-maruti-mandal', to: 'chhatrapati-rajaram-mandal',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.512444, lng: 73.847482 },
    walkM: 850 },
  // x1.4 the straight line
  { from: 'jilbya-maruti-mandal', to: 'chimnya-ganpati',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.5111804596016, lng: 73.8521904497267 },
    walkM: 512 },
  // x1.1 the straight line
  { from: 'jilbya-maruti-mandal', to: 'chinchechi-talim-ganpati',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.5086, lng: 73.8555 },
    walkM: 559 },
  // x4.8 the straight line
  { from: 'jilbya-maruti-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.51514, lng: 73.856379 },
    walkM: 1224 },
  // x1.1 the straight line
  { from: 'jilbya-maruti-mandal', to: 'garud-ganpati-mandal',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.5137, lng: 73.8456 },
    walkM: 1130 },
  // x2.1 the straight line
  { from: 'jilbya-maruti-mandal', to: 'guruji-talim',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.514997, lng: 73.854992 },
    walkM: 391 },
  // x1.1 the straight line
  { from: 'jilbya-maruti-mandal', to: 'hatti-ganpati-mandal',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.511223, lng: 73.845858 },
    walkM: 1057 },
  // x1.3 the straight line
  { from: 'jilbya-maruti-mandal', to: 'hira-bagh-mandal',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.5042217511876, lng: 73.8557645094566 },
    walkM: 1283 },
  // x2.2 the straight line
  { from: 'jilbya-maruti-mandal', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    walkM: 1168 },
  // x8.4 the straight line
  { from: 'jilbya-maruti-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.51389, lng: 73.856342 },
    walkM: 1359 },
  // x2.6 the straight line
  { from: 'jilbya-maruti-mandal', to: 'kasba-ganpati',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.519055, lng: 73.857142 },
    walkM: 1770 },
  // x1.4 the straight line
  { from: 'jilbya-maruti-mandal', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.515811, lng: 73.849008 },
    walkM: 952 },
  // x1.2 the straight line
  { from: 'jilbya-maruti-mandal', to: 'mati-ganpati',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.5159, lng: 73.8468 },
    walkM: 1128 },
  // x1.3 the straight line
  { from: 'jilbya-maruti-mandal', to: 'natu-baug-mandal',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.510703, lng: 73.853821 },
    walkM: 404 },
  // x1.2 the straight line
  { from: 'jilbya-maruti-mandal', to: 'navjavan-mandal',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.512919576416, lng: 73.8487282111353 },
    walkM: 758 },
  // x1.2 the straight line
  { from: 'jilbya-maruti-mandal', to: 'nimbalkar-talim-mandal',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.5119, lng: 73.8522 },
    walkM: 401 },
  // x1.4 the straight line
  { from: 'jilbya-maruti-mandal', to: 'perugate-bhave-mandal',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.509777, lng: 73.84944 },
    walkM: 1007 },
  // x1.6 the straight line
  { from: 'jilbya-maruti-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.5188, lng: 73.8571 },
    walkM: 1023 },
  // x1.1 the straight line
  { from: 'jilbya-maruti-mandal', to: 'sarasbaug-ganpati',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.500881, lng: 73.85295 },
    walkM: 1597 },
  // x1.4 the straight line
  { from: 'jilbya-maruti-mandal', to: 'seva-mitra-mandal',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.5086563388099, lng: 73.8575649915299 },
    walkM: 818 },
  // x1.0 the straight line
  { from: 'jilbya-maruti-mandal', to: 'shanipar-mandal',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.512619, lng: 73.852601 },
    walkM: 267 },
  // x1.6 the straight line
  { from: 'jilbya-maruti-mandal', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.51662, lng: 73.854894 },
    walkM: 585 },
  // x2.0 the straight line
  { from: 'jilbya-maruti-mandal', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.5217, lng: 73.8619 },
    walkM: 2318 },
  // x4.3 the straight line
  { from: 'jilbya-maruti-mandal', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.514268, lng: 73.855306 },
    walkM: 481 },
  // x1.2 the straight line
  { from: 'kasba-ganpati', to: 'akhil-mandai-mandal',
    fromAt: { lat: 18.519055, lng: 73.857142 }, toAt: { lat: 18.511852, lng: 73.856135 },
    walkM: 942 },
  // x1.6 the straight line
  { from: 'kasba-ganpati', to: 'balvikas-mandal',
    fromAt: { lat: 18.519055, lng: 73.857142 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    walkM: 443 },
  // x1.5 the straight line
  { from: 'kasba-ganpati', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.519055, lng: 73.857142 }, toAt: { lat: 18.517583, lng: 73.855362 },
    walkM: 373 },
  // x1.3 the straight line
  { from: 'kasba-ganpati', to: 'chhatrapati-rajaram-mandal',
    fromAt: { lat: 18.519055, lng: 73.857142 }, toAt: { lat: 18.512444, lng: 73.847482 },
    walkM: 1628 },
  // x1.2 the straight line
  { from: 'kasba-ganpati', to: 'chimnya-ganpati',
    fromAt: { lat: 18.519055, lng: 73.857142 }, toAt: { lat: 18.5111804596016, lng: 73.8521904497267 },
    walkM: 1263 },
  // x1.3 the straight line
  { from: 'kasba-ganpati', to: 'chinchechi-talim-ganpati',
    fromAt: { lat: 18.519055, lng: 73.857142 }, toAt: { lat: 18.5086, lng: 73.8555 },
    walkM: 1477 },
  // x1.2 the straight line
  { from: 'kasba-ganpati', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.519055, lng: 73.857142 }, toAt: { lat: 18.51514, lng: 73.856379 },
    walkM: 538 },
  // x1.3 the straight line
  { from: 'kasba-ganpati', to: 'garud-ganpati-mandal',
    fromAt: { lat: 18.519055, lng: 73.857142 }, toAt: { lat: 18.5137, lng: 73.8456 },
    walkM: 1715 },
  // x1.2 the straight line
  { from: 'kasba-ganpati', to: 'guruji-talim',
    fromAt: { lat: 18.519055, lng: 73.857142 }, toAt: { lat: 18.514997, lng: 73.854992 },
    walkM: 630 },
  // x1.3 the straight line
  { from: 'kasba-ganpati', to: 'hatti-ganpati-mandal',
    fromAt: { lat: 18.519055, lng: 73.857142 }, toAt: { lat: 18.511223, lng: 73.845858 },
    walkM: 1852 },
  // x1.2 the straight line
  { from: 'kasba-ganpati', to: 'hira-bagh-mandal',
    fromAt: { lat: 18.519055, lng: 73.857142 }, toAt: { lat: 18.5042217511876, lng: 73.8557645094566 },
    walkM: 2006 },
  // x1.4 the straight line
  { from: 'kasba-ganpati', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.519055, lng: 73.857142 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    walkM: 628 },
  // x1.2 the straight line
  { from: 'kasba-ganpati', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.519055, lng: 73.857142 }, toAt: { lat: 18.51389, lng: 73.856342 },
    walkM: 671 },
  // x1.5 the straight line
  { from: 'kasba-ganpati', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.519055, lng: 73.857142 }, toAt: { lat: 18.513319, lng: 73.854938 },
    walkM: 995 },
  // x1.2 the straight line
  { from: 'kasba-ganpati', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.519055, lng: 73.857142 }, toAt: { lat: 18.515811, lng: 73.849008 },
    walkM: 1121 },
  // x1.2 the straight line
  { from: 'kasba-ganpati', to: 'mati-ganpati',
    fromAt: { lat: 18.519055, lng: 73.857142 }, toAt: { lat: 18.5159, lng: 73.8468 },
    walkM: 1353 },
  // x1.2 the straight line
  { from: 'kasba-ganpati', to: 'natu-baug-mandal',
    fromAt: { lat: 18.519055, lng: 73.857142 }, toAt: { lat: 18.510703, lng: 73.853821 },
    walkM: 1199 },
  // x1.3 the straight line
  { from: 'kasba-ganpati', to: 'navjavan-mandal',
    fromAt: { lat: 18.519055, lng: 73.857142 }, toAt: { lat: 18.512919576416, lng: 73.8487282111353 },
    walkM: 1459 },
  // x1.3 the straight line
  { from: 'kasba-ganpati', to: 'nimbalkar-talim-mandal',
    fromAt: { lat: 18.519055, lng: 73.857142 }, toAt: { lat: 18.5119, lng: 73.8522 },
    walkM: 1196 },
  // x1.4 the straight line
  { from: 'kasba-ganpati', to: 'perugate-bhave-mandal',
    fromAt: { lat: 18.519055, lng: 73.857142 }, toAt: { lat: 18.509777, lng: 73.84944 },
    walkM: 1802 },
  // x1.6 the straight line
  { from: 'kasba-ganpati', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.519055, lng: 73.857142 }, toAt: { lat: 18.5188, lng: 73.8571 },
    walkM: 47 },
  // x1.2 the straight line
  { from: 'kasba-ganpati', to: 'sarasbaug-ganpati',
    fromAt: { lat: 18.519055, lng: 73.857142 }, toAt: { lat: 18.500881, lng: 73.85295 },
    walkM: 2392 },
  // x1.1 the straight line
  { from: 'kasba-ganpati', to: 'seva-mitra-mandal',
    fromAt: { lat: 18.519055, lng: 73.857142 }, toAt: { lat: 18.5086563388099, lng: 73.8575649915299 },
    walkM: 1325 },
  // x1.2 the straight line
  { from: 'kasba-ganpati', to: 'shanipar-mandal',
    fromAt: { lat: 18.519055, lng: 73.857142 }, toAt: { lat: 18.512619, lng: 73.852601 },
    walkM: 1062 },
  // x1.4 the straight line
  { from: 'kasba-ganpati', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.519055, lng: 73.857142 }, toAt: { lat: 18.51662, lng: 73.854894 },
    walkM: 506 },
  // x1.4 the straight line
  { from: 'kasba-ganpati', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.519055, lng: 73.857142 }, toAt: { lat: 18.5217, lng: 73.8619 },
    walkM: 802 },
  // x1.3 the straight line
  { from: 'kasba-ganpati', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.519055, lng: 73.857142 }, toAt: { lat: 18.514268, lng: 73.855306 },
    walkM: 720 },
  // x1.4 the straight line
  { from: 'kesariwada-ganpati', to: 'akhil-mandai-mandal',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.511852, lng: 73.856135 },
    walkM: 1240 },
  // x1.1 the straight line
  { from: 'kesariwada-ganpati', to: 'balvikas-mandal',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    walkM: 710 },
  // x1.1 the straight line
  { from: 'kesariwada-ganpati', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.517583, lng: 73.855362 },
    walkM: 780 },
  // x1.5 the straight line
  { from: 'kesariwada-ganpati', to: 'chhatrapati-rajaram-mandal',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.512444, lng: 73.847482 },
    walkM: 621 },
  // x1.4 the straight line
  { from: 'kesariwada-ganpati', to: 'chimnya-ganpati',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.5111804596016, lng: 73.8521904497267 },
    walkM: 876 },
  // x1.4 the straight line
  { from: 'kesariwada-ganpati', to: 'chinchechi-talim-ganpati',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.5086, lng: 73.8555 },
    walkM: 1455 },
  // x1.2 the straight line
  { from: 'kesariwada-ganpati', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.51514, lng: 73.856379 },
    walkM: 958 },
  // x1.3 the straight line
  { from: 'kesariwada-ganpati', to: 'garud-ganpati-mandal',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.5137, lng: 73.8456 },
    walkM: 562 },
  // x1.3 the straight line
  { from: 'kesariwada-ganpati', to: 'guruji-talim',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.514997, lng: 73.854992 },
    walkM: 819 },
  // x1.5 the straight line
  { from: 'kesariwada-ganpati', to: 'hatti-ganpati-mandal',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.511223, lng: 73.845858 },
    walkM: 893 },
  // x1.2 the straight line
  { from: 'kesariwada-ganpati', to: 'hira-bagh-mandal',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.5042217511876, lng: 73.8557645094566 },
    walkM: 1766 },
  // x1.1 the straight line
  { from: 'kesariwada-ganpati', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    walkM: 1230 },
  // x1.4 the straight line
  { from: 'kesariwada-ganpati', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.51389, lng: 73.856342 },
    walkM: 1089 },
  // x1.4 the straight line
  { from: 'kesariwada-ganpati', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.513319, lng: 73.854938 },
    walkM: 952 },
  // x2.2 the straight line
  { from: 'kesariwada-ganpati', to: 'kasba-ganpati',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.519055, lng: 73.857142 },
    walkM: 2029 },
  // x1.0 the straight line
  { from: 'kesariwada-ganpati', to: 'mati-ganpati',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.5159, lng: 73.8468 },
    walkM: 231 },
  // x1.5 the straight line
  { from: 'kesariwada-ganpati', to: 'natu-baug-mandal',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.510703, lng: 73.853821 },
    walkM: 1132 },
  // x1.6 the straight line
  { from: 'kesariwada-ganpati', to: 'navjavan-mandal',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.512919576416, lng: 73.8487282111353 },
    walkM: 531 },
  // x1.5 the straight line
  { from: 'kesariwada-ganpati', to: 'nimbalkar-talim-mandal',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.5119, lng: 73.8522 },
    walkM: 810 },
  // x1.4 the straight line
  { from: 'kesariwada-ganpati', to: 'perugate-bhave-mandal',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.509777, lng: 73.84944 },
    walkM: 928 },
  // x1.2 the straight line
  { from: 'kesariwada-ganpati', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.5188, lng: 73.8571 },
    walkM: 1081 },
  // x1.2 the straight line
  { from: 'kesariwada-ganpati', to: 'sarasbaug-ganpati',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.500881, lng: 73.85295 },
    walkM: 2041 },
  // x1.4 the straight line
  { from: 'kesariwada-ganpati', to: 'seva-mitra-mandal',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.5086563388099, lng: 73.8575649915299 },
    walkM: 1709 },
  // x1.5 the straight line
  { from: 'kesariwada-ganpati', to: 'shanipar-mandal',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.512619, lng: 73.852601 },
    walkM: 773 },
  // x1.0 the straight line
  { from: 'kesariwada-ganpati', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.51662, lng: 73.854894 },
    walkM: 646 },
  // x1.6 the straight line
  { from: 'kesariwada-ganpati', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.5217, lng: 73.8619 },
    walkM: 2387 },
  // x1.3 the straight line
  { from: 'kesariwada-ganpati', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.514268, lng: 73.855306 },
    walkM: 905 },
  // x1.3 the straight line
  { from: 'mati-ganpati', to: 'akhil-mandai-mandal',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.511852, lng: 73.856135 },
    walkM: 1416 },
  // x1.1 the straight line
  { from: 'mati-ganpati', to: 'balvikas-mandal',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    walkM: 942 },
  // x1.1 the straight line
  { from: 'mati-ganpati', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.517583, lng: 73.855362 },
    walkM: 1012 },
  // x1.0 the straight line
  { from: 'mati-ganpati', to: 'chhatrapati-rajaram-mandal',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.512444, lng: 73.847482 },
    walkM: 389 },
  // x1.3 the straight line
  { from: 'mati-ganpati', to: 'chimnya-ganpati',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.5111804596016, lng: 73.8521904497267 },
    walkM: 1039 },
  // x1.3 the straight line
  { from: 'mati-ganpati', to: 'chinchechi-talim-ganpati',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.5086, lng: 73.8555 },
    walkM: 1619 },
  // x1.2 the straight line
  { from: 'mati-ganpati', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.51514, lng: 73.856379 },
    walkM: 1190 },
  // x1.2 the straight line
  { from: 'mati-ganpati', to: 'garud-ganpati-mandal',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.5137, lng: 73.8456 },
    walkM: 330 },
  // x1.2 the straight line
  { from: 'mati-ganpati', to: 'guruji-talim',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.514997, lng: 73.854992 },
    walkM: 1033 },
  // x1.2 the straight line
  { from: 'mati-ganpati', to: 'hatti-ganpati-mandal',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.511223, lng: 73.845858 },
    walkM: 661 },
  // x1.1 the straight line
  { from: 'mati-ganpati', to: 'hira-bagh-mandal',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.5042217511876, lng: 73.8557645094566 },
    walkM: 1839 },
  // x1.1 the straight line
  { from: 'mati-ganpati', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    walkM: 1462 },
  // x1.3 the straight line
  { from: 'mati-ganpati', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.51389, lng: 73.856342 },
    walkM: 1303 },
  // x1.2 the straight line
  { from: 'mati-ganpati', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.513319, lng: 73.854938 },
    walkM: 1128 },
  // x1.9 the straight line
  { from: 'mati-ganpati', to: 'kasba-ganpati',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.519055, lng: 73.857142 },
    walkM: 2205 },
  // x1.0 the straight line
  { from: 'mati-ganpati', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.515811, lng: 73.849008 },
    walkM: 231 },
  // x1.4 the straight line
  { from: 'mati-ganpati', to: 'natu-baug-mandal',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.510703, lng: 73.853821 },
    walkM: 1269 },
  // x1.2 the straight line
  { from: 'mati-ganpati', to: 'navjavan-mandal',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.512919576416, lng: 73.8487282111353 },
    walkM: 474 },
  // x1.3 the straight line
  { from: 'mati-ganpati', to: 'nimbalkar-talim-mandal',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.5119, lng: 73.8522 },
    walkM: 974 },
  // x1.2 the straight line
  { from: 'mati-ganpati', to: 'perugate-bhave-mandal',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.509777, lng: 73.84944 },
    walkM: 871 },
  // x1.2 the straight line
  { from: 'mati-ganpati', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.5188, lng: 73.8571 },
    walkM: 1313 },
  // x1.2 the straight line
  { from: 'mati-ganpati', to: 'sarasbaug-ganpati',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.500881, lng: 73.85295 },
    walkM: 2113 },
  // x1.3 the straight line
  { from: 'mati-ganpati', to: 'seva-mitra-mandal',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.5086563388099, lng: 73.8575649915299 },
    walkM: 1873 },
  // x1.3 the straight line
  { from: 'mati-ganpati', to: 'shanipar-mandal',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.512619, lng: 73.852601 },
    walkM: 949 },
  // x1.0 the straight line
  { from: 'mati-ganpati', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.51662, lng: 73.854894 },
    walkM: 878 },
  // x1.5 the straight line
  { from: 'mati-ganpati', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.5217, lng: 73.8619 },
    walkM: 2585 },
  // x1.2 the straight line
  { from: 'mati-ganpati', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.514268, lng: 73.855306 },
    walkM: 1123 },
  // x1.4 the straight line
  { from: 'natu-baug-mandal', to: 'akhil-mandai-mandal',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.511852, lng: 73.856135 },
    walkM: 374 },
  // x1.1 the straight line
  { from: 'natu-baug-mandal', to: 'balvikas-mandal',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    walkM: 829 },
  // x1.1 the straight line
  { from: 'natu-baug-mandal', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.517583, lng: 73.855362 },
    walkM: 899 },
  // x1.3 the straight line
  { from: 'natu-baug-mandal', to: 'chhatrapati-rajaram-mandal',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.512444, lng: 73.847482 },
    walkM: 895 },
  // x1.3 the straight line
  { from: 'natu-baug-mandal', to: 'chimnya-ganpati',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.5111804596016, lng: 73.8521904497267 },
    walkM: 229 },
  // x1.4 the straight line
  { from: 'natu-baug-mandal', to: 'chinchechi-talim-ganpati',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.5086, lng: 73.8555 },
    walkM: 402 },
  // x2.0 the straight line
  { from: 'natu-baug-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.51514, lng: 73.856379 },
    walkM: 1112 },
  // x1.4 the straight line
  { from: 'natu-baug-mandal', to: 'garud-ganpati-mandal',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.5137, lng: 73.8456 },
    walkM: 1260 },
  // x1.2 the straight line
  { from: 'natu-baug-mandal', to: 'guruji-talim',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.514997, lng: 73.854992 },
    walkM: 568 },
  // x1.1 the straight line
  { from: 'natu-baug-mandal', to: 'hatti-ganpati-mandal',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.511223, lng: 73.845858 },
    walkM: 959 },
  // x1.2 the straight line
  { from: 'natu-baug-mandal', to: 'hira-bagh-mandal',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.5042217511876, lng: 73.8557645094566 },
    walkM: 879 },
  // x1.4 the straight line
  { from: 'natu-baug-mandal', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    walkM: 1127 },
  // x1.9 the straight line
  { from: 'natu-baug-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.51389, lng: 73.856342 },
    walkM: 837 },
  // x1.3 the straight line
  { from: 'natu-baug-mandal', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.513319, lng: 73.854938 },
    walkM: 404 },
  // x1.5 the straight line
  { from: 'natu-baug-mandal', to: 'kasba-ganpati',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.519055, lng: 73.857142 },
    walkM: 1481 },
  // x1.5 the straight line
  { from: 'natu-baug-mandal', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.515811, lng: 73.849008 },
    walkM: 1105 },
  // x1.4 the straight line
  { from: 'natu-baug-mandal', to: 'mati-ganpati',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.5159, lng: 73.8468 },
    walkM: 1274 },
  // x1.4 the straight line
  { from: 'natu-baug-mandal', to: 'navjavan-mandal',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.512919576416, lng: 73.8487282111353 },
    walkM: 804 },
  // x1.4 the straight line
  { from: 'natu-baug-mandal', to: 'nimbalkar-talim-mandal',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.5119, lng: 73.8522 },
    walkM: 297 },
  // x1.6 the straight line
  { from: 'natu-baug-mandal', to: 'perugate-bhave-mandal',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.509777, lng: 73.84944 },
    walkM: 750 },
  // x1.2 the straight line
  { from: 'natu-baug-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.5188, lng: 73.8571 },
    walkM: 1200 },
  // x1.1 the straight line
  { from: 'natu-baug-mandal', to: 'sarasbaug-ganpati',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.500881, lng: 73.85295 },
    walkM: 1193 },
  // x1.4 the straight line
  { from: 'natu-baug-mandal', to: 'seva-mitra-mandal',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.5086563388099, lng: 73.8575649915299 },
    walkM: 657 },
  // x1.6 the straight line
  { from: 'natu-baug-mandal', to: 'shanipar-mandal',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.512619, lng: 73.852601 },
    walkM: 402 },
  // x1.1 the straight line
  { from: 'natu-baug-mandal', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.51662, lng: 73.854894 },
    walkM: 747 },
  // x1.4 the straight line
  { from: 'natu-baug-mandal', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.5217, lng: 73.8619 },
    walkM: 2048 },
  // x2.2 the straight line
  { from: 'natu-baug-mandal', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.514268, lng: 73.855306 },
    walkM: 947 },
  // x1.2 the straight line
  { from: 'navjavan-mandal', to: 'akhil-mandai-mandal',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.511852, lng: 73.856135 },
    walkM: 925 },
  // x1.3 the straight line
  { from: 'navjavan-mandal', to: 'balvikas-mandal',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    walkM: 1103 },
  // x1.3 the straight line
  { from: 'navjavan-mandal', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.517583, lng: 73.855362 },
    walkM: 1174 },
  // x1.2 the straight line
  { from: 'navjavan-mandal', to: 'chhatrapati-rajaram-mandal',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.512444, lng: 73.847482 },
    walkM: 166 },
  // x1.4 the straight line
  { from: 'navjavan-mandal', to: 'chimnya-ganpati',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.5111804596016, lng: 73.8521904497267 },
    walkM: 575 },
  // x1.3 the straight line
  { from: 'navjavan-mandal', to: 'chinchechi-talim-ganpati',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.5086, lng: 73.8555 },
    walkM: 1154 },
  // x1.6 the straight line
  { from: 'navjavan-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.51514, lng: 73.856379 },
    walkM: 1373 },
  // x1.3 the straight line
  { from: 'navjavan-mandal', to: 'garud-ganpati-mandal',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.5137, lng: 73.8456 },
    walkM: 457 },
  // x1.2 the straight line
  { from: 'navjavan-mandal', to: 'guruji-talim',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.514997, lng: 73.854992 },
    walkM: 828 },
  // x1.3 the straight line
  { from: 'navjavan-mandal', to: 'hatti-ganpati-mandal',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.511223, lng: 73.845858 },
    walkM: 447 },
  // x1.1 the straight line
  { from: 'navjavan-mandal', to: 'hira-bagh-mandal',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.5042217511876, lng: 73.8557645094566 },
    walkM: 1364 },
  // x1.4 the straight line
  { from: 'navjavan-mandal', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    walkM: 1619 },
  // x1.4 the straight line
  { from: 'navjavan-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.51389, lng: 73.856342 },
    walkM: 1097 },
  // x1.2 the straight line
  { from: 'navjavan-mandal', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.513319, lng: 73.854938 },
    walkM: 758 },
  // x1.6 the straight line
  { from: 'navjavan-mandal', to: 'kasba-ganpati',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.519055, lng: 73.857142 },
    walkM: 1835 },
  // x1.6 the straight line
  { from: 'navjavan-mandal', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.515811, lng: 73.849008 },
    walkM: 531 },
  // x1.2 the straight line
  { from: 'navjavan-mandal', to: 'mati-ganpati',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.5159, lng: 73.8468 },
    walkM: 474 },
  // x1.4 the straight line
  { from: 'navjavan-mandal', to: 'natu-baug-mandal',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.510703, lng: 73.853821 },
    walkM: 804 },
  // x1.3 the straight line
  { from: 'navjavan-mandal', to: 'nimbalkar-talim-mandal',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.5119, lng: 73.8522 },
    walkM: 509 },
  // x1.1 the straight line
  { from: 'navjavan-mandal', to: 'perugate-bhave-mandal',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.509777, lng: 73.84944 },
    walkM: 397 },
  // x1.3 the straight line
  { from: 'navjavan-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.5188, lng: 73.8571 },
    walkM: 1460 },
  // x1.2 the straight line
  { from: 'navjavan-mandal', to: 'sarasbaug-ganpati',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.500881, lng: 73.85295 },
    walkM: 1639 },
  // x1.3 the straight line
  { from: 'navjavan-mandal', to: 'seva-mitra-mandal',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.5086563388099, lng: 73.8575649915299 },
    walkM: 1408 },
  // x1.2 the straight line
  { from: 'navjavan-mandal', to: 'shanipar-mandal',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.512619, lng: 73.852601 },
    walkM: 492 },
  // x1.3 the straight line
  { from: 'navjavan-mandal', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.51662, lng: 73.854894 },
    walkM: 1007 },
  // x1.4 the straight line
  { from: 'navjavan-mandal', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.5217, lng: 73.8619 },
    walkM: 2393 },
  // x1.3 the straight line
  { from: 'navjavan-mandal', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.514268, lng: 73.855306 },
    walkM: 916 },
  // x1.0 the straight line
  { from: 'nimbalkar-talim-mandal', to: 'akhil-mandai-mandal',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.511852, lng: 73.856135 },
    walkM: 415 },
  // x1.2 the straight line
  { from: 'nimbalkar-talim-mandal', to: 'balvikas-mandal',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    walkM: 826 },
  // x1.3 the straight line
  { from: 'nimbalkar-talim-mandal', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.517583, lng: 73.855362 },
    walkM: 896 },
  // x1.2 the straight line
  { from: 'nimbalkar-talim-mandal', to: 'chhatrapati-rajaram-mandal',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.512444, lng: 73.847482 },
    walkM: 600 },
  // x1.0 the straight line
  { from: 'nimbalkar-talim-mandal', to: 'chimnya-ganpati',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.5111804596016, lng: 73.8521904497267 },
    walkM: 78 },
  // x1.3 the straight line
  { from: 'nimbalkar-talim-mandal', to: 'chinchechi-talim-ganpati',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.5086, lng: 73.8555 },
    walkM: 679 },
  // x1.9 the straight line
  { from: 'nimbalkar-talim-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.51514, lng: 73.856379 },
    walkM: 1109 },
  // x1.3 the straight line
  { from: 'nimbalkar-talim-mandal', to: 'garud-ganpati-mandal',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.5137, lng: 73.8456 },
    walkM: 965 },
  // x1.2 the straight line
  { from: 'nimbalkar-talim-mandal', to: 'guruji-talim',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.514997, lng: 73.854992 },
    walkM: 565 },
  // x1.0 the straight line
  { from: 'nimbalkar-talim-mandal', to: 'hatti-ganpati-mandal',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.511223, lng: 73.845858 },
    walkM: 664 },
  // x1.2 the straight line
  { from: 'nimbalkar-talim-mandal', to: 'hira-bagh-mandal',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.5042217511876, lng: 73.8557645094566 },
    walkM: 1101 },
  // x1.5 the straight line
  { from: 'nimbalkar-talim-mandal', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    walkM: 1305 },
  // x1.7 the straight line
  { from: 'nimbalkar-talim-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.51389, lng: 73.856342 },
    walkM: 834 },
  // x1.4 the straight line
  { from: 'nimbalkar-talim-mandal', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.513319, lng: 73.854938 },
    walkM: 445 },
  // x1.6 the straight line
  { from: 'nimbalkar-talim-mandal', to: 'kasba-ganpati',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.519055, lng: 73.857142 },
    walkM: 1522 },
  // x1.5 the straight line
  { from: 'nimbalkar-talim-mandal', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.515811, lng: 73.849008 },
    walkM: 810 },
  // x1.4 the straight line
  { from: 'nimbalkar-talim-mandal', to: 'mati-ganpati',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.5159, lng: 73.8468 },
    walkM: 979 },
  // x1.4 the straight line
  { from: 'nimbalkar-talim-mandal', to: 'natu-baug-mandal',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.510703, lng: 73.853821 },
    walkM: 297 },
  // x1.3 the straight line
  { from: 'nimbalkar-talim-mandal', to: 'navjavan-mandal',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.512919576416, lng: 73.8487282111353 },
    walkM: 509 },
  // x1.6 the straight line
  { from: 'nimbalkar-talim-mandal', to: 'perugate-bhave-mandal',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.509777, lng: 73.84944 },
    walkM: 605 },
  // x1.3 the straight line
  { from: 'nimbalkar-talim-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.5188, lng: 73.8571 },
    walkM: 1197 },
  // x1.2 the straight line
  { from: 'nimbalkar-talim-mandal', to: 'sarasbaug-ganpati',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.500881, lng: 73.85295 },
    walkM: 1416 },
  // x1.4 the straight line
  { from: 'nimbalkar-talim-mandal', to: 'seva-mitra-mandal',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.5086563388099, lng: 73.8575649915299 },
    walkM: 911 },
  // x1.5 the straight line
  { from: 'nimbalkar-talim-mandal', to: 'shanipar-mandal',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.512619, lng: 73.852601 },
    walkM: 133 },
  // x1.2 the straight line
  { from: 'nimbalkar-talim-mandal', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.51662, lng: 73.854894 },
    walkM: 744 },
  // x1.4 the straight line
  { from: 'nimbalkar-talim-mandal', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.5217, lng: 73.8619 },
    walkM: 2080 },
  // x1.7 the straight line
  { from: 'nimbalkar-talim-mandal', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.514268, lng: 73.855306 },
    walkM: 715 },
  // x1.4 the straight line
  { from: 'perugate-bhave-mandal', to: 'akhil-mandai-mandal',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.511852, lng: 73.856135 },
    walkM: 1004 },
  // x1.4 the straight line
  { from: 'perugate-bhave-mandal', to: 'balvikas-mandal',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    walkM: 1415 },
  // x1.4 the straight line
  { from: 'perugate-bhave-mandal', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.517583, lng: 73.855362 },
    walkM: 1485 },
  // x1.3 the straight line
  { from: 'perugate-bhave-mandal', to: 'chhatrapati-rajaram-mandal',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.512444, lng: 73.847482 },
    walkM: 475 },
  // x1.6 the straight line
  { from: 'perugate-bhave-mandal', to: 'chimnya-ganpati',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.5111804596016, lng: 73.8521904497267 },
    walkM: 521 },
  // x1.4 the straight line
  { from: 'perugate-bhave-mandal', to: 'chinchechi-talim-ganpati',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.5086, lng: 73.8555 },
    walkM: 939 },
  // x2.0 the straight line
  { from: 'perugate-bhave-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.51514, lng: 73.856379 },
    walkM: 1887 },
  // x1.4 the straight line
  { from: 'perugate-bhave-mandal', to: 'garud-ganpati-mandal',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.5137, lng: 73.8456 },
    walkM: 812 },
  // x1.4 the straight line
  { from: 'perugate-bhave-mandal', to: 'guruji-talim',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.514997, lng: 73.854992 },
    walkM: 1154 },
  // x1.2 the straight line
  { from: 'perugate-bhave-mandal', to: 'hatti-ganpati-mandal',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.511223, lng: 73.845858 },
    walkM: 508 },
  // x1.2 the straight line
  { from: 'perugate-bhave-mandal', to: 'hira-bagh-mandal',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.5042217511876, lng: 73.8557645094566 },
    walkM: 1081 },
  // x1.7 the straight line
  { from: 'perugate-bhave-mandal', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    walkM: 2085 },
  // x1.7 the straight line
  { from: 'perugate-bhave-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.51389, lng: 73.856342 },
    walkM: 1428 },
  // x1.4 the straight line
  { from: 'perugate-bhave-mandal', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.513319, lng: 73.854938 },
    walkM: 989 },
  // x1.6 the straight line
  { from: 'perugate-bhave-mandal', to: 'kasba-ganpati',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.519055, lng: 73.857142 },
    walkM: 2066 },
  // x1.4 the straight line
  { from: 'perugate-bhave-mandal', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.515811, lng: 73.849008 },
    walkM: 928 },
  // x1.2 the straight line
  { from: 'perugate-bhave-mandal', to: 'mati-ganpati',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.5159, lng: 73.8468 },
    walkM: 871 },
  // x1.6 the straight line
  { from: 'perugate-bhave-mandal', to: 'natu-baug-mandal',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.510703, lng: 73.853821 },
    walkM: 750 },
  // x1.1 the straight line
  { from: 'perugate-bhave-mandal', to: 'navjavan-mandal',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.512919576416, lng: 73.8487282111353 },
    walkM: 397 },
  // x1.6 the straight line
  { from: 'perugate-bhave-mandal', to: 'nimbalkar-talim-mandal',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.5119, lng: 73.8522 },
    walkM: 599 },
  // x1.4 the straight line
  { from: 'perugate-bhave-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.5188, lng: 73.8571 },
    walkM: 1790 },
  // x1.3 the straight line
  { from: 'perugate-bhave-mandal', to: 'sarasbaug-ganpati',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.500881, lng: 73.85295 },
    walkM: 1356 },
  // x1.3 the straight line
  { from: 'perugate-bhave-mandal', to: 'seva-mitra-mandal',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.5086563388099, lng: 73.8575649915299 },
    walkM: 1133 },
  // x1.6 the straight line
  { from: 'perugate-bhave-mandal', to: 'shanipar-mandal',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.512619, lng: 73.852601 },
    walkM: 722 },
  // x1.4 the straight line
  { from: 'perugate-bhave-mandal', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.51662, lng: 73.854894 },
    walkM: 1332 },
  // x1.4 the straight line
  { from: 'perugate-bhave-mandal', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.5217, lng: 73.8619 },
    walkM: 2625 },
  // x1.6 the straight line
  { from: 'perugate-bhave-mandal', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.514268, lng: 73.855306 },
    walkM: 1311 },
  // x1.2 the straight line
  { from: 'phani-ali-ganesh-mandir', to: 'akhil-mandai-mandal',
    fromAt: { lat: 18.5188, lng: 73.8571 }, toAt: { lat: 18.511852, lng: 73.856135 },
    walkM: 904 },
  // x1.5 the straight line
  { from: 'phani-ali-ganesh-mandir', to: 'balvikas-mandal',
    fromAt: { lat: 18.5188, lng: 73.8571 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    walkM: 405 },
  // x1.5 the straight line
  { from: 'phani-ali-ganesh-mandir', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.5188, lng: 73.8571 }, toAt: { lat: 18.517583, lng: 73.855362 },
    walkM: 335 },
  // x1.3 the straight line
  { from: 'phani-ali-ganesh-mandir', to: 'chhatrapati-rajaram-mandal',
    fromAt: { lat: 18.5188, lng: 73.8571 }, toAt: { lat: 18.512444, lng: 73.847482 },
    walkM: 1590 },
  // x1.2 the straight line
  { from: 'phani-ali-ganesh-mandir', to: 'chimnya-ganpati',
    fromAt: { lat: 18.5188, lng: 73.8571 }, toAt: { lat: 18.5111804596016, lng: 73.8521904497267 },
    walkM: 1225 },
  // x1.3 the straight line
  { from: 'phani-ali-ganesh-mandir', to: 'chinchechi-talim-ganpati',
    fromAt: { lat: 18.5188, lng: 73.8571 }, toAt: { lat: 18.5086, lng: 73.8555 },
    walkM: 1439 },
  // x1.2 the straight line
  { from: 'phani-ali-ganesh-mandir', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.5188, lng: 73.8571 }, toAt: { lat: 18.51514, lng: 73.856379 },
    walkM: 499 },
  // x1.3 the straight line
  { from: 'phani-ali-ganesh-mandir', to: 'garud-ganpati-mandal',
    fromAt: { lat: 18.5188, lng: 73.8571 }, toAt: { lat: 18.5137, lng: 73.8456 },
    walkM: 1677 },
  // x1.2 the straight line
  { from: 'phani-ali-ganesh-mandir', to: 'guruji-talim',
    fromAt: { lat: 18.5188, lng: 73.8571 }, toAt: { lat: 18.514997, lng: 73.854992 },
    walkM: 592 },
  // x1.2 the straight line
  { from: 'phani-ali-ganesh-mandir', to: 'hatti-ganpati-mandal',
    fromAt: { lat: 18.5188, lng: 73.8571 }, toAt: { lat: 18.511223, lng: 73.845858 },
    walkM: 1814 },
  // x1.2 the straight line
  { from: 'phani-ali-ganesh-mandir', to: 'hira-bagh-mandal',
    fromAt: { lat: 18.5188, lng: 73.8571 }, toAt: { lat: 18.5042217511876, lng: 73.8557645094566 },
    walkM: 1968 },
  // x1.4 the straight line
  { from: 'phani-ali-ganesh-mandir', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.5188, lng: 73.8571 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    walkM: 590 },
  // x1.1 the straight line
  { from: 'phani-ali-ganesh-mandir', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.5188, lng: 73.8571 }, toAt: { lat: 18.51389, lng: 73.856342 },
    walkM: 633 },
  // x1.5 the straight line
  { from: 'phani-ali-ganesh-mandir', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.5188, lng: 73.8571 }, toAt: { lat: 18.513319, lng: 73.854938 },
    walkM: 957 },
  // x1.6 the straight line
  { from: 'phani-ali-ganesh-mandir', to: 'kasba-ganpati',
    fromAt: { lat: 18.5188, lng: 73.8571 }, toAt: { lat: 18.519055, lng: 73.857142 },
    walkM: 47 },
  // x1.2 the straight line
  { from: 'phani-ali-ganesh-mandir', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.5188, lng: 73.8571 }, toAt: { lat: 18.515811, lng: 73.849008 },
    walkM: 1083 },
  // x1.2 the straight line
  { from: 'phani-ali-ganesh-mandir', to: 'mati-ganpati',
    fromAt: { lat: 18.5188, lng: 73.8571 }, toAt: { lat: 18.5159, lng: 73.8468 },
    walkM: 1315 },
  // x1.2 the straight line
  { from: 'phani-ali-ganesh-mandir', to: 'natu-baug-mandal',
    fromAt: { lat: 18.5188, lng: 73.8571 }, toAt: { lat: 18.510703, lng: 73.853821 },
    walkM: 1161 },
  // x1.3 the straight line
  { from: 'phani-ali-ganesh-mandir', to: 'navjavan-mandal',
    fromAt: { lat: 18.5188, lng: 73.8571 }, toAt: { lat: 18.512919576416, lng: 73.8487282111353 },
    walkM: 1421 },
  // x1.3 the straight line
  { from: 'phani-ali-ganesh-mandir', to: 'nimbalkar-talim-mandal',
    fromAt: { lat: 18.5188, lng: 73.8571 }, toAt: { lat: 18.5119, lng: 73.8522 },
    walkM: 1158 },
  // x1.4 the straight line
  { from: 'phani-ali-ganesh-mandir', to: 'perugate-bhave-mandal',
    fromAt: { lat: 18.5188, lng: 73.8571 }, toAt: { lat: 18.509777, lng: 73.84944 },
    walkM: 1764 },
  // x1.2 the straight line
  { from: 'phani-ali-ganesh-mandir', to: 'sarasbaug-ganpati',
    fromAt: { lat: 18.5188, lng: 73.8571 }, toAt: { lat: 18.500881, lng: 73.85295 },
    walkM: 2354 },
  // x1.1 the straight line
  { from: 'phani-ali-ganesh-mandir', to: 'seva-mitra-mandal',
    fromAt: { lat: 18.5188, lng: 73.8571 }, toAt: { lat: 18.5086563388099, lng: 73.8575649915299 },
    walkM: 1287 },
  // x1.2 the straight line
  { from: 'phani-ali-ganesh-mandir', to: 'shanipar-mandal',
    fromAt: { lat: 18.5188, lng: 73.8571 }, toAt: { lat: 18.512619, lng: 73.852601 },
    walkM: 1024 },
  // x1.4 the straight line
  { from: 'phani-ali-ganesh-mandir', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.5188, lng: 73.8571 }, toAt: { lat: 18.51662, lng: 73.854894 },
    walkM: 468 },
  // x1.4 the straight line
  { from: 'phani-ali-ganesh-mandir', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.5188, lng: 73.8571 }, toAt: { lat: 18.5217, lng: 73.8619 },
    walkM: 820 },
  // x1.3 the straight line
  { from: 'phani-ali-ganesh-mandir', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.5188, lng: 73.8571 }, toAt: { lat: 18.514268, lng: 73.855306 },
    walkM: 682 },
  // x1.2 the straight line
  { from: 'sarasbaug-ganpati', to: 'akhil-mandai-mandal',
    fromAt: { lat: 18.500881, lng: 73.85295 }, toAt: { lat: 18.511852, lng: 73.856135 },
    walkM: 1555 },
  // x1.1 the straight line
  { from: 'sarasbaug-ganpati', to: 'balvikas-mandal',
    fromAt: { lat: 18.500881, lng: 73.85295 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    walkM: 2024 },
  // x1.1 the straight line
  { from: 'sarasbaug-ganpati', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.500881, lng: 73.85295 }, toAt: { lat: 18.517583, lng: 73.855362 },
    walkM: 2093 },
  // x1.2 the straight line
  { from: 'sarasbaug-ganpati', to: 'chhatrapati-rajaram-mandal',
    fromAt: { lat: 18.500881, lng: 73.85295 }, toAt: { lat: 18.512444, lng: 73.847482 },
    walkM: 1748 },
  // x1.2 the straight line
  { from: 'sarasbaug-ganpati', to: 'chimnya-ganpati',
    fromAt: { lat: 18.500881, lng: 73.85295 }, toAt: { lat: 18.5111804596016, lng: 73.8521904497267 },
    walkM: 1339 },
  // x1.3 the straight line
  { from: 'sarasbaug-ganpati', to: 'chinchechi-talim-ganpati',
    fromAt: { lat: 18.500881, lng: 73.85295 }, toAt: { lat: 18.5086, lng: 73.8555 },
    walkM: 1162 },
  // x1.2 the straight line
  { from: 'sarasbaug-ganpati', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.500881, lng: 73.85295 }, toAt: { lat: 18.51514, lng: 73.856379 },
    walkM: 1933 },
  // x1.2 the straight line
  { from: 'sarasbaug-ganpati', to: 'garud-ganpati-mandal',
    fromAt: { lat: 18.500881, lng: 73.85295 }, toAt: { lat: 18.5137, lng: 73.8456 },
    walkM: 1958 },
  // x1.1 the straight line
  { from: 'sarasbaug-ganpati', to: 'guruji-talim',
    fromAt: { lat: 18.500881, lng: 73.85295 }, toAt: { lat: 18.514997, lng: 73.854992 },
    walkM: 1763 },
  // x1.2 the straight line
  { from: 'sarasbaug-ganpati', to: 'hatti-ganpati-mandal',
    fromAt: { lat: 18.500881, lng: 73.85295 }, toAt: { lat: 18.511223, lng: 73.845858 },
    walkM: 1654 },
  // x1.4 the straight line
  { from: 'sarasbaug-ganpati', to: 'hira-bagh-mandal',
    fromAt: { lat: 18.500881, lng: 73.85295 }, toAt: { lat: 18.5042217511876, lng: 73.8557645094566 },
    walkM: 681 },
  // x1.3 the straight line
  { from: 'sarasbaug-ganpati', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.500881, lng: 73.85295 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    walkM: 2313 },
  // x1.2 the straight line
  { from: 'sarasbaug-ganpati', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.500881, lng: 73.85295 }, toAt: { lat: 18.51389, lng: 73.856342 },
    walkM: 1787 },
  // x1.1 the straight line
  { from: 'sarasbaug-ganpati', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.500881, lng: 73.85295 }, toAt: { lat: 18.513319, lng: 73.854938 },
    walkM: 1597 },
  // x1.3 the straight line
  { from: 'sarasbaug-ganpati', to: 'kasba-ganpati',
    fromAt: { lat: 18.500881, lng: 73.85295 }, toAt: { lat: 18.519055, lng: 73.857142 },
    walkM: 2674 },
  // x1.2 the straight line
  { from: 'sarasbaug-ganpati', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.500881, lng: 73.85295 }, toAt: { lat: 18.515811, lng: 73.849008 },
    walkM: 2072 },
  // x1.2 the straight line
  { from: 'sarasbaug-ganpati', to: 'mati-ganpati',
    fromAt: { lat: 18.500881, lng: 73.85295 }, toAt: { lat: 18.5159, lng: 73.8468 },
    walkM: 2144 },
  // x1.1 the straight line
  { from: 'sarasbaug-ganpati', to: 'natu-baug-mandal',
    fromAt: { lat: 18.500881, lng: 73.85295 }, toAt: { lat: 18.510703, lng: 73.853821 },
    walkM: 1193 },
  // x1.2 the straight line
  { from: 'sarasbaug-ganpati', to: 'navjavan-mandal',
    fromAt: { lat: 18.500881, lng: 73.85295 }, toAt: { lat: 18.512919576416, lng: 73.8487282111353 },
    walkM: 1670 },
  // x1.2 the straight line
  { from: 'sarasbaug-ganpati', to: 'nimbalkar-talim-mandal',
    fromAt: { lat: 18.500881, lng: 73.85295 }, toAt: { lat: 18.5119, lng: 73.8522 },
    walkM: 1417 },
  // x1.3 the straight line
  { from: 'sarasbaug-ganpati', to: 'perugate-bhave-mandal',
    fromAt: { lat: 18.500881, lng: 73.85295 }, toAt: { lat: 18.509777, lng: 73.84944 },
    walkM: 1387 },
  // x1.2 the straight line
  { from: 'sarasbaug-ganpati', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.500881, lng: 73.85295 }, toAt: { lat: 18.5188, lng: 73.8571 },
    walkM: 2354 },
  // x1.4 the straight line
  { from: 'sarasbaug-ganpati', to: 'seva-mitra-mandal',
    fromAt: { lat: 18.500881, lng: 73.85295 }, toAt: { lat: 18.5086563388099, lng: 73.8575649915299 },
    walkM: 1359 },
  // x1.2 the straight line
  { from: 'sarasbaug-ganpati', to: 'shanipar-mandal',
    fromAt: { lat: 18.500881, lng: 73.85295 }, toAt: { lat: 18.512619, lng: 73.852601 },
    walkM: 1539 },
  // x1.1 the straight line
  { from: 'sarasbaug-ganpati', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.500881, lng: 73.85295 }, toAt: { lat: 18.51662, lng: 73.854894 },
    walkM: 1941 },
  // x1.3 the straight line
  { from: 'sarasbaug-ganpati', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.500881, lng: 73.85295 }, toAt: { lat: 18.5217, lng: 73.8619 },
    walkM: 3226 },
  // x1.4 the straight line
  { from: 'sarasbaug-ganpati', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.500881, lng: 73.85295 }, toAt: { lat: 18.514268, lng: 73.855306 },
    walkM: 2140 },
  // x1.4 the straight line
  { from: 'seva-mitra-mandal', to: 'akhil-mandai-mandal',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.511852, lng: 73.856135 },
    walkM: 546 },
  // x1.4 the straight line
  { from: 'seva-mitra-mandal', to: 'balvikas-mandal',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    walkM: 1457 },
  // x1.5 the straight line
  { from: 'seva-mitra-mandal', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.517583, lng: 73.855362 },
    walkM: 1527 },
  // x1.3 the straight line
  { from: 'seva-mitra-mandal', to: 'chhatrapati-rajaram-mandal',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.512444, lng: 73.847482 },
    walkM: 1495 },
  // x1.3 the straight line
  { from: 'seva-mitra-mandal', to: 'chimnya-ganpati',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.5111804596016, lng: 73.8521904497267 },
    walkM: 847 },
  // x1.2 the straight line
  { from: 'seva-mitra-mandal', to: 'chinchechi-talim-ganpati',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.5086, lng: 73.8555 },
    walkM: 259 },
  // x1.1 the straight line
  { from: 'seva-mitra-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.51514, lng: 73.856379 },
    walkM: 796 },
  // x1.2 the straight line
  { from: 'seva-mitra-mandal', to: 'garud-ganpati-mandal',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.5137, lng: 73.8456 },
    walkM: 1705 },
  // x1.6 the straight line
  { from: 'seva-mitra-mandal', to: 'guruji-talim',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.514997, lng: 73.854992 },
    walkM: 1196 },
  // x1.1 the straight line
  { from: 'seva-mitra-mandal', to: 'hatti-ganpati-mandal',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.511223, lng: 73.845858 },
    walkM: 1400 },
  // x1.3 the straight line
  { from: 'seva-mitra-mandal', to: 'hira-bagh-mandal',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.5042217511876, lng: 73.8557645094566 },
    walkM: 680 },
  // x1.2 the straight line
  { from: 'seva-mitra-mandal', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    walkM: 944 },
  // x2.4 the straight line
  { from: 'seva-mitra-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.51389, lng: 73.856342 },
    walkM: 1428 },
  // x1.4 the straight line
  { from: 'seva-mitra-mandal', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.513319, lng: 73.854938 },
    walkM: 818 },
  // x1.4 the straight line
  { from: 'seva-mitra-mandal', to: 'kasba-ganpati',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.519055, lng: 73.857142 },
    walkM: 1570 },
  // x1.4 the straight line
  { from: 'seva-mitra-mandal', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.515811, lng: 73.849008 },
    walkM: 1721 },
  // x1.4 the straight line
  { from: 'seva-mitra-mandal', to: 'mati-ganpati',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.5159, lng: 73.8468 },
    walkM: 1891 },
  // x1.4 the straight line
  { from: 'seva-mitra-mandal', to: 'natu-baug-mandal',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.510703, lng: 73.853821 },
    walkM: 657 },
  // x1.4 the straight line
  { from: 'seva-mitra-mandal', to: 'navjavan-mandal',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.512919576416, lng: 73.8487282111353 },
    walkM: 1416 },
  // x1.4 the straight line
  { from: 'seva-mitra-mandal', to: 'nimbalkar-talim-mandal',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.5119, lng: 73.8522 },
    walkM: 925 },
  // x1.3 the straight line
  { from: 'seva-mitra-mandal', to: 'perugate-bhave-mandal',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.509777, lng: 73.84944 },
    walkM: 1133 },
  // x1.4 the straight line
  { from: 'seva-mitra-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.5188, lng: 73.8571 },
    walkM: 1540 },
  // x1.4 the straight line
  { from: 'seva-mitra-mandal', to: 'sarasbaug-ganpati',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.500881, lng: 73.85295 },
    walkM: 1356 },
  // x1.5 the straight line
  { from: 'seva-mitra-mandal', to: 'shanipar-mandal',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.512619, lng: 73.852601 },
    walkM: 1030 },
  // x1.5 the straight line
  { from: 'seva-mitra-mandal', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.51662, lng: 73.854894 },
    walkM: 1393 },
  // x1.2 the straight line
  { from: 'seva-mitra-mandal', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.5217, lng: 73.8619 },
    walkM: 1867 },
  // x1.9 the straight line
  { from: 'seva-mitra-mandal', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.514268, lng: 73.855306 },
    walkM: 1282 },
  // x1.3 the straight line
  { from: 'shanipar-mandal', to: 'akhil-mandai-mandal',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.511852, lng: 73.856135 },
    walkM: 509 },
  // x1.2 the straight line
  { from: 'shanipar-mandal', to: 'balvikas-mandal',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    walkM: 692 },
  // x1.2 the straight line
  { from: 'shanipar-mandal', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.517583, lng: 73.855362 },
    walkM: 763 },
  // x1.1 the straight line
  { from: 'shanipar-mandal', to: 'chhatrapati-rajaram-mandal',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.512444, lng: 73.847482 },
    walkM: 583 },
  // x1.2 the straight line
  { from: 'shanipar-mandal', to: 'chimnya-ganpati',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.5111804596016, lng: 73.8521904497267 },
    walkM: 201 },
  // x1.4 the straight line
  { from: 'shanipar-mandal', to: 'chinchechi-talim-ganpati',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.5086, lng: 73.8555 },
    walkM: 771 },
  // x2.0 the straight line
  { from: 'shanipar-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.51514, lng: 73.856379 },
    walkM: 975 },
  // x1.3 the straight line
  { from: 'shanipar-mandal', to: 'garud-ganpati-mandal',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.5137, lng: 73.8456 },
    walkM: 948 },
  // x1.2 the straight line
  { from: 'shanipar-mandal', to: 'guruji-talim',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.514997, lng: 73.854992 },
    walkM: 431 },
  // x1.1 the straight line
  { from: 'shanipar-mandal', to: 'hatti-ganpati-mandal',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.511223, lng: 73.845858 },
    walkM: 790 },
  // x1.2 the straight line
  { from: 'shanipar-mandal', to: 'hira-bagh-mandal',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.5042217511876, lng: 73.8557645094566 },
    walkM: 1224 },
  // x1.6 the straight line
  { from: 'shanipar-mandal', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    walkM: 1283 },
  // x1.7 the straight line
  { from: 'shanipar-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.51389, lng: 73.856342 },
    walkM: 700 },
  // x1.0 the straight line
  { from: 'shanipar-mandal', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.513319, lng: 73.854938 },
    walkM: 267 },
  // x1.6 the straight line
  { from: 'shanipar-mandal', to: 'kasba-ganpati',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.519055, lng: 73.857142 },
    walkM: 1344 },
  // x1.5 the straight line
  { from: 'shanipar-mandal', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.515811, lng: 73.849008 },
    walkM: 773 },
  // x1.3 the straight line
  { from: 'shanipar-mandal', to: 'mati-ganpati',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.5159, lng: 73.8468 },
    walkM: 949 },
  // x1.6 the straight line
  { from: 'shanipar-mandal', to: 'natu-baug-mandal',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.510703, lng: 73.853821 },
    walkM: 402 },
  // x1.2 the straight line
  { from: 'shanipar-mandal', to: 'navjavan-mandal',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.512919576416, lng: 73.8487282111353 },
    walkM: 501 },
  // x1.5 the straight line
  { from: 'shanipar-mandal', to: 'nimbalkar-talim-mandal',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.5119, lng: 73.8522 },
    walkM: 133 },
  // x1.6 the straight line
  { from: 'shanipar-mandal', to: 'perugate-bhave-mandal',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.509777, lng: 73.84944 },
    walkM: 740 },
  // x1.3 the straight line
  { from: 'shanipar-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.5188, lng: 73.8571 },
    walkM: 1063 },
  // x1.2 the straight line
  { from: 'shanipar-mandal', to: 'sarasbaug-ganpati',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.500881, lng: 73.85295 },
    walkM: 1539 },
  // x1.5 the straight line
  { from: 'shanipar-mandal', to: 'seva-mitra-mandal',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.5086563388099, lng: 73.8575649915299 },
    walkM: 1030 },
  // x1.2 the straight line
  { from: 'shanipar-mandal', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.51662, lng: 73.854894 },
    walkM: 610 },
  // x1.4 the straight line
  { from: 'shanipar-mandal', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.5217, lng: 73.8619 },
    walkM: 1902 },
  // x1.7 the straight line
  { from: 'shanipar-mandal', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.514268, lng: 73.855306 },
    walkM: 588 },
  // x1.2 the straight line
  { from: 'tambdi-jogeshwari', to: 'akhil-mandai-mandal',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.511852, lng: 73.856135 },
    walkM: 662 },
  // x1.0 the straight line
  { from: 'tambdi-jogeshwari', to: 'balvikas-mandal',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    walkM: 96 },
  // x1.4 the straight line
  { from: 'tambdi-jogeshwari', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.517583, lng: 73.855362 },
    walkM: 166 },
  // x1.3 the straight line
  { from: 'tambdi-jogeshwari', to: 'chhatrapati-rajaram-mandal',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.512444, lng: 73.847482 },
    walkM: 1176 },
  // x1.2 the straight line
  { from: 'tambdi-jogeshwari', to: 'chimnya-ganpati',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.5111804596016, lng: 73.8521904497267 },
    walkM: 811 },
  // x1.0 the straight line
  { from: 'tambdi-jogeshwari', to: 'chinchechi-talim-ganpati',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.5086, lng: 73.8555 },
    walkM: 923 },
  // x1.4 the straight line
  { from: 'tambdi-jogeshwari', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.51514, lng: 73.856379 },
    walkM: 312 },
  // x1.2 the straight line
  { from: 'tambdi-jogeshwari', to: 'garud-ganpati-mandal',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.5137, lng: 73.8456 },
    walkM: 1199 },
  // x1.0 the straight line
  { from: 'tambdi-jogeshwari', to: 'guruji-talim',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.514997, lng: 73.854992 },
    walkM: 178 },
  // x1.2 the straight line
  { from: 'tambdi-jogeshwari', to: 'hatti-ganpati-mandal',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.511223, lng: 73.845858 },
    walkM: 1400 },
  // x1.2 the straight line
  { from: 'tambdi-jogeshwari', to: 'hira-bagh-mandal',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.5042217511876, lng: 73.8557645094566 },
    walkM: 1626 },
  // x1.2 the straight line
  { from: 'tambdi-jogeshwari', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    walkM: 593 },
  // x1.3 the straight line
  { from: 'tambdi-jogeshwari', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.51389, lng: 73.856342 },
    walkM: 447 },
  // x1.1 the straight line
  { from: 'tambdi-jogeshwari', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.513319, lng: 73.854938 },
    walkM: 401 },
  // x4.0 the straight line
  { from: 'tambdi-jogeshwari', to: 'kasba-ganpati',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.519055, lng: 73.857142 },
    walkM: 1425 },
  // x1.0 the straight line
  { from: 'tambdi-jogeshwari', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.515811, lng: 73.849008 },
    walkM: 646 },
  // x1.0 the straight line
  { from: 'tambdi-jogeshwari', to: 'mati-ganpati',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.5159, lng: 73.8468 },
    walkM: 878 },
  // x1.1 the straight line
  { from: 'tambdi-jogeshwari', to: 'natu-baug-mandal',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.510703, lng: 73.853821 },
    walkM: 747 },
  // x1.3 the straight line
  { from: 'tambdi-jogeshwari', to: 'navjavan-mandal',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.512919576416, lng: 73.8487282111353 },
    walkM: 1007 },
  // x1.2 the straight line
  { from: 'tambdi-jogeshwari', to: 'nimbalkar-talim-mandal',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.5119, lng: 73.8522 },
    walkM: 744 },
  // x1.4 the straight line
  { from: 'tambdi-jogeshwari', to: 'perugate-bhave-mandal',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.509777, lng: 73.84944 },
    walkM: 1350 },
  // x1.6 the straight line
  { from: 'tambdi-jogeshwari', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.5188, lng: 73.8571 },
    walkM: 543 },
  // x1.1 the straight line
  { from: 'tambdi-jogeshwari', to: 'sarasbaug-ganpati',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.500881, lng: 73.85295 },
    walkM: 1940 },
  // x1.2 the straight line
  { from: 'tambdi-jogeshwari', to: 'seva-mitra-mandal',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.5086563388099, lng: 73.8575649915299 },
    walkM: 1099 },
  // x1.2 the straight line
  { from: 'tambdi-jogeshwari', to: 'shanipar-mandal',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.512619, lng: 73.852601 },
    walkM: 610 },
  // x2.1 the straight line
  { from: 'tambdi-jogeshwari', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.5217, lng: 73.8619 },
    walkM: 1983 },
  // x1.0 the straight line
  { from: 'tambdi-jogeshwari', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.514268, lng: 73.855306 },
    walkM: 264 },
  // x1.3 the straight line
  { from: 'trishund-ganpati-mandir', to: 'akhil-mandai-mandal',
    fromAt: { lat: 18.5217, lng: 73.8619 }, toAt: { lat: 18.511852, lng: 73.856135 },
    walkM: 1661 },
  // x1.3 the straight line
  { from: 'trishund-ganpati-mandir', to: 'balvikas-mandal',
    fromAt: { lat: 18.5217, lng: 73.8619 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    walkM: 1161 },
  // x1.3 the straight line
  { from: 'trishund-ganpati-mandir', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.5217, lng: 73.8619 }, toAt: { lat: 18.517583, lng: 73.855362 },
    walkM: 1091 },
  // x1.3 the straight line
  { from: 'trishund-ganpati-mandir', to: 'chhatrapati-rajaram-mandal',
    fromAt: { lat: 18.5217, lng: 73.8619 }, toAt: { lat: 18.512444, lng: 73.847482 },
    walkM: 2348 },
  // x1.3 the straight line
  { from: 'trishund-ganpati-mandir', to: 'chimnya-ganpati',
    fromAt: { lat: 18.5217, lng: 73.8619 }, toAt: { lat: 18.5111804596016, lng: 73.8521904497267 },
    walkM: 1982 },
  // x1.3 the straight line
  { from: 'trishund-ganpati-mandir', to: 'chinchechi-talim-ganpati',
    fromAt: { lat: 18.5217, lng: 73.8619 }, toAt: { lat: 18.5086, lng: 73.8555 },
    walkM: 2081 },
  // x1.3 the straight line
  { from: 'trishund-ganpati-mandir', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.5217, lng: 73.8619 }, toAt: { lat: 18.51514, lng: 73.856379 },
    walkM: 1257 },
  // x1.3 the straight line
  { from: 'trishund-ganpati-mandir', to: 'garud-ganpati-mandal',
    fromAt: { lat: 18.5217, lng: 73.8619 }, toAt: { lat: 18.5137, lng: 73.8456 },
    walkM: 2434 },
  // x1.3 the straight line
  { from: 'trishund-ganpati-mandir', to: 'guruji-talim',
    fromAt: { lat: 18.5217, lng: 73.8619 }, toAt: { lat: 18.514997, lng: 73.854992 },
    walkM: 1350 },
  // x1.3 the straight line
  { from: 'trishund-ganpati-mandir', to: 'hatti-ganpati-mandal',
    fromAt: { lat: 18.5217, lng: 73.8619 }, toAt: { lat: 18.511223, lng: 73.845858 },
    walkM: 2572 },
  // x1.2 the straight line
  { from: 'trishund-ganpati-mandir', to: 'hira-bagh-mandal',
    fromAt: { lat: 18.5217, lng: 73.8619 }, toAt: { lat: 18.5042217511876, lng: 73.8557645094566 },
    walkM: 2535 },
  // x1.3 the straight line
  { from: 'trishund-ganpati-mandir', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.5217, lng: 73.8619 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    walkM: 942 },
  // x1.3 the straight line
  { from: 'trishund-ganpati-mandir', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.5217, lng: 73.8619 }, toAt: { lat: 18.51389, lng: 73.856342 },
    walkM: 1390 },
  // x1.4 the straight line
  { from: 'trishund-ganpati-mandir', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.5217, lng: 73.8619 }, toAt: { lat: 18.513319, lng: 73.854938 },
    walkM: 1656 },
  // x1.4 the straight line
  { from: 'trishund-ganpati-mandir', to: 'kasba-ganpati',
    fromAt: { lat: 18.5217, lng: 73.8619 }, toAt: { lat: 18.519055, lng: 73.857142 },
    walkM: 802 },
  // x1.2 the straight line
  { from: 'trishund-ganpati-mandir', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.5217, lng: 73.8619 }, toAt: { lat: 18.515811, lng: 73.849008 },
    walkM: 1840 },
  // x1.2 the straight line
  { from: 'trishund-ganpati-mandir', to: 'mati-ganpati',
    fromAt: { lat: 18.5217, lng: 73.8619 }, toAt: { lat: 18.5159, lng: 73.8468 },
    walkM: 2072 },
  // x1.3 the straight line
  { from: 'trishund-ganpati-mandir', to: 'natu-baug-mandal',
    fromAt: { lat: 18.5217, lng: 73.8619 }, toAt: { lat: 18.510703, lng: 73.853821 },
    walkM: 1918 },
  // x1.3 the straight line
  { from: 'trishund-ganpati-mandir', to: 'navjavan-mandal',
    fromAt: { lat: 18.5217, lng: 73.8619 }, toAt: { lat: 18.512919576416, lng: 73.8487282111353 },
    walkM: 2178 },
  // x1.3 the straight line
  { from: 'trishund-ganpati-mandir', to: 'nimbalkar-talim-mandal',
    fromAt: { lat: 18.5217, lng: 73.8619 }, toAt: { lat: 18.5119, lng: 73.8522 },
    walkM: 1915 },
  // x1.4 the straight line
  { from: 'trishund-ganpati-mandir', to: 'perugate-bhave-mandal',
    fromAt: { lat: 18.5217, lng: 73.8619 }, toAt: { lat: 18.509777, lng: 73.84944 },
    walkM: 2522 },
  // x1.4 the straight line
  { from: 'trishund-ganpati-mandir', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.5217, lng: 73.8619 }, toAt: { lat: 18.5188, lng: 73.8571 },
    walkM: 820 },
  // x1.2 the straight line
  { from: 'trishund-ganpati-mandir', to: 'sarasbaug-ganpati',
    fromAt: { lat: 18.5217, lng: 73.8619 }, toAt: { lat: 18.500881, lng: 73.85295 },
    walkM: 3111 },
  // x1.2 the straight line
  { from: 'trishund-ganpati-mandir', to: 'seva-mitra-mandal',
    fromAt: { lat: 18.5217, lng: 73.8619 }, toAt: { lat: 18.5086563388099, lng: 73.8575649915299 },
    walkM: 1867 },
  // x1.3 the straight line
  { from: 'trishund-ganpati-mandir', to: 'shanipar-mandal',
    fromAt: { lat: 18.5217, lng: 73.8619 }, toAt: { lat: 18.512619, lng: 73.852601 },
    walkM: 1781 },
  // x1.3 the straight line
  { from: 'trishund-ganpati-mandir', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.5217, lng: 73.8619 }, toAt: { lat: 18.51662, lng: 73.854894 },
    walkM: 1226 },
  // x1.3 the straight line
  { from: 'trishund-ganpati-mandir', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.5217, lng: 73.8619 }, toAt: { lat: 18.514268, lng: 73.855306 },
    walkM: 1439 },
  // x1.4 the straight line
  { from: 'tulshibaug-ganpati', to: 'akhil-mandai-mandal',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.511852, lng: 73.856135 },
    walkM: 397 },
  // x1.8 the straight line
  { from: 'tulshibaug-ganpati', to: 'balvikas-mandal',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    walkM: 633 },
  // x1.9 the straight line
  { from: 'tulshibaug-ganpati', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.517583, lng: 73.855362 },
    walkM: 701 },
  // x1.2 the straight line
  { from: 'tulshibaug-ganpati', to: 'chhatrapati-rajaram-mandal',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.512444, lng: 73.847482 },
    walkM: 985 },
  // x1.3 the straight line
  { from: 'tulshibaug-ganpati', to: 'chimnya-ganpati',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.5111804596016, lng: 73.8521904497267 },
    walkM: 603 },
  // x1.0 the straight line
  { from: 'tulshibaug-ganpati', to: 'chinchechi-talim-ganpati',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.5086, lng: 73.8555 },
    walkM: 658 },
  // x6.1 the straight line
  { from: 'tulshibaug-ganpati', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.51514, lng: 73.856379 },
    walkM: 914 },
  // x1.1 the straight line
  { from: 'tulshibaug-ganpati', to: 'garud-ganpati-mandal',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.5137, lng: 73.8456 },
    walkM: 1169 },
  // x4.2 the straight line
  { from: 'tulshibaug-ganpati', to: 'guruji-talim',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.514997, lng: 73.854992 },
    walkM: 370 },
  // x1.1 the straight line
  { from: 'tulshibaug-ganpati', to: 'hatti-ganpati-mandal',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.511223, lng: 73.845858 },
    walkM: 1192 },
  // x1.3 the straight line
  { from: 'tulshibaug-ganpati', to: 'hira-bagh-mandal',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.5042217511876, lng: 73.8557645094566 },
    walkM: 1417 },
  // x4.2 the straight line
  { from: 'tulshibaug-ganpati', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    walkM: 1861 },
  // x1.2 the straight line
  { from: 'tulshibaug-ganpati', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.51389, lng: 73.856342 },
    walkM: 145 },
  // x1.1 the straight line
  { from: 'tulshibaug-ganpati', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.513319, lng: 73.854938 },
    walkM: 123 },
  // x2.3 the straight line
  { from: 'tulshibaug-ganpati', to: 'kasba-ganpati',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.519055, lng: 73.857142 },
    walkM: 1278 },
  // x1.4 the straight line
  { from: 'tulshibaug-ganpati', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.515811, lng: 73.849008 },
    walkM: 940 },
  // x1.2 the straight line
  { from: 'tulshibaug-ganpati', to: 'mati-ganpati',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.5159, lng: 73.8468 },
    walkM: 1117 },
  // x1.3 the straight line
  { from: 'tulshibaug-ganpati', to: 'natu-baug-mandal',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.510703, lng: 73.853821 },
    walkM: 538 },
  // x1.2 the straight line
  { from: 'tulshibaug-ganpati', to: 'navjavan-mandal',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.512919576416, lng: 73.8487282111353 },
    walkM: 817 },
  // x1.3 the straight line
  { from: 'tulshibaug-ganpati', to: 'nimbalkar-talim-mandal',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.5119, lng: 73.8522 },
    walkM: 535 },
  // x1.4 the straight line
  { from: 'tulshibaug-ganpati', to: 'perugate-bhave-mandal',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.509777, lng: 73.84944 },
    walkM: 1142 },
  // x1.9 the straight line
  { from: 'tulshibaug-ganpati', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.5188, lng: 73.8571 },
    walkM: 1001 },
  // x1.1 the straight line
  { from: 'tulshibaug-ganpati', to: 'sarasbaug-ganpati',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.500881, lng: 73.85295 },
    walkM: 1733 },
  // x1.4 the straight line
  { from: 'tulshibaug-ganpati', to: 'seva-mitra-mandal',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.5086563388099, lng: 73.8575649915299 },
    walkM: 917 },
  // x1.2 the straight line
  { from: 'tulshibaug-ganpati', to: 'shanipar-mandal',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.512619, lng: 73.852601 },
    walkM: 401 },
  // x2.1 the straight line
  { from: 'tulshibaug-ganpati', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.51662, lng: 73.854894 },
    walkM: 567 },
  // x1.6 the straight line
  { from: 'tulshibaug-ganpati', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.5217, lng: 73.8619 },
    walkM: 1734 },
];
