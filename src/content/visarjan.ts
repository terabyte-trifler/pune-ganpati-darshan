/**
 * Visarjan day: the traffic order, the procession route, and the order of
 * the Manache Paach.
 *
 * ---------------------------------------------------------------------
 * What this file claims, and what it refuses to.
 *
 * The closures, the parking ban and the heavy-vehicle ban are quoted from
 * the Pune City Traffic Police notice for Anant Chaturdashi, signed by DCP
 * (Traffic) Dr Sandeep Bhajibhakare and reported on 23–24 September 2026.
 *
 * Shivaji Road is a lesson worth keeping. Two aggregators said it closed
 * at 05:00 and one said 09:00, and this file took the majority — which was
 * wrong. The Indian Express, reporting the police list in full, has only
 * Laxmi Road closing at 05:00 and Shivaji Road at 09:00 alongside Tilak
 * Road. Counting sources is not the same as weighing them, and the map
 * carried a four-hour error on a drawn stretch until the fuller report was
 * read. The times below now follow that report.
 *
 * What this file does NOT carry is a departure time for each mandal. Only
 * Kasba's is published: its procession leaves after the 9 a.m. pooja, as
 * the city's gramdaivat and the first of the Manache Paach. Every mandal
 * behind it goes when the one in front of it has moved, and on a day that
 * runs into the next morning those times drift by hours. A schedule we
 * invented would read as authoritative and send people to an empty lane
 * at 3 a.m. `crowd-prior.ts` already refuses this guess for queue waits;
 * this file refuses it for the procession, for the same reason.
 *
 * The honest answer to "where has the miravnuk reached" is the police's
 * own live tracker, which carries the front and rear of the procession.
 * We link it rather than copy it: a stale position is worse than none.
 *
 * The order of the Manache Paach is not sourced here at all — it is in the
 * catalogue as `manache_rank`, which is the app's own data and matches the
 * traditional precedence. See the note in project memory: that order
 * encodes precedence, not geography, and must never be re-sorted.
 */

export const VISARJAN_SOURCE = {
  authority: 'Pune City Traffic Police',
  signedBy: 'DCP (Traffic) Dr Sandeep Bhajibhakare',
  /** Anant Chaturdashi. */
  date: '2026-09-25',
  /** When this file was written from the published reports. */
  captured: '2026-09-24',
  reports: [
    { name: 'The Indian Express', url: 'https://indianexpress.com/article/cities/pune/pune-ganesh-visarjan-traffic-road-closures-heavy-vehicle-ban-2026-10890893/' },
    { name: 'Punekar News', url: 'https://www.punekarnews.in/pune-ganpati-visarjan-2026-roads-closing-from-5-am-check-your-route-before-leaving/' },
    { name: 'Pune Pulse', url: 'https://www.mypunepulse.com/pune-ganesh-visarjan-traffic-2026-17-roads-to-close-major-diversions-and-48-hour-heavy-vehicle-ban/' },
  ],
} as const;

/** The police's own live procession tracker. Verified reachable 24 Sep 2026. */
export const POLICE_TRACKER = {
  url: 'https://diversion.punepolice.gov.in/',
  label: 'diversion.punepolice.gov.in',
  /** What they say it carries, in their terms. */
  shows:
    'the front and rear of the immersion procession, which roads are open ' +
    'or closed, and the designated parking places',
  /**
   * Their own notice: "Visarjan Tracking will start on 25th September
   * 2026, at 9 AM."
   *
   * Worth repeating here because the link is the first thing on our page
   * and it is empty until then — forty-two devices are sitting at their
   * mandals with no names on them. Someone tapping through at six in the
   * morning finds nothing moving and reasonably concludes our link is
   * broken, when the tracker is simply not open yet.
   *
   * Written as a plain fact rather than shown only before 9am: the page
   * is cached for an hour, so a time-conditional line would be wrong for
   * up to an hour either side of the one moment it matters.
   */
  opensAt: 'The police open tracking at 9 a.m., once Kasba has set off.',
} as const;

export interface VisarjanClosure {
  /** Closing time, IST, as published. */
  from: string;
  /** The road, as the notice names it. */
  road: string;
  /** The stretch, between the two points the notice gives. */
  stretch: string;
  /** Set when the sources disagreed and we had to choose. */
  disputed?: string;
  /**
   * Something known on the ground that the notice does not say.
   *
   * Kept in its own field, and rendered in its own voice, because the
   * rest of this file is quoted from a police order and this is not. A
   * local report can be more current than the order — the order is
   * written days ahead and the barricades go where the officer on the
   * junction puts them — but it must never be read as the order itself.
   */
  localNote?: string;
}

