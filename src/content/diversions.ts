import { PARKING_SOURCE } from './parking';

/**
 * Road closures and the junctions named with them, from the same Pune
 * City Traffic Police map as the parking list.
 *
 * ---------------------------------------------------------------------
 * What the source says, and what it does not.
 *
 * The police map puts all of this in one layer, titled "Road Closures
 * after 17:00". So the times and the closures are theirs. What the map
 * does NOT do is label the junction pins: 23 of them are dropped on that
 * layer, eleven unnumbered and twelve numbered 1 to 12, with no text
 * saying whether each is a barricade, a no-entry, a turning point or a
 * police post.
 *
 * This file therefore calls them what they verifiably are — junctions
 * named on the closure plan — and nothing more. Writing "diverted here"
 * or "no entry" beside a pin would be inventing an instruction on behalf
 * of the police, which is the one thing this data must never be used for.
 *
 * `LINE_7_NOTE` exists because one stretch is called "Line 7": a Google
 * My Maps default name the planner never replaced. It is kept verbatim
 * rather than guessed at from its coordinates.
 *
 * Timing is the risk here, not geometry. A closure is a fact about
 * tonight; this is a plan published before the festival and police
 * arrangements change on the day. Every surface that shows it must date
 * it and say so — see PARKING_SOURCE.captured, shared with the parking
 * list because it is the same capture of the same map.
 */

export const DIVERSION_SOURCE = PARKING_SOURCE;

/** The layer title on the police map, quoted rather than paraphrased. */
export const CLOSURE_LAYER_TITLE = 'Road Closures after 17:00';

export const LINE_7_NOTE =
  'Called "Line 7" on the police map — an unnamed stretch, kept as published.';

export interface RoadClosure {
  /** The police map's own label for the stretch. */
  name: string;
  /** Their description, where they gave one. Often the two end points. */
  note: string;
  /** [lng, lat] pairs, as drawn. */
  path: [number, number][];
}

export interface ClosureJunction {
  /** Their number where they numbered it; eleven pins are unnumbered. */
  no: number | null;
  name: string;
  /** The map's own label, verbatim, spelling and all. */
  sourceName: string;
  lat: number;
  lng: number;
}

