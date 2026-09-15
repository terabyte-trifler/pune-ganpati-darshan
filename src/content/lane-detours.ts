import type { LatLng } from '@/lib/geo';

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
 * 74 of the 86 pairs have a way round. The other 12 have none
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
  // 1510 m the legal way round
  { from: 'akhil-mandai-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.51514, lng: 73.856379 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1510 },
  // 1647 m the legal way round
  { from: 'akhil-mandai-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.51389, lng: 73.856342 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1647 },
  // 1311 m the legal way round
  { from: 'akhil-mandai-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1311 },
  //  441 m the legal way round
  { from: 'balvikas-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.518558, lng: 73.854611 }],
    distanceM: 441 },
  //  435 m the legal way round
  { from: 'bhau-rangari-ganpati', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.518558, lng: 73.854611 }],
    distanceM: 435 },
  // 1573 m the legal way round
  { from: 'chhatrapati-rajaram-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.51514, lng: 73.856379 },
    via: [{ lat: 18.515811, lng: 73.849008 }],
    distanceM: 1573 },
  // 1249 m the legal way round
  { from: 'chhatrapati-rajaram-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.51389, lng: 73.856342 },
    via: [{ lat: 18.514997, lng: 73.854992 }],
    distanceM: 1249 },
  // 1611 m the legal way round
  { from: 'chhatrapati-rajaram-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1611 },
  // 1172 m the legal way round
  { from: 'chimnya-ganpati', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.51514, lng: 73.856379 },
    via: [{ lat: 18.51662, lng: 73.854894 }],
    distanceM: 1172 },
  //  902 m the legal way round
  { from: 'chimnya-ganpati', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.51389, lng: 73.856342 },
    via: [{ lat: 18.514997, lng: 73.854992 }],
    distanceM: 902 },
  // 1264 m the legal way round
  { from: 'chimnya-ganpati', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1264 },
  // 1476 m the legal way round
  { from: 'chinchechi-talim-ganpati', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.51514, lng: 73.856379 },
    via: [{ lat: 18.513271, lng: 73.853891 }, { lat: 18.51662, lng: 73.854894 }],
    distanceM: 1476 },
  // 1626 m the legal way round
  { from: 'chinchechi-talim-ganpati', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.51389, lng: 73.856342 },
    via: [{ lat: 18.515619, lng: 73.859274 }],
    distanceM: 1626 },
  // 1739 m the legal way round
  { from: 'chinchechi-talim-ganpati', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.515619, lng: 73.859274 }],
    distanceM: 1739 },
  // 1108 m the legal way round
  { from: 'dagdusheth-halwai-ganpati', to: 'balvikas-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    via: [{ lat: 18.515619, lng: 73.859274 }],
    distanceM: 1108 },
  // 1046 m the legal way round
  { from: 'dagdusheth-halwai-ganpati', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.517583, lng: 73.855362 },
    via: [{ lat: 18.515619, lng: 73.859274 }],
    distanceM: 1046 },
  // 1199 m the legal way round
  { from: 'dagdusheth-halwai-ganpati', to: 'chhatrapati-rajaram-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.512444, lng: 73.847482 },
    via: [{ lat: 18.513445, lng: 73.855866 }],
    distanceM: 1199 },
  //  866 m the legal way round
  { from: 'dagdusheth-halwai-ganpati', to: 'chimnya-ganpati',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.5111804596016, lng: 73.8521904497267 },
    via: [{ lat: 18.513445, lng: 73.855866 }],
    distanceM: 866 },
  // 1034 m the legal way round
  { from: 'dagdusheth-halwai-ganpati', to: 'kasba-ganpati',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.519055, lng: 73.857142 },
    via: [{ lat: 18.515619, lng: 73.859274 }],
    distanceM: 1034 },
  // 1305 m the legal way round
  { from: 'dagdusheth-halwai-ganpati', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.515811, lng: 73.849008 },
    via: [{ lat: 18.513445, lng: 73.855866 }],
    distanceM: 1305 },
  //  757 m the legal way round
  { from: 'dagdusheth-halwai-ganpati', to: 'natu-baug-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.510703, lng: 73.853821 },
    via: [{ lat: 18.513445, lng: 73.855866 }],
    distanceM: 757 },
  // 1110 m the legal way round
  { from: 'dagdusheth-halwai-ganpati', to: 'navjavan-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.512919576416, lng: 73.8487282111353 },
    via: [{ lat: 18.513445, lng: 73.855866 }],
    distanceM: 1110 },
  //  755 m the legal way round
  { from: 'dagdusheth-halwai-ganpati', to: 'nimbalkar-talim-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.5119, lng: 73.8522 },
    via: [{ lat: 18.513445, lng: 73.855866 }],
    distanceM: 755 },
  // 1366 m the legal way round
  { from: 'dagdusheth-halwai-ganpati', to: 'perugate-bhave-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.509777, lng: 73.84944 },
    via: [{ lat: 18.513445, lng: 73.855866 }],
    distanceM: 1366 },
  // 1004 m the legal way round
  { from: 'dagdusheth-halwai-ganpati', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.515619, lng: 73.859274 }],
    distanceM: 1004 },
  //  620 m the legal way round
  { from: 'dagdusheth-halwai-ganpati', to: 'shanipar-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.512619, lng: 73.852601 },
    via: [{ lat: 18.513445, lng: 73.855866 }],
    distanceM: 620 },
  //  922 m the legal way round
  { from: 'dagdusheth-halwai-ganpati', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.51662, lng: 73.854894 },
    via: [{ lat: 18.513445, lng: 73.855866 }, { lat: 18.514532, lng: 73.853743 }],
    distanceM: 922 },
  // 1340 m the legal way round
  { from: 'dagdusheth-halwai-ganpati', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.5217, lng: 73.8619 },
    via: [{ lat: 18.515619, lng: 73.859274 }],
    distanceM: 1340 },
  // 1034 m the legal way round
  { from: 'dagdusheth-halwai-ganpati', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.514268, lng: 73.855306 },
    via: [{ lat: 18.515619, lng: 73.859274 }],
    distanceM: 1034 },
  // 1516 m the legal way round
  { from: 'garud-ganpati-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.51514, lng: 73.856379 },
    via: [{ lat: 18.515811, lng: 73.849008 }],
    distanceM: 1516 },
  // 1688 m the legal way round
  { from: 'garud-ganpati-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.51389, lng: 73.856342 },
    via: [{ lat: 18.515811, lng: 73.849008 }, { lat: 18.515222, lng: 73.856379 }],
    distanceM: 1688 },
  //  722 m the legal way round
  { from: 'guruji-talim', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.518558, lng: 73.854611 }],
    distanceM: 722 },
  // 1815 m the legal way round
  { from: 'hatti-ganpati-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.51514, lng: 73.856379 },
    via: [{ lat: 18.515811, lng: 73.849008 }],
    distanceM: 1815 },
  // 1988 m the legal way round
  { from: 'hatti-ganpati-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.51389, lng: 73.856342 },
    via: [{ lat: 18.515811, lng: 73.849008 }, { lat: 18.515222, lng: 73.856379 }],
    distanceM: 1988 },
  //  761 m the legal way round
  { from: 'honaji-tarun-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.51514, lng: 73.856379 },
    via: [{ lat: 18.51693, lng: 73.859438 }],
    distanceM: 761 },
  //  843 m the legal way round
  { from: 'hutatma-babu-genu-mandal', to: 'balvikas-mandal',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    via: [{ lat: 18.513319, lng: 73.854938 }],
    distanceM: 843 },
  //  905 m the legal way round
  { from: 'hutatma-babu-genu-mandal', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.517583, lng: 73.855362 },
    via: [{ lat: 18.513319, lng: 73.854938 }],
    distanceM: 905 },
  // 1115 m the legal way round
  { from: 'hutatma-babu-genu-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.51514, lng: 73.856379 },
    via: [{ lat: 18.513319, lng: 73.854938 }, { lat: 18.51662, lng: 73.854894 }],
    distanceM: 1115 },
  // 1404 m the legal way round
  { from: 'hutatma-babu-genu-mandal', to: 'garud-ganpati-mandal',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.5137, lng: 73.8456 },
    via: [{ lat: 18.512619, lng: 73.852601 }],
    distanceM: 1404 },
  //  576 m the legal way round
  { from: 'hutatma-babu-genu-mandal', to: 'guruji-talim',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.514997, lng: 73.854992 },
    via: [{ lat: 18.513319, lng: 73.854938 }],
    distanceM: 576 },
  //  776 m the legal way round
  { from: 'hutatma-babu-genu-mandal', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    via: [{ lat: 18.51263, lng: 73.857653 }],
    distanceM: 776 },
  // 1238 m the legal way round
  { from: 'hutatma-babu-genu-mandal', to: 'kasba-ganpati',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.519055, lng: 73.857142 },
    via: [{ lat: 18.513445, lng: 73.855866 }, { lat: 18.516558, lng: 73.853881 }],
    distanceM: 1238 },
  // 1140 m the legal way round
  { from: 'hutatma-babu-genu-mandal', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.515811, lng: 73.849008 },
    via: [{ lat: 18.513445, lng: 73.855866 }],
    distanceM: 1140 },
  // 1406 m the legal way round
  { from: 'hutatma-babu-genu-mandal', to: 'mati-ganpati',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.5159, lng: 73.8468 },
    via: [{ lat: 18.512619, lng: 73.852601 }],
    distanceM: 1406 },
  // 1208 m the legal way round
  { from: 'hutatma-babu-genu-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.513445, lng: 73.855866 }, { lat: 18.516558, lng: 73.853881 }],
    distanceM: 1208 },
  //  757 m the legal way round
  { from: 'hutatma-babu-genu-mandal', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.51662, lng: 73.854894 },
    via: [{ lat: 18.513319, lng: 73.854938 }],
    distanceM: 757 },
  //  666 m the legal way round
  { from: 'hutatma-babu-genu-mandal', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.51389, lng: 73.856342 }, toAt: { lat: 18.514268, lng: 73.855306 },
    via: [{ lat: 18.513445, lng: 73.855866 }, { lat: 18.514532, lng: 73.853743 }],
    distanceM: 666 },
  // 1223 m the legal way round
  { from: 'jilbya-maruti-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.51514, lng: 73.856379 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1223 },
  // 1359 m the legal way round
  { from: 'jilbya-maruti-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.51389, lng: 73.856342 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1359 },
  // 1023 m the legal way round
  { from: 'jilbya-maruti-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1023 },
  // 1080 m the legal way round
  { from: 'kesariwada-ganpati', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1080 },
  // 1303 m the legal way round
  { from: 'mati-ganpati', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.51389, lng: 73.856342 },
    via: [{ lat: 18.514997, lng: 73.854992 }],
    distanceM: 1303 },
  // 1313 m the legal way round
  { from: 'mati-ganpati', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1313 },
  // 1107 m the legal way round
  { from: 'natu-baug-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.51514, lng: 73.856379 },
    via: [{ lat: 18.51662, lng: 73.854894 }],
    distanceM: 1107 },
  //  837 m the legal way round
  { from: 'natu-baug-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.51389, lng: 73.856342 },
    via: [{ lat: 18.514997, lng: 73.854992 }],
    distanceM: 837 },
  // 1199 m the legal way round
  { from: 'natu-baug-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1199 },
  // 1366 m the legal way round
  { from: 'navjavan-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.51514, lng: 73.856379 },
    via: [{ lat: 18.51662, lng: 73.854894 }],
    distanceM: 1366 },
  // 1096 m the legal way round
  { from: 'navjavan-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.51389, lng: 73.856342 },
    via: [{ lat: 18.514997, lng: 73.854992 }],
    distanceM: 1096 },
  // 1458 m the legal way round
  { from: 'navjavan-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1458 },
  // 1104 m the legal way round
  { from: 'nimbalkar-talim-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.51514, lng: 73.856379 },
    via: [{ lat: 18.51662, lng: 73.854894 }],
    distanceM: 1104 },
  //  834 m the legal way round
  { from: 'nimbalkar-talim-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.51389, lng: 73.856342 },
    via: [{ lat: 18.514997, lng: 73.854992 }],
    distanceM: 834 },
  // 1197 m the legal way round
  { from: 'nimbalkar-talim-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1197 },
  // 1886 m the legal way round
  { from: 'perugate-bhave-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.51514, lng: 73.856379 },
    via: [{ lat: 18.515811, lng: 73.849008 }],
    distanceM: 1886 },
  // 1428 m the legal way round
  { from: 'perugate-bhave-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.51389, lng: 73.856342 },
    via: [{ lat: 18.514997, lng: 73.854992 }],
    distanceM: 1428 },
  // 1790 m the legal way round
  { from: 'perugate-bhave-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1790 },
  // 1428 m the legal way round
  { from: 'seva-mitra-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.51389, lng: 73.856342 },
    via: [{ lat: 18.515619, lng: 73.859274 }],
    distanceM: 1428 },
  // 1540 m the legal way round
  { from: 'seva-mitra-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.515619, lng: 73.859274 }],
    distanceM: 1540 },
  //  970 m the legal way round
  { from: 'shanipar-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.51514, lng: 73.856379 },
    via: [{ lat: 18.51662, lng: 73.854894 }],
    distanceM: 970 },
  //  700 m the legal way round
  { from: 'shanipar-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.51389, lng: 73.856342 },
    via: [{ lat: 18.514997, lng: 73.854992 }],
    distanceM: 700 },
  // 1062 m the legal way round
  { from: 'shanipar-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1062 },
  //  541 m the legal way round
  { from: 'tambdi-jogeshwari', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.518558, lng: 73.854611 }],
    distanceM: 541 },
  //  905 m the legal way round
  { from: 'tulshibaug-ganpati', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.51514, lng: 73.856379 },
    via: [{ lat: 18.514532, lng: 73.853743 }, { lat: 18.51662, lng: 73.854894 }],
    distanceM: 905 },
  //  366 m the legal way round
  { from: 'tulshibaug-ganpati', to: 'guruji-talim',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.514997, lng: 73.854992 },
    via: [{ lat: 18.514532, lng: 73.853743 }],
    distanceM: 366 },
  //  998 m the legal way round
  { from: 'tulshibaug-ganpati', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.514532, lng: 73.853743 }, { lat: 18.516558, lng: 73.853881 }],
    distanceM: 998 },
];