/**
 * Seventeen stretches, in the order the notice closes them. Closures hold
 * until the procession finishes on 26 September, and the police change
 * them on the day as the crowd moves.
 */
export const VISARJAN_CLOSURES: VisarjanClosure[] = [
  { from: '05:00', road: 'Laxmi Road', stretch: 'Sant Kabir Chowk to Alka Talkies Chowk' },
  { from: '09:00', road: 'Shivaji Road', stretch: 'Kakasaheb Gadgil statue to Jedhe Chowk' },
  { from: '09:00', road: 'Tilak Road', stretch: 'Jedhe Chowk to Tilak Chowk' },
  { from: '09:00', road: 'Bagade Road', stretch: 'Sonya Maruti Chowk to Phadke Haud Chowk' },
  { from: '09:00', road: 'Guru Nanak Road', stretch: 'Devjibaba Chowk to Hamzekhan Chowk' },
  { from: '10:00', road: 'Bajirao Road', stretch: 'Savarkar Chowk to Futka Buruj Chowk' },
  { from: '10:00', road: 'Kumthekar Road', stretch: 'Tilak Chowk to Chitale Corner Chowk' },
  { from: '10:00', road: 'Ganesh Road', stretch: 'Daruwala Bridge to Jijamata Chowk' },
  { from: '10:00', road: 'Kelkar Road', stretch: 'Budhwar Chowk to Alka Talkies Chowk' },
  { from: '10:00', road: 'Shastri Road', stretch: 'Senadatta Chowk to Alka Talkies Chowk' },
  {
    from: '11:00',
    road: 'Jangli Maharaj Road',
    stretch: 'Jhansi Rani Chowk to Khandoji Baba Chowk',
    localNote:
      'Reported locally as shut only from Bal Gandharva onwards — half ' +
      'the stretch rather than all of it. Bal Gandharva stands between ' +
      'the two points the notice names, so this narrows the order rather ' +
      'than contradicting it.',
  },
  { from: '11:00', road: 'Fergusson College Road', stretch: 'Khandoji Baba Chowk to the Fergusson College main gate' },
  { from: '12:00', road: 'Bhandarkar Road', stretch: 'PYC Gymkhana to Goodluck Chowk' },
  { from: '12:00', road: 'Pune–Satara Road', stretch: 'Volga Chowk to Jedhe Chowk' },
  { from: '12:00', road: 'Solapur Road', stretch: 'Seven Loves Chowk to Jedhe Chowk' },
  { from: '12:00', road: 'Prabhat Road', stretch: 'Deccan Post to Bhelare Mama Chowk' },
  {
    from: '12:00',
    road: 'Karve Road',
    stretch: 'Nal Stop to Khanduji Baba Chowk',
    disputed:
      'Two reports list this stretch; the fullest one does not, though it ' +
      'names Nal Stop as a diversion point on Karve Road. Kept, because ' +
      'the police count of seventeen roads needs it.',
  },
];

/** The four roads the procession itself takes. */
export const PROCESSION_ROUTE = {
  roads: ['Laxmi Road', 'Tilak Road', 'Kumthekar Road', 'Kelkar Road'],
  convergesAt: 'Alka Talkies Chowk',
  /** As reported for 2026. */
  mandals: 638,
} as const;

export interface VisarjanRestriction {
  title: string;
  detail: string;
}

export const VISARJAN_RESTRICTIONS: VisarjanRestriction[] = [
  {
    title: 'No parking from 23:00 tonight',
    detail:
      'On Laxmi, Kelkar, Kumthekar, Tilak, Bajirao, Shivaji, Shastri, ' +
      'Jangli Maharaj, Karve and Fergusson College roads, and the 100 m ' +
      'between Khanduji Baba Chowk and Hotel Vaishali.',
  },
  {
    title: 'No heavy vehicles for 48 hours',
    detail:
      'Barred from entering the city from 00:01 on 25 September until ' +
      'midnight on 26 September.',
  },
  {
    title: 'Closures hold into the next day',
    detail:
      'The roads reopen as the procession clears them, not at a set hour. ' +
      'The police change the plan on the day as the crowd moves.',
  },
];

/**
 * The one departure time that is actually published. Everything behind it
 * follows the mandal in front, so no other time belongs on this page.
 */
export const KASBA_START =
  'Shri Kasba Ganpati, the city’s gramdaivat and the first of the ' +
  'Manache Paach, sets the day going — see the timeline above. The rest ' +
  'follow in order behind it, each when the one ahead has moved, which is ' +
  'why only two mandals in this catalogue have a departure time worth ' +
  'printing.';

