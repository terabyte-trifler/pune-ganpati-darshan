import type { LatLng } from '@/lib/geo';

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
 * Dagdusheth then Bhau Rangari walks 233 m back up Shivaji Road;
 * Bhau Rangari then Dagdusheth is the same two mandals, with the crowd,
 * and is clean. Nothing needs to be dropped from the plan — it needs
 * turning round.
 *
 * ---------------------------------------------------------------------
 * DERIVED DATA. The lanes in diversions.ts are reported from the ground;
 * this is a consequence of them, measured on 2026-09-16 by routing
 * ALL 756 ordered pairs of the 28 mandals within 1500 m of a
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
  // 179 m against
  { from: 'akhil-mandai-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.51514, lng: 73.856379 },
    againstM: 179 },
  //  45 m against
  { from: 'akhil-mandai-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.51389, lng: 73.856342 },
    againstM: 45 },
  // 564 m against
  { from: 'akhil-mandai-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.5188, lng: 73.8571 },
    againstM: 564 },
  // 126 m against
  { from: 'balvikas-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.5188, lng: 73.8571 },
    againstM: 126 },
  // 126 m against
  { from: 'bhau-rangari-ganpati', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.5188, lng: 73.8571 },
    againstM: 126 },
  //  92 m against — and the same walk back; needs a road we do not have
  { from: 'chhatrapati-rajaram-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.51514, lng: 73.856379 },
    againstM: 92 },
  //  45 m against
  { from: 'chhatrapati-rajaram-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.51389, lng: 73.856342 },
    againstM: 45 },
  // 353 m against
  { from: 'chhatrapati-rajaram-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.5188, lng: 73.8571 },
    againstM: 353 },
  //  92 m against — and the same walk back; needs a road we do not have
  { from: 'chimnya-ganpati', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.51514, lng: 73.856379 },
    againstM: 92 },
  //  45 m against
  { from: 'chimnya-ganpati', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.51389, lng: 73.856342 },
    againstM: 45 },
  // 353 m against
  { from: 'chimnya-ganpati', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.5188, lng: 73.8571 },
    againstM: 353 },
  // 180 m against
  { from: 'chinchechi-talim-ganpati', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.51514, lng: 73.856379 },
    againstM: 180 },
  //  45 m against
  { from: 'chinchechi-talim-ganpati', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.51389, lng: 73.856342 },
    againstM: 45 },
  // 564 m against
  { from: 'chinchechi-talim-ganpati', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.5188, lng: 73.8571 },
    againstM: 564 },
  // 142 m against
  { from: 'dagdusheth-halwai-ganpati', to: 'balvikas-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    againstM: 142 },
  // 233 m against
  { from: 'dagdusheth-halwai-ganpati', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.517583, lng: 73.855362 },
    againstM: 233 },
  //  65 m against — and the same walk back; needs a road we do not have
  { from: 'dagdusheth-halwai-ganpati', to: 'chhatrapati-rajaram-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.512444, lng: 73.847482 },
    againstM: 65 },
  //  65 m against — and the same walk back; needs a road we do not have
  { from: 'dagdusheth-halwai-ganpati', to: 'chimnya-ganpati',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.5111804596016, lng: 73.8521904497267 },
    againstM: 65 },
  //  65 m against — and the same walk back; needs a road we do not have
  { from: 'dagdusheth-halwai-ganpati', to: 'garud-ganpati-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.5137, lng: 73.8456 },
    againstM: 65 },
  //  65 m against — and the same walk back; needs a road we do not have
  { from: 'dagdusheth-halwai-ganpati', to: 'hatti-ganpati-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.511223, lng: 73.845858 },
    againstM: 65 },
  //  27 m against
  { from: 'dagdusheth-halwai-ganpati', to: 'kasba-ganpati',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.519055, lng: 73.857142 },
    againstM: 27 },
  // 136 m against
  { from: 'dagdusheth-halwai-ganpati', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.515811, lng: 73.849008 },
    againstM: 136 },
  // 136 m against
  { from: 'dagdusheth-halwai-ganpati', to: 'mati-ganpati',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.5159, lng: 73.8468 },
    againstM: 136 },
  //  65 m against — and the same walk back; needs a road we do not have
  { from: 'dagdusheth-halwai-ganpati', to: 'natu-baug-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.510703, lng: 73.853821 },
    againstM: 65 },
  //  65 m against — and the same walk back; needs a road we do not have
  { from: 'dagdusheth-halwai-ganpati', to: 'navjavan-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.512919576416, lng: 73.8487282111353 },
    againstM: 65 },
  //  65 m against — and the same walk back; needs a road we do not have
  { from: 'dagdusheth-halwai-ganpati', to: 'nimbalkar-talim-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.5119, lng: 73.8522 },
    againstM: 65 },
  //  65 m against — and the same walk back; needs a road we do not have
  { from: 'dagdusheth-halwai-ganpati', to: 'perugate-bhave-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.509777, lng: 73.84944 },
    againstM: 65 },
  // 384 m against
  { from: 'dagdusheth-halwai-ganpati', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.5188, lng: 73.8571 },
    againstM: 384 },
  //  65 m against — and the same walk back; needs a road we do not have
  { from: 'dagdusheth-halwai-ganpati', to: 'sarasbaug-ganpati',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.500881, lng: 73.85295 },
    againstM: 65 },
  //  65 m against — and the same walk back; needs a road we do not have
  { from: 'dagdusheth-halwai-ganpati', to: 'shanipar-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.512619, lng: 73.852601 },
    againstM: 65 },
  // 142 m against
  { from: 'dagdusheth-halwai-ganpati', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.51662, lng: 73.854894 },
    againstM: 142 },
  //  27 m against
  { from: 'dagdusheth-halwai-ganpati', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.5217, lng: 73.8619 },
    againstM: 27 },
  //  65 m against — and the same walk back; needs a road we do not have
  { from: 'dagdusheth-halwai-ganpati', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.514268, lng: 73.855306 },
    againstM: 65 },
  //  34 m against — and the same walk back; needs a road we do not have
  { from: 'garud-ganpati-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.51514, lng: 73.856379 },
    againstM: 34 },
  //  65 m against — and the same walk back; needs a road we do not have
  { from: 'garud-ganpati-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.51389, lng: 73.856342 },
    againstM: 65 },
  // 186 m against
  { from: 'garud-ganpati-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.5188, lng: 73.8571 },
    againstM: 186 },
  // 344 m against
  { from: 'guruji-talim', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.5188, lng: 73.8571 },
    againstM: 344 },
  //  92 m against — and the same walk back; needs a road we do not have
  { from: 'hatti-ganpati-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.51514, lng: 73.856379 },
    againstM: 92 },
  //  45 m against
  { from: 'hatti-ganpati-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.51389, lng: 73.856342 },
    againstM: 45 },
  // 353 m against
  { from: 'hatti-ganpati-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.5188, lng: 73.8571 },
    againstM: 353 },
  //  45 m against
  { from: 'hira-bagh-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.5042217511876, lng: 73.8557645094566 }, toAt: { lat: 18.51389, lng: 73.856342 },
    againstM: 45 },
  // 482 m against
  { from: 'hira-bagh-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.5042217511876, lng: 73.8557645094566 }, toAt: { lat: 18.5188, lng: 73.8571 },
    againstM: 482 },
  //  53 m against
  { from: 'honaji-tarun-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.51514, lng: 73.856379 },
    againstM: 53 },
  // 209 m against
  { from: 'hutatma-babu-genu-mandal', to: 'balvikas-mandal',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    againstM: 209 },
  // 335 m against
  { from: 'hutatma-babu-genu-mandal', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.517583, lng: 73.855362 },
    againstM: 335 },
  //  79 m against
  { from: 'hutatma-babu-genu-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.51514, lng: 73.856379 },
    againstM: 79 },
  // 112 m against — and the same walk back; needs a road we do not have
  { from: 'hutatma-babu-genu-mandal', to: 'garud-ganpati-mandal',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.5137, lng: 73.8456 },
    againstM: 112 },
  // 209 m against
  { from: 'hutatma-babu-genu-mandal', to: 'guruji-talim',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.514997, lng: 73.854992 },
    againstM: 209 },
  //  39 m against
  { from: 'hutatma-babu-genu-mandal', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    againstM: 39 },
  // 464 m against
  { from: 'hutatma-babu-genu-mandal', to: 'kasba-ganpati',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.519055, lng: 73.857142 },
    againstM: 464 },
  // 112 m against
  { from: 'hutatma-babu-genu-mandal', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.515811, lng: 73.849008 },
    againstM: 112 },
  // 112 m against — and the same walk back; needs a road we do not have
  { from: 'hutatma-babu-genu-mandal', to: 'mati-ganpati',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.5159, lng: 73.8468 },
    againstM: 112 },
  // 464 m against
  { from: 'hutatma-babu-genu-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.5188, lng: 73.8571 },
    againstM: 464 },
  // 209 m against
  { from: 'hutatma-babu-genu-mandal', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.51662, lng: 73.854894 },
    againstM: 209 },
  // 382 m against
  { from: 'hutatma-babu-genu-mandal', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.5217, lng: 73.8619 },
    againstM: 382 },
  // 127 m against
  { from: 'hutatma-babu-genu-mandal', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.514268, lng: 73.855306 },
    againstM: 127 },
  // 180 m against
  { from: 'jilbya-maruti-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.51514, lng: 73.856379 },
    againstM: 180 },
  //  45 m against
  { from: 'jilbya-maruti-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.51389, lng: 73.856342 },
    againstM: 45 },
  // 564 m against
  { from: 'jilbya-maruti-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.5188, lng: 73.8571 },
    againstM: 564 },
  // 186 m against
  { from: 'kesariwada-ganpati', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.5188, lng: 73.8571 },
    againstM: 186 },
  //  65 m against — and the same walk back; needs a road we do not have
  { from: 'mati-ganpati', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.51389, lng: 73.856342 },
    againstM: 65 },
  // 186 m against
  { from: 'mati-ganpati', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.5188, lng: 73.8571 },
    againstM: 186 },
  //  92 m against — and the same walk back; needs a road we do not have
  { from: 'natu-baug-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.51514, lng: 73.856379 },
    againstM: 92 },
  //  45 m against
  { from: 'natu-baug-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.51389, lng: 73.856342 },
    againstM: 45 },
  // 353 m against
  { from: 'natu-baug-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.5188, lng: 73.8571 },
    againstM: 353 },
  // 111 m against — and the same walk back; needs a road we do not have
  { from: 'navjavan-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.51514, lng: 73.856379 },
    againstM: 111 },
  //  65 m against
  { from: 'navjavan-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.51389, lng: 73.856342 },
    againstM: 65 },
  // 353 m against
  { from: 'navjavan-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.5188, lng: 73.8571 },
    againstM: 353 },
  //  92 m against — and the same walk back; needs a road we do not have
  { from: 'nimbalkar-talim-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.51514, lng: 73.856379 },
    againstM: 92 },
  //  45 m against
  { from: 'nimbalkar-talim-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.51389, lng: 73.856342 },
    againstM: 45 },
  // 353 m against
  { from: 'nimbalkar-talim-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.5188, lng: 73.8571 },
    againstM: 353 },
  //  92 m against — and the same walk back; needs a road we do not have
  { from: 'perugate-bhave-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.51514, lng: 73.856379 },
    againstM: 92 },
  //  45 m against
  { from: 'perugate-bhave-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.51389, lng: 73.856342 },
    againstM: 45 },
  // 353 m against
  { from: 'perugate-bhave-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.5188, lng: 73.8571 },
    againstM: 353 },
  //  92 m against — and the same walk back; needs a road we do not have
  { from: 'sarasbaug-ganpati', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.500881, lng: 73.85295 }, toAt: { lat: 18.51514, lng: 73.856379 },
    againstM: 92 },
  //  45 m against
  { from: 'sarasbaug-ganpati', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.500881, lng: 73.85295 }, toAt: { lat: 18.51389, lng: 73.856342 },
    againstM: 45 },
  // 353 m against
  { from: 'sarasbaug-ganpati', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.500881, lng: 73.85295 }, toAt: { lat: 18.5188, lng: 73.8571 },
    againstM: 353 },
  //  45 m against
  { from: 'seva-mitra-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.51389, lng: 73.856342 },
    againstM: 45 },
  // 482 m against
  { from: 'seva-mitra-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.5188, lng: 73.8571 },
    againstM: 482 },
  //  92 m against — and the same walk back; needs a road we do not have
  { from: 'shanipar-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.51514, lng: 73.856379 },
    againstM: 92 },
  //  45 m against
  { from: 'shanipar-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.51389, lng: 73.856342 },
    againstM: 45 },
  // 353 m against
  { from: 'shanipar-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.5188, lng: 73.8571 },
    againstM: 353 },
  // 186 m against
  { from: 'tambdi-jogeshwari', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.5188, lng: 73.8571 },
    againstM: 186 },
  //  76 m against — and the same walk back; needs a road we do not have
  { from: 'tulshibaug-ganpati', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.51514, lng: 73.856379 },
    againstM: 76 },
  //  82 m against
  { from: 'tulshibaug-ganpati', to: 'guruji-talim',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.514997, lng: 73.854992 },
    againstM: 82 },
  // 467 m against
  { from: 'tulshibaug-ganpati', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.5188, lng: 73.8571 },
    againstM: 467 },
];