export const ROAD_CLOSURES: RoadClosure[] = [
  { name: "Shaniwar wada Chowk - Gotiram ck", note: "", path: [[73.855087, 18.521701], [73.85528, 18.521355], [73.855506, 18.520907], [73.856096, 18.520256], [73.856171, 18.520063], [73.856214, 18.519137], [73.856281, 18.518577], [73.856284, 18.518221], [73.856284, 18.516875], [73.856241, 18.516422], [73.85626, 18.515933], [73.856297, 18.5156], [73.856395, 18.51515], [73.856687, 18.51465], [73.857095, 18.514035], [73.857481, 18.513053], [73.85765, 18.512618], [73.857919, 18.511807], [73.857919, 18.510851], [73.858058, 18.508674], [73.85809, 18.506926], [73.85809, 18.50658], [73.858331, 18.506137], [73.858621, 18.505695], [73.858825, 18.504962], [73.858991, 18.504377], [73.859066, 18.504214], [73.859086, 18.503943], [73.859022, 18.503734], [73.858818, 18.502529], [73.858652, 18.501781], [73.858587, 18.50143], [73.858501, 18.500906], [73.858458, 18.500595]] },
  { name: "Laxmi Rd", note: "Hajekhan Chowk to Tilak Chowk", path: [[73.861834, 18.516111], [73.861341, 18.51605], [73.860853, 18.515974], [73.860692, 18.515928], [73.860118, 18.516004], [73.859946, 18.516014], [73.859367, 18.516004], [73.858772, 18.515963], [73.858053, 18.515856], [73.85783, 18.515841], [73.85723, 18.51579], [73.856918, 18.515762], [73.856661, 18.515729], [73.856334, 18.515658], [73.856208, 18.515605], [73.856076, 18.515594], [73.855913, 18.5155], [73.855357, 18.515134], [73.855286, 18.515086], [73.855048, 18.51501], [73.854848, 18.514923], [73.854453, 18.514713], [73.85423, 18.514606], [73.853979, 18.51455], [73.853804, 18.514513], [73.853685, 18.514502], [73.85352, 18.514497], [73.852498, 18.514471], [73.852361, 18.514471], [73.851873, 18.514404], [73.851117, 18.5143], [73.850508, 18.514231], [73.85014, 18.514198], [73.84795, 18.513933], [73.847217, 18.513863], [73.846702, 18.513818], [73.846364, 18.513788], [73.846157, 18.513741], [73.845567, 18.513576], [73.845334, 18.513472], [73.844931, 18.513278], [73.844317, 18.512953], [73.844124, 18.512925], [73.843985, 18.512902], [73.843781, 18.512808]] },
  { name: "Bajirao Rd", note: "Puram Chowk to ABC Chowk", path: [[73.853575, 18.505435], [73.853661, 18.505994], [73.853736, 18.506716], [73.853693, 18.507866], [73.853758, 18.508548], [73.853769, 18.509341], [73.853784, 18.510072], [73.853816, 18.510815], [73.853849, 18.511954], [73.853892, 18.512758], [73.853881, 18.513205], [73.853774, 18.51464], [73.853757, 18.515098], [73.853779, 18.515658], [73.853881, 18.516558]] },
  { name: "Tilak Rd", note: "Hira baugh to marratha Chowk", path: [[73.858511, 18.501007], [73.858082, 18.501455], [73.856168, 18.503229], [73.855276, 18.504023], [73.8548, 18.504407]] },
  { name: "Rashtrabhushan to hira baugh", note: "", path: [[73.859086, 18.503943], [73.858579, 18.503955], [73.857785, 18.503971], [73.856948, 18.504026], [73.856331, 18.504042], [73.855671, 18.504042], [73.855276, 18.504023]] },
  { name: "Line 7", note: "", path: [[73.858054, 18.508753], [73.858257, 18.508753], [73.858559, 18.508722], [73.858908, 18.508649], [73.859171, 18.508589], [73.859345, 18.508571], [73.859426, 18.508573], [73.859708, 18.508595], [73.859966, 18.508633], [73.860481, 18.508729], [73.860717, 18.508757], [73.861045, 18.50881], [73.86126, 18.508817], [73.861406, 18.508796], [73.861606, 18.508805], [73.862014, 18.508869], [73.862264, 18.508892], [73.862804, 18.508938], [73.863335, 18.509007], [73.864053, 18.509075], [73.864649, 18.509157], [73.864872, 18.509218]] },
  { name: "sinhagad garege ghorpadipeth to ratrabhushan chowk", note: "", path: [[73.859087, 18.503917], [73.860337, 18.5038], [73.86119, 18.503716], [73.861523, 18.503376], [73.861609, 18.503101], [73.861646, 18.502724], [73.861662, 18.502287], [73.86185, 18.50189], [73.862097, 18.501666]] },
  { name: "dinkar javalkar path to hirabhug chowk", note: "", path: [[73.855673, 18.506668], [73.855686, 18.50607], [73.855692, 18.505849], [73.855665, 18.505615], [73.855606, 18.505396], [73.855448, 18.505139], [73.855262, 18.504877], [73.855131, 18.504725], [73.8548, 18.504407]] },
  { name: "anant naik path to tilak road", note: "", path: [[73.857287, 18.502918], [73.856541, 18.503656]] },
  { name: "sanas road gotiram bhayya chowk to govind halwai chowk", note: "", path: [[73.857706, 18.512648], [73.858411, 18.512745], [73.858773, 18.512813], [73.859219, 18.512872], [73.859624, 18.512923], [73.860098, 18.51304], [73.860329, 18.513096], [73.860528, 18.513172], [73.861029, 18.513187], [73.861203, 18.513183], [73.861356, 18.513147], [73.861469, 18.513125]] },
  { name: "panghanti chowk to ganjpeth chowki", note: "", path: [[73.859387, 18.508582], [73.85959, 18.508595], [73.859752, 18.508611], [73.85993, 18.508639], [73.860023, 18.508653], [73.860186, 18.508687], [73.860466, 18.508748], [73.860734, 18.508778], [73.860962, 18.508822], [73.861212, 18.508839], [73.861467, 18.508816], [73.861923, 18.50888], [73.862244, 18.508926]] },
  { name: "ganjpeth chowk to veer lahuji vastad talim kade", note: "", path: [[73.862275, 18.508914], [73.862684, 18.508944], [73.863039, 18.508979], [73.86332, 18.509017], [73.863584, 18.509046], [73.863821, 18.509066], [73.864134, 18.509101], [73.864456, 18.509149], [73.86485, 18.509235]] },
  { name: "central street chowki to gaonkasai masjid", note: "", path: [[73.877947, 18.513919], [73.877906, 18.513761], [73.877898, 18.513624], [73.877903, 18.513463], [73.877911, 18.513292], [73.877918, 18.513079], [73.877931, 18.512871], [73.877933, 18.512579], [73.877943, 18.512375], [73.877948, 18.512197], [73.877949, 18.512006], [73.87794, 18.511908], [73.877944, 18.511784], [73.877942, 18.511614], [73.87794, 18.511448], [73.877935, 18.511253], [73.87794, 18.511067], [73.877948, 18.510926], [73.877956, 18.510804], [73.877965, 18.510686], [73.877972, 18.510523], [73.877981, 18.510346], [73.878006, 18.510139], [73.878033, 18.510005], [73.878038, 18.509862], [73.878046, 18.509735], [73.878051, 18.509573], [73.878063, 18.509305], [73.878066, 18.509136], [73.878065, 18.509001], [73.878071, 18.508805], [73.878074, 18.50862], [73.878051, 18.508496], [73.878011, 18.508443]] },
];