/**
 * Visarjan-day timings.
 *
 * ---------------------------------------------------------------------
 * Why this list is short, and why it stays short.
 *
 * Two of the thirty mandals in the catalogue have published a schedule
 * for 25 September; the rest have not, and each of them moves when the
 * mandal ahead of it moves. So this carries the citywide spine the
 * Police Commissioner gave, the two mandal schedules that exist, and
 * nothing else.
 *
 * Every entry below was checked against the one trap this subject is
 * full of: the aagman timings from 14 September are widely republished
 * and read exactly like visarjan timings. Kasba's "11:45 pran-pratishtha"
 * and Tambdi Jogeshwari's "10 a.m. from Mandar Lodge" are arrival-day
 * times and are deliberately NOT here, however often they surface in a
 * search for the procession.
 *
 * These are start times, not a timetable. The procession runs into the
 * next morning and the back of it slips by hours; a mandal's listed hour
 * is when it intends to set off, not when it will pass any given corner.
 */

export interface ScheduleEntry {
  /** IST, as published. A range where the source gave one. */
  time: string;
  what: string;
  /** Short display name, for the row's tag. Absent for citywide entries. */
  mandal?: string;
  /** Mandal slug, where the entry belongs to one in the catalogue. */
  slug?: string;
  source: 'police' | 'mandal';
}

/** The citywide spine, from the Police Commissioner's briefing. */
export const VISARJAN_TIMELINE: ScheduleEntry[] = [
  { time: '06:00', what: 'Police ground deployment takes effect across all sectors', source: 'police' },
  {
    time: '07:00 – 07:30',
    what: 'Anant Chaturdashi puja',
    mandal: 'Bhausaheb Rangari',
    slug: 'bhau-rangari-ganpati',
    source: 'mandal',
  },
  {
    time: '08:00',
    what: 'Onto the Shri Vighnaharta Rath, which moves to the Lokmanya Tilak statue at Mandai',
    mandal: 'Bhausaheb Rangari',
    slug: 'bhau-rangari-ganpati',
    source: 'mandal',
  },
  {
    time: '09:00',
    what: 'Reaches the Lokmanya Tilak statue for aarti, as the first of the Manache Paach',
    mandal: 'Kasba',
    slug: 'kasba-ganpati',
    source: 'police',
  },
  {
    time: '09:30',
    what: 'Moves from the Tilak statue towards Belbaug Chowk',
    mandal: 'Kasba',
    slug: 'kasba-ganpati',
    source: 'police',
  },
  {
    time: '09:30',
    what: 'Begins its procession, as the second of the Manache Paach',
    mandal: 'Tambdi Jogeshwari',
    slug: 'tambdi-jogeshwari',
    source: 'mandal',
  },
  {
    time: '09:30',
    what: 'Begins from the Tilak statue at Mandai, as the third',
    mandal: 'Guruji Talim',
    slug: 'guruji-talim',
    source: 'mandal',
  },
  {
    time: '10:15',
    what: 'The formal immersion procession commences from Belbaug Chowk, and the central route opens',
    source: 'police',
  },
  {
    time: '16:00',
    what: 'Sets off from its temple for Belbaug Chowk and the Sambhaji Maharaj bridge',
    mandal: 'Dagdusheth',
    slug: 'dagdusheth-halwai-ganpati',
    source: 'mandal',
  },
  {
    time: '17:00 – 17:30',
    what: 'The chariot joins the main procession on Laxmi Road, on a route it has taken for 135 years',
    mandal: 'Bhausaheb Rangari',
    slug: 'bhau-rangari-ganpati',
    source: 'mandal',
  },
];

/** Where the timeline's two kinds of entry come from. */
export const TIMELINE_SOURCES = {
  police:
    'Pune Police, from Commissioner Amitesh Kumar’s visarjan briefing, ' +
    'reported by Punekar News on 24 September 2026',
  mandal: 'The mandal’s own published schedule, reported by Punekar News on 24 September 2026',
  policeUrl:
    'https://www.punekarnews.in/pune-ganesh-visarjan-2026-over-10000-cops-deployed-safety-prioritised-over-procession-speed-says-cp-amitesh-kumar/',
  mandalUrl:
    'https://www.punekarnews.in/pune-ganesh-visarjan-2026-bhausaheb-rangari-ganpati-visarjan-schedule-route-and-key-attractions/',
} as const;

/** How many of the catalogue's mandals have published a schedule. */
export const MANDALS_WITH_SCHEDULES = 5;

