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
 * 169 of the 202 pairs have a way round. The other 33 have none
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
  //  946 m the legal way round
  { from: 'akhil-mandai-mandal', to: 'balvikas-mandal',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    via: [{ lat: 18.513271, lng: 73.853891 }],
    distanceM: 946 },
  // 1008 m the legal way round
  { from: 'akhil-mandai-mandal', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.517583, lng: 73.855362 },
    via: [{ lat: 18.513271, lng: 73.853891 }],
    distanceM: 1008 },
  // 1510 m the legal way round
  { from: 'akhil-mandai-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.51514, lng: 73.856379 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1510 },
  //  679 m the legal way round
  { from: 'akhil-mandai-mandal', to: 'guruji-talim',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.514997, lng: 73.854992 },
    via: [{ lat: 18.513271, lng: 73.853891 }],
    distanceM: 679 },
  //  892 m the legal way round
  { from: 'akhil-mandai-mandal', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    via: [{ lat: 18.51263, lng: 73.857653 }],
    distanceM: 892 },
  // 1647 m the legal way round
  { from: 'akhil-mandai-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.51389, lng: 73.856342 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1647 },
  // 1341 m the legal way round
  { from: 'akhil-mandai-mandal', to: 'kasba-ganpati',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.519055, lng: 73.857142 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1341 },
  // 1311 m the legal way round
  { from: 'akhil-mandai-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1311 },
  //  860 m the legal way round
  { from: 'akhil-mandai-mandal', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.51662, lng: 73.854894 },
    via: [{ lat: 18.513271, lng: 73.853891 }],
    distanceM: 860 },
  //  769 m the legal way round
  { from: 'akhil-mandai-mandal', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.511852, lng: 73.856135 }, toAt: { lat: 18.514268, lng: 73.855306 },
    via: [{ lat: 18.514532, lng: 73.853743 }],
    distanceM: 769 },
  //  472 m the legal way round
  { from: 'balvikas-mandal', to: 'kasba-ganpati',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.519055, lng: 73.857142 },
    via: [{ lat: 18.518558, lng: 73.854611 }],
    distanceM: 472 },
  //  441 m the legal way round
  { from: 'balvikas-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.518558, lng: 73.854611 }],
    distanceM: 441 },
  // 1241 m the legal way round
  { from: 'balvikas-mandal', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.5174365565457, lng: 73.8550423013327 }, toAt: { lat: 18.5217, lng: 73.8619 },
    via: [{ lat: 18.518558, lng: 73.854611 }],
    distanceM: 1241 },
  //  465 m the legal way round
  { from: 'bhau-rangari-ganpati', to: 'kasba-ganpati',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.519055, lng: 73.857142 },
    via: [{ lat: 18.518558, lng: 73.854611 }],
    distanceM: 465 },
  //  435 m the legal way round
  { from: 'bhau-rangari-ganpati', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.518558, lng: 73.854611 }],
    distanceM: 435 },
  // 1234 m the legal way round
  { from: 'bhau-rangari-ganpati', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.517583, lng: 73.855362 }, toAt: { lat: 18.5217, lng: 73.8619 },
    via: [{ lat: 18.518558, lng: 73.854611 }],
    distanceM: 1234 },
  // 1573 m the legal way round
  { from: 'chhatrapati-rajaram-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.51514, lng: 73.856379 },
    via: [{ lat: 18.515811, lng: 73.849008 }],
    distanceM: 1573 },
  // 2063 m the legal way round
  { from: 'chhatrapati-rajaram-mandal', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 2063 },
  // 1249 m the legal way round
  { from: 'chhatrapati-rajaram-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.51389, lng: 73.856342 },
    via: [{ lat: 18.514997, lng: 73.854992 }],
    distanceM: 1249 },
  // 1642 m the legal way round
  { from: 'chhatrapati-rajaram-mandal', to: 'kasba-ganpati',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.519055, lng: 73.857142 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1642 },
  // 1611 m the legal way round
  { from: 'chhatrapati-rajaram-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1611 },
  // 1069 m the legal way round
  { from: 'chhatrapati-rajaram-mandal', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.512444, lng: 73.847482 }, toAt: { lat: 18.514268, lng: 73.855306 },
    via: [{ lat: 18.514997, lng: 73.854992 }],
    distanceM: 1069 },
  // 1172 m the legal way round
  { from: 'chimnya-ganpati', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.51514, lng: 73.856379 },
    via: [{ lat: 18.51662, lng: 73.854894 }],
    distanceM: 1172 },
  // 1236 m the legal way round
  { from: 'chimnya-ganpati', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    via: [{ lat: 18.51263, lng: 73.857653 }],
    distanceM: 1236 },
  //  902 m the legal way round
  { from: 'chimnya-ganpati', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.51389, lng: 73.856342 },
    via: [{ lat: 18.514997, lng: 73.854992 }],
    distanceM: 902 },
  // 1294 m the legal way round
  { from: 'chimnya-ganpati', to: 'kasba-ganpati',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.519055, lng: 73.857142 },
    via: [{ lat: 18.518558, lng: 73.854611 }],
    distanceM: 1294 },
  // 1264 m the legal way round
  { from: 'chimnya-ganpati', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1264 },
  // 2063 m the legal way round
  { from: 'chimnya-ganpati', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.5217, lng: 73.8619 },
    via: [{ lat: 18.518558, lng: 73.854611 }],
    distanceM: 2063 },
  //  722 m the legal way round
  { from: 'chimnya-ganpati', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.5111804596016, lng: 73.8521904497267 }, toAt: { lat: 18.514268, lng: 73.855306 },
    via: [{ lat: 18.514532, lng: 73.853743 }],
    distanceM: 722 },
  // 1204 m the legal way round
  { from: 'chinchechi-talim-ganpati', to: 'balvikas-mandal',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    via: [{ lat: 18.513271, lng: 73.853891 }],
    distanceM: 1204 },
  // 1266 m the legal way round
  { from: 'chinchechi-talim-ganpati', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.517583, lng: 73.855362 },
    via: [{ lat: 18.513271, lng: 73.853891 }],
    distanceM: 1266 },
  // 1476 m the legal way round
  { from: 'chinchechi-talim-ganpati', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.51514, lng: 73.856379 },
    via: [{ lat: 18.513271, lng: 73.853891 }, { lat: 18.51662, lng: 73.854894 }],
    distanceM: 1476 },
  //  937 m the legal way round
  { from: 'chinchechi-talim-ganpati', to: 'guruji-talim',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.514997, lng: 73.854992 },
    via: [{ lat: 18.513271, lng: 73.853891 }],
    distanceM: 937 },
  // 1626 m the legal way round
  { from: 'chinchechi-talim-ganpati', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.51389, lng: 73.856342 },
    via: [{ lat: 18.515619, lng: 73.859274 }],
    distanceM: 1626 },
  // 1769 m the legal way round
  { from: 'chinchechi-talim-ganpati', to: 'kasba-ganpati',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.519055, lng: 73.857142 },
    via: [{ lat: 18.515619, lng: 73.859274 }],
    distanceM: 1769 },
  // 1739 m the legal way round
  { from: 'chinchechi-talim-ganpati', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.515619, lng: 73.859274 }],
    distanceM: 1739 },
  // 1118 m the legal way round
  { from: 'chinchechi-talim-ganpati', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.51662, lng: 73.854894 },
    via: [{ lat: 18.513271, lng: 73.853891 }],
    distanceM: 1118 },
  // 2335 m the legal way round
  { from: 'chinchechi-talim-ganpati', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.5217, lng: 73.8619 },
    via: [{ lat: 18.515619, lng: 73.859274 }],
    distanceM: 2335 },
  // 1026 m the legal way round
  { from: 'chinchechi-talim-ganpati', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.5086, lng: 73.8555 }, toAt: { lat: 18.514268, lng: 73.855306 },
    via: [{ lat: 18.514532, lng: 73.853743 }],
    distanceM: 1026 },
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
  //  875 m the legal way round
  { from: 'dagdusheth-halwai-ganpati', to: 'chinchechi-talim-ganpati',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.5086, lng: 73.8555 },
    via: [{ lat: 18.513445, lng: 73.855866 }],
    distanceM: 875 },
  //  944 m the legal way round
  { from: 'dagdusheth-halwai-ganpati', to: 'guruji-talim',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.514997, lng: 73.854992 },
    via: [{ lat: 18.515619, lng: 73.859274 }],
    distanceM: 944 },
  //  349 m the legal way round
  { from: 'dagdusheth-halwai-ganpati', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.51514, lng: 73.856379 }, toAt: { lat: 18.513319, lng: 73.854938 },
    via: [{ lat: 18.513445, lng: 73.855866 }],
    distanceM: 349 },
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
  // 1471 m the legal way round
  { from: 'garud-ganpati-mandal', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.5137, lng: 73.8456 }, toAt: { lat: 18.514268, lng: 73.855306 },
    via: [{ lat: 18.515811, lng: 73.849008 }],
    distanceM: 1471 },
  //  753 m the legal way round
  { from: 'guruji-talim', to: 'kasba-ganpati',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.519055, lng: 73.857142 },
    via: [{ lat: 18.518558, lng: 73.854611 }],
    distanceM: 753 },
  //  722 m the legal way round
  { from: 'guruji-talim', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.518558, lng: 73.854611 }],
    distanceM: 722 },
  // 1395 m the legal way round
  { from: 'guruji-talim', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.514997, lng: 73.854992 }, toAt: { lat: 18.5217, lng: 73.8619 },
    via: [{ lat: 18.516042, lng: 73.859423 }],
    distanceM: 1395 },
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
  // 1771 m the legal way round
  { from: 'hatti-ganpati-mandal', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.511223, lng: 73.845858 }, toAt: { lat: 18.514268, lng: 73.855306 },
    via: [{ lat: 18.515811, lng: 73.849008 }],
    distanceM: 1771 },
  //  783 m the legal way round
  { from: 'honaji-tarun-mandal', to: 'balvikas-mandal',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    via: [{ lat: 18.514997, lng: 73.854992 }],
    distanceM: 783 },
  //  752 m the legal way round
  { from: 'honaji-tarun-mandal', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.517583, lng: 73.855362 },
    via: [{ lat: 18.516042, lng: 73.859423 }],
    distanceM: 752 },
  // 1135 m the legal way round
  { from: 'honaji-tarun-mandal', to: 'chimnya-ganpati',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.5111804596016, lng: 73.8521904497267 },
    via: [{ lat: 18.514532, lng: 73.853743 }],
    distanceM: 1135 },
  // 1157 m the legal way round
  { from: 'honaji-tarun-mandal', to: 'chinchechi-talim-ganpati',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.5086, lng: 73.8555 },
    via: [{ lat: 18.51263, lng: 73.857653 }],
    distanceM: 1157 },
  //  761 m the legal way round
  { from: 'honaji-tarun-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.51514, lng: 73.856379 },
    via: [{ lat: 18.51693, lng: 73.859438 }],
    distanceM: 761 },
  //  653 m the legal way round
  { from: 'honaji-tarun-mandal', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.513319, lng: 73.854938 },
    via: [{ lat: 18.513445, lng: 73.855866 }],
    distanceM: 653 },
  // 1061 m the legal way round
  { from: 'honaji-tarun-mandal', to: 'natu-baug-mandal',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.510703, lng: 73.853821 },
    via: [{ lat: 18.513445, lng: 73.855866 }],
    distanceM: 1061 },
  // 1058 m the legal way round
  { from: 'honaji-tarun-mandal', to: 'nimbalkar-talim-mandal',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.5119, lng: 73.8522 },
    via: [{ lat: 18.513445, lng: 73.855866 }],
    distanceM: 1058 },
  // 1669 m the legal way round
  { from: 'honaji-tarun-mandal', to: 'perugate-bhave-mandal',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.509777, lng: 73.84944 },
    via: [{ lat: 18.513445, lng: 73.855866 }],
    distanceM: 1669 },
  //  924 m the legal way round
  { from: 'honaji-tarun-mandal', to: 'shanipar-mandal',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.512619, lng: 73.852601 },
    via: [{ lat: 18.513445, lng: 73.855866 }],
    distanceM: 924 },
  //  683 m the legal way round
  { from: 'honaji-tarun-mandal', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.51662, lng: 73.854894 },
    via: [{ lat: 18.514997, lng: 73.854992 }],
    distanceM: 683 },
  //  591 m the legal way round
  { from: 'honaji-tarun-mandal', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.5156190173467, lng: 73.8592741338598 }, toAt: { lat: 18.514268, lng: 73.855306 },
    via: [{ lat: 18.514997, lng: 73.854992 }],
    distanceM: 591 },
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
  //  658 m the legal way round
  { from: 'jilbya-maruti-mandal', to: 'balvikas-mandal',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    via: [{ lat: 18.514532, lng: 73.853743 }],
    distanceM: 658 },
  //  720 m the legal way round
  { from: 'jilbya-maruti-mandal', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.517583, lng: 73.855362 },
    via: [{ lat: 18.514532, lng: 73.853743 }],
    distanceM: 720 },
  // 1223 m the legal way round
  { from: 'jilbya-maruti-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.51514, lng: 73.856379 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1223 },
  //  391 m the legal way round
  { from: 'jilbya-maruti-mandal', to: 'guruji-talim',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.514997, lng: 73.854992 },
    via: [{ lat: 18.514532, lng: 73.853743 }],
    distanceM: 391 },
  //  871 m the legal way round
  { from: 'jilbya-maruti-mandal', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    via: [{ lat: 18.51263, lng: 73.857653 }],
    distanceM: 871 },
  // 1359 m the legal way round
  { from: 'jilbya-maruti-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.51389, lng: 73.856342 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1359 },
  // 1053 m the legal way round
  { from: 'jilbya-maruti-mandal', to: 'kasba-ganpati',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.519055, lng: 73.857142 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1053 },
  // 1023 m the legal way round
  { from: 'jilbya-maruti-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1023 },
  //  573 m the legal way round
  { from: 'jilbya-maruti-mandal', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.51662, lng: 73.854894 },
    via: [{ lat: 18.514532, lng: 73.853743 }],
    distanceM: 573 },
  //  481 m the legal way round
  { from: 'jilbya-maruti-mandal', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.513319, lng: 73.854938 }, toAt: { lat: 18.514268, lng: 73.855306 },
    via: [{ lat: 18.514532, lng: 73.853743 }],
    distanceM: 481 },
  // 1367 m the legal way round
  { from: 'kasba-ganpati', to: 'chinchechi-talim-ganpati',
    fromAt: { lat: 18.519055, lng: 73.857142 }, toAt: { lat: 18.5086, lng: 73.8555 },
    via: [{ lat: 18.513445, lng: 73.855866 }],
    distanceM: 1367 },
  //  842 m the legal way round
  { from: 'kasba-ganpati', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.519055, lng: 73.857142 }, toAt: { lat: 18.513319, lng: 73.854938 },
    via: [{ lat: 18.513445, lng: 73.855866 }],
    distanceM: 842 },
  // 1087 m the legal way round
  { from: 'kesariwada-ganpati', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.51389, lng: 73.856342 },
    via: [{ lat: 18.514268, lng: 73.855306 }],
    distanceM: 1087 },
  // 1110 m the legal way round
  { from: 'kesariwada-ganpati', to: 'kasba-ganpati',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.519055, lng: 73.857142 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1110 },
  // 1080 m the legal way round
  { from: 'kesariwada-ganpati', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1080 },
  // 1879 m the legal way round
  { from: 'kesariwada-ganpati', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.515811, lng: 73.849008 }, toAt: { lat: 18.5217, lng: 73.8619 },
    via: [{ lat: 18.518558, lng: 73.854611 }],
    distanceM: 1879 },
  // 1303 m the legal way round
  { from: 'mati-ganpati', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.51389, lng: 73.856342 },
    via: [{ lat: 18.514997, lng: 73.854992 }],
    distanceM: 1303 },
  // 1343 m the legal way round
  { from: 'mati-ganpati', to: 'kasba-ganpati',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.519055, lng: 73.857142 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1343 },
  // 1313 m the legal way round
  { from: 'mati-ganpati', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1313 },
  // 2112 m the legal way round
  { from: 'mati-ganpati', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.5217, lng: 73.8619 },
    via: [{ lat: 18.518558, lng: 73.854611 }],
    distanceM: 2112 },
  // 1123 m the legal way round
  { from: 'mati-ganpati', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.5159, lng: 73.8468 }, toAt: { lat: 18.514268, lng: 73.855306 },
    via: [{ lat: 18.514997, lng: 73.854992 }],
    distanceM: 1123 },
  // 1107 m the legal way round
  { from: 'natu-baug-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.51514, lng: 73.856379 },
    via: [{ lat: 18.51662, lng: 73.854894 }],
    distanceM: 1107 },
  // 1127 m the legal way round
  { from: 'natu-baug-mandal', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    via: [{ lat: 18.51263, lng: 73.857653 }],
    distanceM: 1127 },
  //  837 m the legal way round
  { from: 'natu-baug-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.51389, lng: 73.856342 },
    via: [{ lat: 18.514997, lng: 73.854992 }],
    distanceM: 837 },
  // 1230 m the legal way round
  { from: 'natu-baug-mandal', to: 'kasba-ganpati',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.519055, lng: 73.857142 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1230 },
  // 1199 m the legal way round
  { from: 'natu-baug-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1199 },
  // 1999 m the legal way round
  { from: 'natu-baug-mandal', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.5217, lng: 73.8619 },
    via: [{ lat: 18.518558, lng: 73.854611 }],
    distanceM: 1999 },
  //  657 m the legal way round
  { from: 'natu-baug-mandal', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.510703, lng: 73.853821 }, toAt: { lat: 18.514268, lng: 73.855306 },
    via: [{ lat: 18.514532, lng: 73.853743 }],
    distanceM: 657 },
  // 1366 m the legal way round
  { from: 'navjavan-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.51514, lng: 73.856379 },
    via: [{ lat: 18.51662, lng: 73.854894 }],
    distanceM: 1366 },
  // 1619 m the legal way round
  { from: 'navjavan-mandal', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    via: [{ lat: 18.51662, lng: 73.854894 }],
    distanceM: 1619 },
  // 1096 m the legal way round
  { from: 'navjavan-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.51389, lng: 73.856342 },
    via: [{ lat: 18.514997, lng: 73.854992 }],
    distanceM: 1096 },
  // 1489 m the legal way round
  { from: 'navjavan-mandal', to: 'kasba-ganpati',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.519055, lng: 73.857142 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1489 },
  // 1458 m the legal way round
  { from: 'navjavan-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1458 },
  // 2258 m the legal way round
  { from: 'navjavan-mandal', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.5217, lng: 73.8619 },
    via: [{ lat: 18.518558, lng: 73.854611 }],
    distanceM: 2258 },
  //  916 m the legal way round
  { from: 'navjavan-mandal', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.512919576416, lng: 73.8487282111353 }, toAt: { lat: 18.514268, lng: 73.855306 },
    via: [{ lat: 18.514997, lng: 73.854992 }],
    distanceM: 916 },
  // 1104 m the legal way round
  { from: 'nimbalkar-talim-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.51514, lng: 73.856379 },
    via: [{ lat: 18.51662, lng: 73.854894 }],
    distanceM: 1104 },
  // 1305 m the legal way round
  { from: 'nimbalkar-talim-mandal', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    via: [{ lat: 18.51263, lng: 73.857653 }],
    distanceM: 1305 },
  //  834 m the legal way round
  { from: 'nimbalkar-talim-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.51389, lng: 73.856342 },
    via: [{ lat: 18.514997, lng: 73.854992 }],
    distanceM: 834 },
  // 1227 m the legal way round
  { from: 'nimbalkar-talim-mandal', to: 'kasba-ganpati',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.519055, lng: 73.857142 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1227 },
  // 1197 m the legal way round
  { from: 'nimbalkar-talim-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1197 },
  // 1996 m the legal way round
  { from: 'nimbalkar-talim-mandal', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.5217, lng: 73.8619 },
    via: [{ lat: 18.518558, lng: 73.854611 }],
    distanceM: 1996 },
  //  654 m the legal way round
  { from: 'nimbalkar-talim-mandal', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.5119, lng: 73.8522 }, toAt: { lat: 18.514268, lng: 73.855306 },
    via: [{ lat: 18.514532, lng: 73.853743 }],
    distanceM: 654 },
  // 1886 m the legal way round
  { from: 'perugate-bhave-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.51514, lng: 73.856379 },
    via: [{ lat: 18.515811, lng: 73.849008 }],
    distanceM: 1886 },
  // 2085 m the legal way round
  { from: 'perugate-bhave-mandal', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    via: [{ lat: 18.508656, lng: 73.857565 }],
    distanceM: 2085 },
  // 1428 m the legal way round
  { from: 'perugate-bhave-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.51389, lng: 73.856342 },
    via: [{ lat: 18.514997, lng: 73.854992 }],
    distanceM: 1428 },
  // 1820 m the legal way round
  { from: 'perugate-bhave-mandal', to: 'kasba-ganpati',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.519055, lng: 73.857142 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1820 },
  // 1790 m the legal way round
  { from: 'perugate-bhave-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1790 },
  // 1248 m the legal way round
  { from: 'perugate-bhave-mandal', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.509777, lng: 73.84944 }, toAt: { lat: 18.514268, lng: 73.855306 },
    via: [{ lat: 18.514532, lng: 73.853743 }],
    distanceM: 1248 },
  // 1337 m the legal way round
  { from: 'phani-ali-ganesh-mandir', to: 'chinchechi-talim-ganpati',
    fromAt: { lat: 18.5188, lng: 73.8571 }, toAt: { lat: 18.5086, lng: 73.8555 },
    via: [{ lat: 18.513445, lng: 73.855866 }],
    distanceM: 1337 },
  //  811 m the legal way round
  { from: 'phani-ali-ganesh-mandir', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.5188, lng: 73.8571 }, toAt: { lat: 18.513319, lng: 73.854938 },
    via: [{ lat: 18.513445, lng: 73.855866 }],
    distanceM: 811 },
  // 2313 m the legal way round
  { from: 'sarasbaug-ganpati', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.500881, lng: 73.85295 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    via: [{ lat: 18.5086, lng: 73.8555 }],
    distanceM: 2313 },
  // 1457 m the legal way round
  { from: 'seva-mitra-mandal', to: 'balvikas-mandal',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    via: [{ lat: 18.513271, lng: 73.853891 }],
    distanceM: 1457 },
  // 1519 m the legal way round
  { from: 'seva-mitra-mandal', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.517583, lng: 73.855362 },
    via: [{ lat: 18.513271, lng: 73.853891 }],
    distanceM: 1519 },
  // 1191 m the legal way round
  { from: 'seva-mitra-mandal', to: 'guruji-talim',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.514997, lng: 73.854992 },
    via: [{ lat: 18.513271, lng: 73.853891 }],
    distanceM: 1191 },
  // 1428 m the legal way round
  { from: 'seva-mitra-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.51389, lng: 73.856342 },
    via: [{ lat: 18.515619, lng: 73.859274 }],
    distanceM: 1428 },
  // 1570 m the legal way round
  { from: 'seva-mitra-mandal', to: 'kasba-ganpati',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.519055, lng: 73.857142 },
    via: [{ lat: 18.515619, lng: 73.859274 }],
    distanceM: 1570 },
  // 1540 m the legal way round
  { from: 'seva-mitra-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.515619, lng: 73.859274 }],
    distanceM: 1540 },
  // 1372 m the legal way round
  { from: 'seva-mitra-mandal', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.51662, lng: 73.854894 },
    via: [{ lat: 18.513271, lng: 73.853891 }],
    distanceM: 1372 },
  // 1280 m the legal way round
  { from: 'seva-mitra-mandal', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.5086563388099, lng: 73.8575649915299 }, toAt: { lat: 18.514268, lng: 73.855306 },
    via: [{ lat: 18.514532, lng: 73.853743 }],
    distanceM: 1280 },
  //  970 m the legal way round
  { from: 'shanipar-mandal', to: 'dagdusheth-halwai-ganpati',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.51514, lng: 73.856379 },
    via: [{ lat: 18.51662, lng: 73.854894 }],
    distanceM: 970 },
  // 1142 m the legal way round
  { from: 'shanipar-mandal', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    via: [{ lat: 18.51263, lng: 73.857653 }],
    distanceM: 1142 },
  //  700 m the legal way round
  { from: 'shanipar-mandal', to: 'hutatma-babu-genu-mandal',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.51389, lng: 73.856342 },
    via: [{ lat: 18.514997, lng: 73.854992 }],
    distanceM: 700 },
  // 1093 m the legal way round
  { from: 'shanipar-mandal', to: 'kasba-ganpati',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.519055, lng: 73.857142 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1093 },
  // 1062 m the legal way round
  { from: 'shanipar-mandal', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.516558, lng: 73.853881 }],
    distanceM: 1062 },
  // 1862 m the legal way round
  { from: 'shanipar-mandal', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.5217, lng: 73.8619 },
    via: [{ lat: 18.518558, lng: 73.854611 }],
    distanceM: 1862 },
  //  520 m the legal way round
  { from: 'shanipar-mandal', to: 'tulshibaug-ganpati',
    fromAt: { lat: 18.512619, lng: 73.852601 }, toAt: { lat: 18.514268, lng: 73.855306 },
    via: [{ lat: 18.514532, lng: 73.853743 }],
    distanceM: 520 },
  //  571 m the legal way round
  { from: 'tambdi-jogeshwari', to: 'kasba-ganpati',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.519055, lng: 73.857142 },
    via: [{ lat: 18.518558, lng: 73.854611 }],
    distanceM: 571 },
  //  541 m the legal way round
  { from: 'tambdi-jogeshwari', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.518558, lng: 73.854611 }],
    distanceM: 541 },
  // 1336 m the legal way round
  { from: 'tambdi-jogeshwari', to: 'trishund-ganpati-mandir',
    fromAt: { lat: 18.51662, lng: 73.854894 }, toAt: { lat: 18.5217, lng: 73.8619 },
    via: [{ lat: 18.51693, lng: 73.859438 }],
    distanceM: 1336 },
  // 1656 m the legal way round
  { from: 'trishund-ganpati-mandir', to: 'jilbya-maruti-mandal',
    fromAt: { lat: 18.5217, lng: 73.8619 }, toAt: { lat: 18.513319, lng: 73.854938 },
    via: [{ lat: 18.517583, lng: 73.855362 }],
    distanceM: 1656 },
  //  633 m the legal way round
  { from: 'tulshibaug-ganpati', to: 'balvikas-mandal',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.5174365565457, lng: 73.8550423013327 },
    via: [{ lat: 18.514532, lng: 73.853743 }],
    distanceM: 633 },
  //  695 m the legal way round
  { from: 'tulshibaug-ganpati', to: 'bhau-rangari-ganpati',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.517583, lng: 73.855362 },
    via: [{ lat: 18.514532, lng: 73.853743 }],
    distanceM: 695 },
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
  // 1861 m the legal way round
  { from: 'tulshibaug-ganpati', to: 'honaji-tarun-mandal',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.5156190173467, lng: 73.8592741338598 },
    via: [{ lat: 18.5086, lng: 73.8555 }],
    distanceM: 1861 },
  // 1278 m the legal way round
  { from: 'tulshibaug-ganpati', to: 'kasba-ganpati',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.519055, lng: 73.857142 },
    via: [{ lat: 18.513271, lng: 73.853891 }, { lat: 18.516558, lng: 73.853881 }],
    distanceM: 1278 },
  //  936 m the legal way round
  { from: 'tulshibaug-ganpati', to: 'kesariwada-ganpati',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.515811, lng: 73.849008 },
    via: [{ lat: 18.514532, lng: 73.853743 }],
    distanceM: 936 },
  //  998 m the legal way round
  { from: 'tulshibaug-ganpati', to: 'phani-ali-ganesh-mandir',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.5188, lng: 73.8571 },
    via: [{ lat: 18.514532, lng: 73.853743 }, { lat: 18.516558, lng: 73.853881 }],
    distanceM: 998 },
  //  547 m the legal way round
  { from: 'tulshibaug-ganpati', to: 'tambdi-jogeshwari',
    fromAt: { lat: 18.514268, lng: 73.855306 }, toAt: { lat: 18.51662, lng: 73.854894 },
    via: [{ lat: 18.514532, lng: 73.853743 }],
    distanceM: 547 },
];