export const CLOSURE_JUNCTIONS: ClosureJunction[] = [
  { no: null, name: "Mandai Chowk", sourceName: "mandai chowk", lat: 18.513445, lng: 73.855866 },
  { no: null, name: "Sanipar Chowk", sourceName: "sanipar chowk", lat: 18.513271, lng: 73.853891 },
  { no: null, name: "Aapaa Ballvant Chowk", sourceName: "aapaa ba;lvant chowk", lat: 18.516558, lng: 73.853881 },
  { no: null, name: "Sevasadan Chowk", sourceName: "sevasadan chowk", lat: 18.514532, lng: 73.853743 },
  { no: null, name: "Futka Buruj", sourceName: "futka buruj", lat: 18.518592, lng: 73.85459 },
  { no: null, name: "Gadgill Putala", sourceName: "Gadgill\u00a0 putala", lat: 18.521518, lng: 73.855174 },
  { no: null, name: "Kumbhar Ves Chowk", sourceName: "kumbhar\u00a0 ves chowk", lat: 18.523892, lng: 73.85795 },
  { no: null, name: "Fadake Haud Chowk", sourceName: "fadake haud chowk", lat: 18.5187, lng: 73.859597 },
  { no: null, name: "Moti Chowk", sourceName: "moti chowk", lat: 18.51693, lng: 73.859438 },
  { no: null, name: "Sonya Maruti Chowk", sourceName: "sonya maruti chowk", lat: 18.516042, lng: 73.859423 },
  { no: null, name: "Gotiram Bhayya Chowk", sourceName: "gotiram bhayya chowk", lat: 18.51263, lng: 73.857653 },
  { no: 1, name: "Senadutt Chowk", sourceName: "1.Senadutt chowk", lat: 18.502992, lng: 73.845384 },
  { no: 2, name: "Jedhe Chowk", sourceName: "2.Jedhe chowk", lat: 18.500475, lng: 73.858528 },
  { no: 3, name: "Sanipar Chowk", sourceName: "3 Sanipar chowk", lat: 18.512602, lng: 73.857694 },
  { no: 4, name: "Sant Kabir Chowk", sourceName: "4. Sant kabir chowk", lat: 18.515364, lng: 73.868662 },
  { no: 5, name: "Futaka Buruj", sourceName: "5. Futaka buruj", lat: 18.518558, lng: 73.854611 },
  { no: 6, name: "Puram Chowk", sourceName: "6. Puram chowk", lat: 18.50536, lng: 73.853618 },
  { no: 7, name: "Gadgil Putala", sourceName: "7.Gadgil putala", lat: 18.52158, lng: 73.855126 },
  { no: 8, name: "Nalstop Chowk", sourceName: "8. Nalstop Chowk", lat: 18.508591, lng: 73.831437 },
  { no: 9, name: "Khandojibaba Chowk", sourceName: "9.Khandojibaba chowk", lat: 18.514534, lng: 73.842376 },
  { no: 10, name: "S. Go. Barve Chowk", sourceName: "10. S. Go. Barve chowk", lat: 18.527421, lng: 73.851317 },
  { no: 11, name: "Rajaram Pool", sourceName: "11. Rajaram pool", lat: 18.487762, lng: 73.828912 },
  { no: 12, name: "Power House Chowk", sourceName: "12.Power house chowk", lat: 18.519409, lng: 73.868306 },
];