/**
 * Why three mandals all say 09:30.
 *
 * Kasba, Tambdi Jogeshwari and Guruji Talim — the first three of the
 * Manache Paach — each published the same hour from the same place. That
 * is not three sources contradicting each other about one procession; it
 * is the Manache Paach assembling at the Lokmanya Tilak statue at Mandai
 * and moving off in precedence order, which is exactly what their
 * precedence means. Kasba leads, and the rest follow it down Laxmi Road.
 */
export const MANACHE_ASSEMBLY =
  'The first three of the Manache Paach each give 09:30 at the Lokmanya ' +
  'Tilak statue, Mandai. They are not setting off in three directions: ' +
  'they gather there and move off in precedence order, Kasba first.';

/**
 * A mandal's own checkpoint schedule along the route.
 *
 * Different in kind from VISARJAN_TIMELINE, and more useful: not "when
 * does it set off" but "where will it be at four o'clock". Someone
 * deciding which corner to stand on is asking the second question.
 *
 * Kasba's is published by the mandal trust as a graphic titled
 * "विसर्जन मिरवणूक लक्ष्मी रस्त्याकरीता वेळेचे व्यवस्थापन" — time
 * management for the visarjan procession on Laxmi Road. Its first two
 * checkpoints, 09:30 at the Tilak statue and 10:15 at Belbaug Chowk,
 * match the Police Commissioner's briefing exactly. Two independent
 * sources agreeing is the firmest ground anything on this page stands on.
 *
 * Still a plan, not a promise. The procession is famous for running late,
 * and an hour here is the mandal's intention rather than an observation —
 * which is why the live tracker stays at the top of the page.
 */

export interface RouteCheckpoint {
  /** Transliterated, for a reader who does not read Devanagari. */
  place: string;
  /** As printed on the mandal's own graphic. */
  placeMr: string;
  /** IST, 24-hour. */
  time: string;
}

export interface MandalRouteSchedule {
  slug: string;
  /** The mandal, as the catalogue names it. */
  mandal: string;
  /** What the schedule covers, in the mandal's own framing. */
  title: string;
  titleMr: string;
  source: string;
  checkpoints: RouteCheckpoint[];
}

export const MANDAL_ROUTE_SCHEDULES: MandalRouteSchedule[] = [
  {
    slug: 'kasba-ganpati',
    mandal: 'Shri Kasba Ganpati',
    title: 'Timings along Laxmi Road',
    titleMr: 'विसर्जन मिरवणूक लक्ष्मी रस्त्याकरीता वेळेचे व्यवस्थापन',
    source: 'Shri Kasba Ganpati Sarvajanik Ganeshotsav Mandal Trust, Pune',
    checkpoints: [
      { time: '09:30', place: 'Lokmanya Tilak Putala (Mandai)', placeMr: 'लोकमान्य टिळक पुतळा (मंडई)' },
      { time: '10:15', place: 'Belbaug Chowk', placeMr: 'बेलबाग चौक' },
      { time: '10:40', place: 'Ganpati Chowk', placeMr: 'गणपती चौक' },
      { time: '11:15', place: 'Shri Limbraj Maharaj Chowk (Vaibhav Chowk)', placeMr: 'श्री लिंबराज महाराज चौक (वैभव चौक)' },
      { time: '11:45', place: 'Kunte Chowk', placeMr: 'कुंटे चौक' },
      { time: '12:35', place: 'Umbrya Ganpati Chowk', placeMr: 'उंबऱ्या गणपती चौक' },
      { time: '13:00', place: 'Bhanuvilas Chowk', placeMr: 'भानुविलास चौक' },
      { time: '13:45', place: 'Vijay Talkies Chowk', placeMr: 'विजय टॉकीज चौक' },
      { time: '14:30', place: 'Garud Ganpati Chowk', placeMr: 'गरूड गणपती चौक' },
      { time: '14:45', place: 'Tilak Chowk', placeMr: 'टिळक चौक' },
    ],
  },
];

/**
 * Where motorists are turned around.
 *
 * The police named ten junctions as diversion points — the places you
 * will be stopped and sent another way once the procession reaches the
 * road behind them. That is a different fact from "this road is closed",
 * and more actionable: a closure tells you where not to go, a diversion
 * point tells you where the decision gets made for you.
 *
 * `lat`/`lng` are present only where the junction is on the police's own
 * closure map, which the app already carries with coordinates. The rest
 * are listed by name and deliberately not placed: geocoding Pune chowk
 * names put "Tilak Chowk" in Nigdi, seventeen kilometres away, and a
 * diversion point dropped on the wrong junction is worse than one the
 * reader locates themselves.
 */
