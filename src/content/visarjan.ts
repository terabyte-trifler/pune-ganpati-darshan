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
 * Two outlets disagreed on Shivaji Road — 05:00 in one, 09:00 in another —
 * and the majority reading (05:00) is used, flagged here rather than
 * silently averaged.
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
}

/**
 * Seventeen stretches, in the order the notice closes them. Closures hold
 * until the procession finishes on 26 September, and the police change
 * them on the day as the crowd moves.
 */
export const VISARJAN_CLOSURES: VisarjanClosure[] = [
  { from: '05:00', road: 'Laxmi Road', stretch: 'Sant Kabir Chowki to Alka Talkies Chowk' },
  {
    from: '05:00',
    road: 'Shivaji Road',
    stretch: 'Kakasaheb Gadgil statue to Jedhe Chowk',
    disputed: 'One report gave 09:00 for this stretch; two gave 05:00.',
  },
  { from: '09:00', road: 'Tilak Road', stretch: 'Jedhe Chowk to Tilak Chowk' },
  { from: '09:00', road: 'Bagade Road', stretch: 'Sonya Maruti Chowk to Phadke Haud Chowk' },
  { from: '09:00', road: 'Guru Nanak Road', stretch: 'Devjibaba Chowk to Hamzekhan Chowk' },
  { from: '10:00', road: 'Bajirao Road', stretch: 'Savarkar Chowk to Futka Buruj Chowk' },
  { from: '10:00', road: 'Kumthekar Road', stretch: 'Tilak Chowk to Chitale Corner' },
  { from: '10:00', road: 'Ganesh Road', stretch: 'Daruwala Bridge to Jijamata Chowk' },
  { from: '10:00', road: 'Kelkar Road', stretch: 'Budhwar Chowk to Alka Talkies Chowk' },
  { from: '10:00', road: 'Shastri Road', stretch: 'Senadatta Chowk to Alka Talkies Chowk' },
  { from: '11:00', road: 'Jangli Maharaj Road', stretch: 'Jhansi Rani Chowk to Khandoji Baba Chowk' },
  { from: '11:00', road: 'Fergusson College Road', stretch: 'Khandoji Baba Chowk to the FC main gate' },
  { from: '12:00', road: 'Karve Road', stretch: 'Nal Stop to Khanduji Baba Chowk' },
  { from: '12:00', road: 'Bhandarkar Road', stretch: 'PYC Gymkhana to Nataraj Chowk, via Goodluck Chowk' },
  { from: '12:00', road: 'Pune–Satara Road', stretch: 'Volga Chowk to Jedhe Chowk' },
  { from: '12:00', road: 'Solapur Road', stretch: 'Seven Loves Chowk to Jedhe Chowk' },
  { from: '12:00', road: 'Prabhat Road', stretch: 'Deccan Post Office to Shelar Mama Chowk' },
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
  /** Mandal slug, where the entry belongs to one in the catalogue. */
  slug?: string;
  source: 'police' | 'mandal';
}

/** The citywide spine, from the Police Commissioner's briefing. */
export const VISARJAN_TIMELINE: ScheduleEntry[] = [
  { time: '06:00', what: 'Police ground deployment takes effect across all sectors', source: 'police' },
  {
    time: '07:00 – 07:30',
    what: 'Bhausaheb Rangari: Anant Chaturdashi puja',
    slug: 'bhau-rangari-ganpati',
    source: 'mandal',
  },
  {
    time: '08:00',
    what: 'Bhausaheb Rangari: the idol is placed on the Shri Vighnaharta Rath, which moves to the Lokmanya Tilak statue at Mandai',
    slug: 'bhau-rangari-ganpati',
    source: 'mandal',
  },
  {
    time: '09:00',
    what: 'Kasba Ganpati, the first of the Manache Paach, reaches the Lokmanya Tilak statue for aarti',
    slug: 'kasba-ganpati',
    source: 'police',
  },
  {
    time: '09:30',
    what: 'Kasba Ganpati moves from the Tilak statue towards Belbaug Chowk',
    slug: 'kasba-ganpati',
    source: 'police',
  },
  {
    time: '10:15',
    what: 'The formal immersion procession commences from Belbaug Chowk, and the central route opens',
    source: 'police',
  },
  {
    time: '17:00 – 17:30',
    what: 'Bhausaheb Rangari: the chariot joins the main procession on Laxmi Road, on a route it has taken for 135 years',
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
export const MANDALS_WITH_SCHEDULES = 2;