export interface DiversionPoint {
  name: string;
  /** The road the police name it on. */
  road: string;
  lat?: number;
  lng?: number;
}

export const DIVERSION_POINTS: DiversionPoint[] = [
  { name: 'Jhansi Rani Chowk', road: 'Jangli Maharaj Road' },
  { name: 'Kakasaheb Gadgil statue', road: 'Shivaji Road', lat: 18.521518, lng: 73.855174 },
  { name: 'Apollo Talkies', road: 'Mudaliar Road' },
  { name: 'Daruwala Bridge', road: 'Mudaliar Road' },
  { name: 'Sant Kabir police chowky', road: 'Laxmi Road', lat: 18.515364, lng: 73.868662 },
  { name: 'Seven Loves Chowk', road: 'Solapur Road' },
  { name: 'Volga Chowk', road: 'Satara Road' },
  { name: 'Savarkar Chowk', road: 'Bajirao Road' },
  { name: 'Senadatta police chowky', road: 'Lal Bahadur Shastri Road', lat: 18.502992, lng: 73.845384 },
  { name: 'Nal Stop', road: 'Karve Road', lat: 18.508591, lng: 73.831437 },
];

/**
 * The way round, for anyone who has to cross the city by vehicle.
 *
 * Advisory rather than a route: the police describe a ring of roads
 * around the procession corridor and regulate junctions along it as the
 * restrictions come in, so the usable path changes through the day.
 */
export const RING_ROAD_ADVICE =
  'Motorists are asked to keep out of the procession corridor altogether ' +
  'and go round it: Karve Road and Nal Stop, Law College Road, Senapati ' +
  'Bapat Road, Ganeshkhind Road, Shivajinagar and the university area, ' +
  'and Satara Road at Volga Chowk. Junctions along it are regulated as ' +
  'the closures come in, so treat it as a direction rather than a route.';

/** Roads carrying a no-parking order alongside the diversions. */
export const NO_PARKING_ROADS = [
  'Jangli Maharaj Road', 'Shivaji Road', 'Mudaliar Road', 'Laxmi Road',
  'Solapur Road', 'Satara Road', 'Bajirao Road', 'Lal Bahadur Shastri Road',
  'Karve Road', 'Fergusson College Road',
];

/** Areas outside the centre with their own arrangements for the day. */
export const OUTLYING_AREAS = ['Dhayari Phata', 'Keshav Nagar–Mundhwa', 'Sasane Nagar–Hadapsar'];

/**
 * A mandal's route as an ordered sequence, with no times on the stops.
 *
 * Kasba publishes an hour against each chowk; most mandals publish the
 * order and a departure time and nothing else. Both are worth carrying
 * and they are different shapes, so they are different structures —
 * putting Dagdusheth into the checkpoint type would mean inventing nine
 * times to fill the fields, which is the one thing this file refuses.
 *
 * The order alone answers a real question: whether the procession is
 * coming towards you or has already gone past.
 */
export interface MandalRoutePath {
  slug: string;
  mandal: string;
  /** Published departure, IST. */
  startsAt: string;
  /** From where, in the mandal's own words. */
  startsFrom: string;
  startsFromMr: string;
  /** In order. Transliteration first, Devanagari as the mandal wrote it. */
  stops: { place: string; placeMr: string }[];
  /** Where it ends. */
  endsAt: string;
  endsAtMr: string;
}

export const MANDAL_ROUTE_PATHS: MandalRoutePath[] = [
  {
    slug: 'dagdusheth-halwai-ganpati',
    mandal: 'Shrimant Dagdusheth Halwai Ganpati',
    startsAt: '16:00',
    startsFrom: 'the Dagdusheth Halwai Ganpati temple',
    startsFromMr: 'श्रीमंत दगडूशेठ हलवाई गणपती मंदिर',
    stops: [
      { place: 'Belbaug Chowk', placeMr: 'बेलबाग चौक' },
      { place: 'Ganpati Chowk', placeMr: 'गणपती चौक' },
      { place: 'Nagarkar Talim Chowk', placeMr: 'नगरकर तालीम चौक' },
      { place: 'Umbrya Ganpati Chowk', placeMr: 'उंबऱ्या गणपती चौक' },
      { place: 'Lokmanya Tilak Chowk', placeMr: 'लोकमान्य टिळक चौक' },
      { place: 'Chhatrapati Sambhaji Maharaj bridge', placeMr: 'छत्रपती संभाजी महाराज पूल' },
    ],
    endsAt: 'the immersion ghat at Shri Panchaleshwar Mandir',
    endsAtMr: 'विसर्जन घाट – श्री पांचाळेश्वर मंदिर',
  },
];
