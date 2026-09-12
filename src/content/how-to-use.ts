/**
 * The "how to use" guide, in English and Marathi.
 *
 * Two content objects of one shape, rendered by one view. The alternative
 * was a second page file with the JSX copied, and that mirror would have
 * drifted the first time a sentence changed on one side only — which is
 * the failure mode of every translated page that is maintained by hand.
 *
 * ---------------------------------------------------------------------
 * The rule that governs the Marathi.
 *
 * The app's own interface is in English. So every label the reader has to
 * FIND AND TAP — Allow, Build my route, Optimise order, Short, Moving,
 * 30+ min, Start my darshan — stays in English on both pages, quoted
 * exactly as it appears on screen. The Marathi explains what the button
 * does; it never renames it. A translated instruction that tells someone
 * to press a word that is not on their screen is worse than no
 * translation, because they will look for it and conclude the app is
 * broken.
 *
 * Marathi that is wrong is also worse than no Marathi, and this was
 * written by someone who is not a native speaker. It is deliberately
 * plain — short sentences, no ornament — so that a Marathi reader can
 * correct a line without unpicking a paragraph. Corrections go in this
 * file and nowhere else.
 */

/** A screenshot's geometry, shared by both languages so they cannot drift. */
type ShotMeta = { src: string; w: number; h: number };

/**
 * Intrinsic size is half the capture: they are all 2x, taken from
 * production at 390x844 — a mid-size Android in portrait.
 */
export const SHOT_META = {
  'location-prompt': { src: '/guide/location-prompt.webp', w: 358, h: 268 },
  'location-on': { src: '/guide/location-on.webp', w: 390, h: 311 },
  home: { src: '/guide/home.webp', w: 390, h: 844 },
  tracker: { src: '/guide/tracker.webp', w: 358, h: 495 },
  'vote-nearby': { src: '/guide/vote-nearby.webp', w: 358, h: 191 },
  'vote-mandal': { src: '/guide/vote-mandal.webp', w: 358, h: 312 },
  'vote-too-far': { src: '/guide/vote-too-far.webp', w: 358, h: 263 },
  map: { src: '/guide/map.webp', w: 390, h: 844 },
  'map-selected': { src: '/guide/map-selected.webp', w: 390, h: 844 },
  'build-time': { src: '/guide/build-time.webp', w: 390, h: 520 },
  'build-what': { src: '/guide/build-what.webp', w: 390, h: 545 },
  'plan-before': { src: '/guide/plan-before.webp', w: 390, h: 844 },
  'plan-after': { src: '/guide/plan-after.webp', w: 390, h: 844 },
  metro: { src: '/guide/metro.webp', w: 358, h: 267 },
  navigate: { src: '/guide/navigate.webp', w: 390, h: 400 },
  explore: { src: '/guide/explore.webp', w: 390, h: 844 },
  mandal: { src: '/guide/mandal.webp', w: 390, h: 844 },
  routes: { src: '/guide/routes.webp', w: 390, h: 844 },
  'route-detail': { src: '/guide/route-detail.webp', w: 390, h: 844 },
  footer: { src: '/guide/footer.webp', w: 390, h: 517 },
  about: { src: '/guide/about.webp', w: 390, h: 844 },
} satisfies Record<string, ShotMeta>;

export type ShotId = keyof typeof SHOT_META;

/** The per-language half: what the picture shows, and what to call it. */
export type ShotText = { id: ShotId; alt: string; caption: string };

export type Step = {
  n: number;
  /** Stable across languages — the anchor, so #route works on both pages. */
  id: string;
  title: string;
  /** Two or three words for the jump chips. */
  short: string;
  /** The heading in the other language, shown small beneath the title. */
  sub: string;
  lede: string;
  dos: string[];
  shots: ShotText[];
  note?: { heading: string; body: string };
  cta?: { href: string; label: string };
};

export type GuideContent = {
  /** BCP-47, for the lang attribute and hreflang. */
  lang: 'en-IN' | 'mr-IN';
  meta: { title: string; description: string };
  path: string;
  /** The link to the other language. */
  alternate: { path: string; label: string; lang: string };
  backLabel: string;
  h1: string;
  h1Sub: string;
  intro: string;
  location: {
    heading: string;
    intro: { before: string; bold: string; after: string };
    points: string[];
    shots: ShotText[];
    blocked: { heading: string; body: string };
  };
  key: { heading: string; rows: { label: string; meaning: string }[] };
  chips: { label: string; startHere: string };
  steps: Step[];
  help: {
    heading: string;
    body: string;
    email: string;
    call: string;
    more: string;
  };
};

/* =====================================================================
   English
   ===================================================================== */

export const GUIDE_EN: GuideContent = {
  lang: 'en-IN',
  path: '/how-to-use',
  alternate: { path: '/how-to-use/marathi', label: 'मराठीत वाचा', lang: 'mr-IN' },
  meta: {
    title: 'How to use',
    description:
      'A picture-by-picture guide to Pune Ganpati Darshan — read the live queue colours, report the crowd where you are standing, and build a walking, two-wheeler or metro route around the time you actually have.',
  },
  backLabel: 'Pune Ganpati',
  h1: 'How to use this app',
  h1Sub: 'कसे वापरावे',
  intro:
    'Eight steps, each with a picture of the real screen. You do not need an account and you do not need to pay. There is one thing to say yes to, and it is the first thing below.',
  location: {
    heading: 'First: allow location',
    intro: {
      before: 'Your browser will ask for your location the moment you open the app. ',
      bold: 'Tap Allow, every time it asks.',
      after:
        ' Nothing about your location is stored — not on the server, not by us, not ever.',
    },
    points: [
      'It is what makes “near you” work — the shortest queues around you, and how far each mandal is from where you are standing.',
      'It is also what lets you report a queue at all. Without it the three buttons never appear.',
      'Your coordinates never leave your phone. The app works out on the device whether you are close enough, and sends only which mandal and which colour.',
      'No account, no name, no phone number, nothing kept and nothing sold.',
    ],
    shots: [
      {
        id: 'location-prompt',
        alt: 'A mandal page with “Turn on location to report the queue” where the report buttons would be',
        caption:
          'Location off. Tap this and the browser asks — say Allow and the three buttons take its place.',
      },
      {
        id: 'location-on',
        alt: 'The Ganpati near you row on the home screen, each card showing its distance and queue',
        caption:
          'Location on. “Ganpati near you”, with the distance and the live queue on every card.',
      },
    ],
    blocked: {
      heading: 'Blocked it by mistake?',
      body:
        'Tap the padlock or ⓘ next to the web address, set Location to Allow, and reload the page. The app also works without it — you can still browse, use the map and follow routes. You only lose “near you” and the ability to report a queue.',
    },
  },
  key: {
    heading: 'The only thing to memorise',
    rows: [
      { label: 'Short', meaning: 'Walk straight in' },
      { label: 'Moving', meaning: 'A queue, but it moves' },
      { label: '30+ min', meaning: 'Heavy, settle in' },
      { label: 'Grey', meaning: 'Not reported yet' },
    ],
  },
  chips: { label: 'Steps', startHere: 'Start here' },
  steps: [
    {
      n: 1,
      id: 'crowd',
      title: 'See which queues are short right now',
      short: 'Live crowd',
      sub: 'आत्ताची गर्दी',
      lede:
        'Open the app and the Live Crowd Tracker is already on the home page. It is the whole point of this app — the queue, not the walk, is what decides how many mandals you actually see tonight.',
      dos: [
        'The three mandals at the top are the shortest queues near you right now.',
        'Green means walk straight in. Yellow means there is a queue but it is moving. Red means thirty minutes or more.',
        'Grey means nobody has reported that one yet — not that it is empty.',
        'Every report expires after ninety minutes, so what you see is tonight, not last week.',
        'Tap “See every mandal on the map” to open the same colours across the whole city.',
      ],
      shots: [
        {
          id: 'home',
          alt: 'The Pune Ganpati Darshan home screen with the Live Crowd Tracker below the search bar',
          caption:
            'The home screen. The tracker sits right under the search box — no tapping needed.',
        },
        {
          id: 'tracker',
          alt: 'The Live Crowd Tracker showing three mandals with short queues and a colour key',
          caption:
            'The tracker in full. The colour key at the bottom is the same key the map uses.',
        },
      ],
      note: {
        heading: 'Where the colours come from',
        body:
          'Devotees standing at the mandal, nobody else. No mandal, committee or sponsor can set its own colour, and a queue is only shown once two different people have reported it — one report on its own reads “Not confirmed yet”.',
      },
    },
    {
      n: 2,
      id: 'report',
      title: 'Tell everyone what the queue looks like',
      short: 'Report a queue',
      sub: 'गर्दी कळवा',
      lede:
        'This is the part that keeps the app alive. If you are standing in the lane, three seconds of your evening tells everyone else in Pune whether to come.',
      dos: [
        'Allow location when the browser asks — every time. Your coordinates never leave your phone; the app sends only which mandal.',
        'Walk up to a mandal and a “You’re here” card appears on the home screen with the three buttons.',
        'Or open any mandal’s page and use “How’s the crowd?” — you can report from up to 5 km away.',
        'Tap Short, Moving, or 30+ min. That is the whole thing. No account, no sign-in.',
        'You can report the same mandal again after an hour, so a report near the end of a queue is welcome too.',
      ],
      shots: [
        {
          id: 'vote-nearby',
          alt: 'A “You’re here” card naming the mandal with Short, Moving and 30+ min buttons',
          caption:
            'Standing at Dagdusheth. The app names the mandal for you — you just tap the colour.',
        },
        {
          id: 'vote-mandal',
          alt: 'The Crowd right now panel on a mandal page, showing Short and the three report buttons',
          caption:
            'On any mandal page. It shows the crowd now, and lets you correct it underneath.',
        },
        {
          id: 'vote-too-far',
          alt: 'The crowd panel telling the reader they are 10 km away and cannot report',
          caption:
            'Too far, and the buttons are gone. A queue is only worth reporting if you can see it.',
        },
      ],
      note: {
        heading: 'Nothing about you is stored',
        body:
          'Your coordinates are never sent to the server — the app works out on your own phone whether you are close enough, and sends only the mandal and the colour. No name, no account, no phone number, nothing sold to anyone.',
      },
    },
    {
      n: 3,
      id: 'map',
      title: 'Open the map and see all of it at once',
      short: 'The map',
      sub: 'नकाशा',
      lede:
        'Map is the second button on the bottom bar. Every mandal in the app is on it, drawn in the colour of its queue this minute, along with the metro stations.',
      dos: [
        'The pin colour is the live queue: green, yellow, red, or grey for not yet reported.',
        'Metro stations are marked too. Mandai is drawn hollow because it is exit-only during the festival — you cannot get off there.',
        'Tap any pin and its card slides up with the crowd, the distance from you, and the same three report buttons.',
        'Tap “View Ganpati” on that card for the full page.',
        'The chips at the top — Nearby, मानाचे गणपती, Famous, Historic — narrow it down.',
      ],
      shots: [
        {
          id: 'map',
          alt: 'The map of Pune with green, yellow, red and grey mandal pins and metro stations',
          caption:
            'Green, yellow, red and grey, plus the metro stations in the peths. All 29 mandals are listed underneath.',
        },
        {
          id: 'map-selected',
          alt: 'A selected mandal card over the map with Short, Moving and 30+ min report buttons',
          caption:
            'One pin tapped. You can report the crowd from here without leaving the map.',
        },
      ],
      cta: { href: '/map', label: 'Open the map' },
    },
    {
      n: 4,
      id: 'route',
      title: 'Build your own route',
      short: 'Build a route',
      sub: 'स्वतःचा मार्ग',
      lede:
        'Short on time and want to cover as much as you can? Tap “Build my route”. It plans from where you are standing and counts the queue as well as the walk, because at the big mandals the queue is most of the evening.',
      dos: [
        'Say how long you have — one hour to six.',
        'Pick what you want: मानाचे गणपती, the famous ones, dekhava and light shows, historic mandals, calm temples, or surprise me.',
        'Choose how you are getting around — Walking, Two-wheeler or Metro.',
        'Tap Build my route and it opens your plan straight away.',
      ],
      shots: [
        {
          id: 'build-time',
          alt: 'The first question of the route builder: how long do you have, with six time options',
          caption: 'Step one. Queuing counts towards this, not just the walking.',
        },
        {
          id: 'build-what',
          alt: 'The second question: what do you want to see, with travel mode buttons underneath',
          caption:
            'Step two. Pick as many as you like, then Walking, Two-wheeler or Metro.',
        },
      ],
      cta: { href: '/start', label: 'Build a route' },
    },
    {
      n: 5,
      id: 'optimise',
      title: 'Optimise the order, then walk it',
      short: 'Optimise & go',
      sub: 'क्रम सुधारा',
      lede:
        'Your plan opens with the stops in a sensible order and a straight-line estimate. One tap turns that into the real thing.',
      dos: [
        'Tap Optimise order. It reorders the stops so you walk the least and still see all of them, and redraws the line along the actual lanes.',
        'Watch the distance change — the dotted straight line becomes a solid path that follows real streets.',
        'Drag any stop by its handle to move it, or tap ✕ to drop it.',
        'On Metro it tells you where to board, which line, how many stops and where to get off.',
        'Tap “Start my darshan” to hand the whole route to Google Maps for turn-by-turn from your front door.',
      ],
      shots: [
        {
          id: 'plan-before',
          alt: 'A darshan plan with four stops joined by dotted straight lines and an estimated distance',
          caption:
            'Before. Dotted lines, 3.5 km “estimated”, stops in the order they were picked.',
        },
        {
          id: 'plan-after',
          alt: 'The same plan after optimising, with a solid routed path and reordered stops',
          caption:
            'After Optimise order. Solid path along the lanes, stops reordered, real routed distance.',
        },
        {
          id: 'metro',
          alt: 'The metro card: board at Mandai, one stop, get off at Kasba Peth, then a 770 m walk',
          caption:
            'On Metro. Which station, which line, how many stops, and the walk at the other end.',
        },
        {
          id: 'navigate',
          alt: 'The Optimise order button above Start my darshan, which opens the route in Google Maps',
          caption:
            '“Start my darshan” opens the whole route in Google Maps, starting from where you are.',
        },
      ],
      note: {
        heading: 'It starts from you',
        body:
          'If you are already closer to stop 2 than to stop 1, the app says so and offers to begin there instead. Long routes open in Google Maps in parts, because Google takes only nine stops between start and finish — each part picks up where the last one ended, so no mandal is skipped.',
      },
    },
    {
      n: 6,
      id: 'mandals',
      title: 'Look up any mandal',
      short: 'All mandals',
      sub: 'सर्व मंडळे',
      lede:
        'Explore is the full list — every mandal in the app with its live queue on the card, searchable by name, mandal or area.',
      dos: [
        'Search by English or Marathi name, by mandal, or by peth.',
        'Each card carries the queue colour, the Manache rank where it has one, and the peth.',
        'Open one for its story, its exact spot, and the crowd right now.',
        'Get directions sends you straight there. Add to darshan drops it into your route.',
        'The heart saves it to Saved, on this phone, no account needed.',
      ],
      shots: [
        {
          id: 'explore',
          alt: 'The Explore grid of mandal cards, each with a queue badge',
          caption: 'All 29 mandals, each card showing its live queue.',
        },
        {
          id: 'mandal',
          alt: 'A mandal page for Shrimant Dagdusheth Halwai Ganpati with directions and crowd panel',
          caption:
            'A mandal page: what it is, directions, add to your darshan, and the crowd right now.',
        },
      ],
      cta: { href: '/explore', label: 'See all mandals' },
    },
    {
      n: 7,
      id: 'routes',
      title: 'Or take a ready-made route',
      short: 'Curated routes',
      sub: 'तयार मार्ग',
      lede:
        'No time to plan anything? Routes has walks already put together — the Manache Paach in ceremonial order, the Sadashiv Peth stretch after dark, the late-night one for short queues.',
      dos: [
        '“Good for right now” picks the ones that suit the actual time of day in Pune.',
        'Every route shows stops, distance and a time that already includes queuing.',
        'Open one to see the stops in order on a map.',
        'Start it from where you are, or add it to your own darshan and change it.',
      ],
      shots: [
        {
          id: 'routes',
          alt: 'The curated routes page with Good for right now and All routes sections',
          caption:
            'Curated routes. The time shown includes queuing, which is what decides whether it fits.',
        },
        {
          id: 'route-detail',
          alt: 'A single curated route with its stops drawn on a map',
          caption: 'Inside a route: the stops in order, on the map, ready to start.',
        },
      ],
      cta: { href: '/routes', label: 'Browse routes' },
    },
    {
      n: 8,
      id: 'about',
      title: 'Something wrong, or an idea? Tell the developer',
      short: 'Contact',
      sub: 'संपर्क',
      lede:
        'One person built this and there is no support desk — which means the email and the phone number at the bottom of every page reach him directly, and something you point out today can be fixed tonight.',
      dos: [
        'A mandal missing, a pin in the wrong lane, a name spelt wrong, timings that are not right — say so and it gets corrected.',
        'Ideas are just as welcome as problems. Much of what is here came from someone asking for it.',
        'Write to singhgurnoor080@gmail.com or call +91 62830 31102. Both are on the About page.',
        'If it is a mistake in the app, mention which mandal or which screen — that is usually enough to find it.',
        'Your data, in the footer, lists everything kept on your phone and clears any of it with one tap.',
      ],
      shots: [
        {
          id: 'footer',
          alt: 'The site footer with Explore, Plan and About columns',
          caption:
            'The footer, on every page. Everything in the app is reachable from here.',
        },
        {
          id: 'about',
          alt: 'The About page with the author, contact details and section links',
          caption: 'About: who built it, why, and how to reach them.',
        },
      ],
      note: {
        heading: 'Free, and not a business',
        body:
          'No ads, no fees, no account, nothing sold to anyone. An independent project run at one person’s own cost, not affiliated with any mandal, trust or festival committee — so there is nobody to complain to but him, and he reads all of it.',
      },
      cta: { href: '/about#contact', label: 'Contact details' },
    },
  ],
  help: {
    heading: 'Stuck, or spotted something wrong?',
    body:
      'Suggestions and corrections go to the same place — one person, who answers. Tell him what you saw and where.',
    email: 'Email',
    call: 'Call',
    more: 'More ways',
  },
};

/* =====================================================================
   Marathi

   Written plainly on purpose. App labels stay in English because that is
   what the reader has to tap; see the note at the top of this file.
   ===================================================================== */

export const GUIDE_MR: GuideContent = {
  lang: 'mr-IN',
  path: '/how-to-use/marathi',
  alternate: { path: '/how-to-use', label: 'Read in English', lang: 'en-IN' },
  meta: {
    title: 'अ‍ॅप कसे वापरावे',
    description:
      'पुणे गणपती दर्शन कसे वापरावे याचे चित्रांसह मार्गदर्शन — रांगेचे रंग वाचा, तुम्ही उभे असलेल्या ठिकाणची गर्दी कळवा, आणि तुमच्याकडे असलेल्या वेळेत चालत, दुचाकीने किंवा मेट्रोने मार्ग तयार करा.',
  },
  backLabel: 'पुणे गणपती',
  h1: 'हे अ‍ॅप कसे वापरावे',
  h1Sub: 'How to use this app',
  intro:
    'आठ पायऱ्या, प्रत्येकीसोबत खऱ्या स्क्रीनचा फोटो. खाते काढायची गरज नाही, पैसे द्यायची गरज नाही. फक्त एका गोष्टीला होय म्हणायचे आहे — आणि ती सर्वात पहिली खाली दिली आहे.',
  location: {
    heading: 'सर्वात आधी: लोकेशनला परवानगी द्या',
    intro: {
      before: 'अ‍ॅप उघडल्याबरोबर तुमचा ब्राउझर तुमचे लोकेशन मागेल. ',
      bold: 'जेव्हा जेव्हा विचारेल तेव्हा Allow दाबा.',
      after:
        ' तुमच्या लोकेशनबद्दल काहीही साठवले जात नाही — सर्व्हरवर नाही, आमच्याकडे नाही, कधीही नाही.',
    },
    points: [
      '“जवळचे” काम करण्यासाठी हेच लागते — तुमच्या आसपासच्या सर्वात कमी रांगा, आणि प्रत्येक मंडळ तुम्ही उभे आहात तिथून किती दूर आहे.',
      'गर्दी कळवण्यासाठीही हेच लागते. लोकेशन नसेल तर ती तीन बटणे दिसतच नाहीत.',
      'तुमचे अक्षांश-रेखांश तुमच्या फोनमधून बाहेर जात नाहीत. तुम्ही पुरेसे जवळ आहात का हे अ‍ॅप तुमच्या फोनवरच ठरवते, आणि फक्त कोणते मंडळ आणि कोणता रंग इतकेच पाठवते.',
      'खाते नाही, नाव नाही, फोन नंबर नाही, काहीही साठवले जात नाही आणि काहीही विकले जात नाही.',
    ],
    shots: [
      {
        id: 'location-prompt',
        alt: 'मंडळाच्या पेजवर रांग कळवण्याच्या बटणांच्या जागी “Turn on location to report the queue” असे दिसते',
        caption:
          'लोकेशन बंद. हे दाबल्यावर ब्राउझर विचारतो — Allow म्हणा आणि त्याच जागी तीन बटणे येतात.',
      },
      {
        id: 'location-on',
        alt: 'होम स्क्रीनवरील “Ganpati near you” ओळ, प्रत्येक कार्डावर अंतर आणि रांग',
        caption:
          'लोकेशन चालू. “Ganpati near you”, प्रत्येक कार्डावर अंतर आणि आत्ताची रांग.',
      },
    ],
    blocked: {
      heading: 'चुकून नकार दिला?',
      body:
        'वेबसाइटच्या पत्त्याशेजारचे कुलूप किंवा ⓘ दाबा, Location हे Allow करा, आणि पेज पुन्हा लोड करा. लोकेशनशिवायही अ‍ॅप चालते — मंडळे पाहता येतात, नकाशा वापरता येतो आणि मार्गांवर जाता येते. फक्त “जवळचे” आणि गर्दी कळवण्याची सोय मिळत नाही.',
    },
  },
  key: {
    heading: 'फक्त हेच लक्षात ठेवा',
    rows: [
      { label: 'Short', meaning: 'रांग कमी — सरळ आत जा' },
      { label: 'Moving', meaning: 'रांग आहे, पण सरकते आहे' },
      { label: '30+ min', meaning: 'खूप गर्दी, वेळ लागेल' },
      { label: 'Grey', meaning: 'अजून कोणी कळवलेले नाही' },
    ],
  },
  chips: { label: 'पायऱ्या', startHere: 'येथून सुरू करा' },
  steps: [
    {
      n: 1,
      id: 'crowd',
      title: 'आत्ता कोणत्या रांगा कमी आहेत ते पाहा',
      short: 'आत्ताची गर्दी',
      sub: 'Live crowd',
      lede:
        'अ‍ॅप उघडले की Live Crowd Tracker होम पेजवर आधीच दिसतो. हेच या अ‍ॅपचे मुख्य काम आहे — आज रात्री तुम्ही किती मंडळे पाहाल हे चालण्याच्या अंतरावर नाही, रांगेवर ठरते.',
      dos: [
        'वरची तीन मंडळे म्हणजे तुमच्या जवळ आत्ता सर्वात कमी रांग असलेली मंडळे.',
        'हिरवा म्हणजे सरळ आत जा. पिवळा म्हणजे रांग आहे पण सरकते आहे. लाल म्हणजे तीस मिनिटे किंवा जास्त.',
        'करडा म्हणजे ते मंडळ अजून कोणी कळवलेले नाही — ते रिकामे आहे असे नाही.',
        'प्रत्येक नोंद नव्वद मिनिटांनी संपते, म्हणून जे दिसते ते आजचे असते, गेल्या आठवड्याचे नाही.',
        '“See every mandal on the map” दाबा आणि तेच रंग अख्ख्या शहराच्या नकाशावर दिसतील.',
      ],
      shots: [
        {
          id: 'home',
          alt: 'पुणे गणपती दर्शनचे होम स्क्रीन, शोध पट्टीखाली Live Crowd Tracker',
          caption:
            'होम स्क्रीन. ट्रॅकर शोध पट्टीच्या खालीच असतो — काही दाबायची गरज नाही.',
        },
        {
          id: 'tracker',
          alt: 'Live Crowd Tracker, कमी रांग असलेली तीन मंडळे आणि रंगांची यादी',
          caption:
            'पूर्ण ट्रॅकर. खाली दिलेली रंगांची यादी नकाशावरही तीच वापरली जाते.',
        },
      ],
      note: {
        heading: 'हे रंग कुठून येतात',
        body:
          'मंडळात उभे असलेले भक्त, दुसरे कोणीही नाही. कोणतेही मंडळ, समिती किंवा प्रायोजक स्वतःचा रंग ठरवू शकत नाही, आणि दोन वेगवेगळ्या लोकांनी कळवल्यावरच रांग दाखवली जाते — एकच नोंद असेल तर “Not confirmed yet” असे दिसते.',
      },
    },
    {
      n: 2,
      id: 'report',
      title: 'रांग कशी आहे ते सर्वांना कळवा',
      short: 'गर्दी कळवा',
      sub: 'Report a queue',
      lede:
        'हा भाग अ‍ॅपला जिवंत ठेवतो. तुम्ही रांगेत उभे असाल, तर तुमच्या तीन सेकंदांमुळे पुण्यातल्या बाकी सर्वांना कळते की यायचे की नाही.',
      dos: [
        'ब्राउझर विचारेल तेव्हा लोकेशनला परवानगी द्या — प्रत्येक वेळी. तुमचे अक्षांश-रेखांश फोनमधून बाहेर जात नाहीत; अ‍ॅप फक्त कोणते मंडळ इतकेच पाठवते.',
        'मंडळाजवळ गेल्यावर होम स्क्रीनवर “You’re here” कार्ड येते, आणि त्यावर ती तीन बटणे असतात.',
        'किंवा कोणत्याही मंडळाचे पेज उघडून “How’s the crowd?” वापरा — पाच किलोमीटर अंतरावरूनही कळवता येते.',
        'Short, Moving किंवा 30+ min दाबा. इतकेच. खाते नाही, लॉगिन नाही.',
        'तासाभराने त्याच मंडळाबद्दल पुन्हा कळवता येते, म्हणून रांग संपत असतानाची नोंदही उपयोगाची आहे.',
      ],
      shots: [
        {
          id: 'vote-nearby',
          alt: 'मंडळाचे नाव असलेले “You’re here” कार्ड आणि Short, Moving व 30+ min बटणे',
          caption:
            'दगडूशेठजवळ उभे असताना. मंडळाचे नाव अ‍ॅप स्वतः ओळखते — तुम्ही फक्त रंग दाबायचा.',
        },
        {
          id: 'vote-mandal',
          alt: 'मंडळाच्या पेजवरील Crowd right now भाग, Short आणि तीन बटणे',
          caption:
            'कोणत्याही मंडळाच्या पेजवर. आत्ताची गर्दी दिसते, आणि खाली ती दुरुस्त करता येते.',
        },
        {
          id: 'vote-too-far',
          alt: 'तुम्ही १० किमी दूर आहात आणि कळवू शकत नाही असे सांगणारा भाग',
          caption:
            'फार दूर असाल तर बटणे दिसत नाहीत. रांग दिसत असेल तरच ती कळवण्यात अर्थ आहे.',
        },
      ],
      note: {
        heading: 'तुमची कोणतीही माहिती साठवली जात नाही',
        body:
          'तुमचे अक्षांश-रेखांश सर्व्हरवर कधीच पाठवले जात नाहीत — तुम्ही पुरेसे जवळ आहात का हे अ‍ॅप तुमच्या फोनवरच ठरवते, आणि फक्त मंडळ आणि रंग पाठवते. नाव नाही, खाते नाही, फोन नंबर नाही, कोणालाही काहीही विकले जात नाही.',
      },
    },
    {
      n: 3,
      id: 'map',
      title: 'नकाशा उघडा आणि सगळे एकत्र पाहा',
      short: 'नकाशा',
      sub: 'The map',
      lede:
        'खालच्या पट्टीवर Map हे दुसरे बटण आहे. अ‍ॅपमधले प्रत्येक मंडळ त्यावर आहे, या क्षणीच्या रांगेच्या रंगात, आणि सोबत मेट्रो स्थानकेही.',
      dos: [
        'पिनाचा रंग म्हणजे आत्ताची रांग: हिरवा, पिवळा, लाल, किंवा अजून न कळवलेल्यासाठी करडा.',
        'मेट्रो स्थानकेही दाखवली आहेत. मंडई पोकळ काढली आहे, कारण उत्सवात ती फक्त चढण्यासाठी आहे — तिथे उतरता येत नाही.',
        'कोणत्याही पिनावर दाबा आणि त्याचे कार्ड वर येते — गर्दी, तुमच्यापासूनचे अंतर, आणि तीच तीन बटणे.',
        'त्या कार्डावरील “View Ganpati” दाबा आणि पूर्ण पेज उघडेल.',
        'वरच्या चिप्स — Nearby, मानाचे गणपती, Famous, Historic — यादी कमी करतात.',
      ],
      shots: [
        {
          id: 'map',
          alt: 'पुण्याचा नकाशा, हिरव्या, पिवळ्या, लाल व करड्या पिनांसह आणि मेट्रो स्थानके',
          caption:
            'हिरवा, पिवळा, लाल आणि करडा, सोबत पेठांमधली मेट्रो स्थानके. खाली सर्व २९ मंडळांची यादी.',
        },
        {
          id: 'map-selected',
          alt: 'नकाशावर निवडलेल्या मंडळाचे कार्ड आणि Short, Moving व 30+ min बटणे',
          caption:
            'एक पिन दाबल्यावर. नकाशा सोडल्याशिवाय येथूनच गर्दी कळवता येते.',
        },
      ],
      cta: { href: '/map', label: 'नकाशा उघडा' },
    },
    {
      n: 4,
      id: 'route',
      title: 'स्वतःचा मार्ग तयार करा',
      short: 'स्वतःचा मार्ग',
      sub: 'Build a route',
      lede:
        'वेळ कमी आहे आणि जास्तीत जास्त मंडळे पाहायची आहेत? “Build my route” दाबा. तुम्ही जिथे उभे आहात तिथून मार्ग आखला जातो, आणि चालण्यासोबत रांगेचाही वेळ मोजला जातो — कारण मोठ्या मंडळांमध्ये रांगेतच बहुतेक संध्याकाळ जाते.',
      dos: [
        'तुमच्याकडे किती वेळ आहे ते सांगा — एक तास ते सहा तास.',
        'काय पाहायचे ते निवडा: मानाचे गणपती, प्रसिद्ध मंडळे, देखावे आणि रोषणाई, ऐतिहासिक मंडळे, शांत मंदिरे, किंवा surprise me.',
        'कसे जाणार ते निवडा — Walking, Two-wheeler किंवा Metro.',
        '“Build my route” दाबा आणि तुमचा आराखडा लगेच उघडेल.',
      ],
      shots: [
        {
          id: 'build-time',
          alt: 'मार्ग तयार करण्याचा पहिला प्रश्न: तुमच्याकडे किती वेळ आहे, सहा पर्यायांसह',
          caption: 'पहिली पायरी. यात रांगेचा वेळही मोजला जातो, फक्त चालणे नाही.',
        },
        {
          id: 'build-what',
          alt: 'दुसरा प्रश्न: तुम्हाला काय पाहायचे आहे, खाली प्रवासाच्या पद्धती',
          caption:
            'दुसरी पायरी. हवे तेवढे निवडा, नंतर Walking, Two-wheeler किंवा Metro.',
        },
      ],
      cta: { href: '/start', label: 'मार्ग तयार करा' },
    },
    {
      n: 5,
      id: 'optimise',
      title: 'क्रम सुधारा, आणि निघा',
      short: 'क्रम सुधारा',
      sub: 'Optimise & go',
      lede:
        'तुमचा आराखडा सुरुवातीला साध्या क्रमाने आणि सरळ रेषेतल्या अंदाजासह उघडतो. एका दाबाने त्याचा खरा मार्ग होतो.',
      dos: [
        '“Optimise order” दाबा. थांबे अशा क्रमाने लावले जातात की चालणे सर्वात कमी होते आणि सगळी मंडळे तरीही पाहता येतात, आणि रेषा खऱ्या गल्ल्यांवरून काढली जाते.',
        'अंतर बदलताना पाहा — ठिपक्यांची सरळ रेषा जाऊन खऱ्या रस्त्यांवरून जाणारी ठोस रेषा येते.',
        'कोणताही थांबा त्याच्या पकडीने ओढून हलवा, किंवा ✕ दाबून काढून टाका.',
        'Metro निवडले असेल तर कुठे चढायचे, कोणती लाईन, किती स्थानके आणि कुठे उतरायचे हे सांगितले जाते.',
        '“Start my darshan” दाबा आणि अख्खा मार्ग Google Maps ला दिला जातो — तुमच्या दारापासून वळणावळणाच्या सूचनांसह.',
      ],
      shots: [
        {
          id: 'plan-before',
          alt: 'चार थांबे ठिपक्यांच्या सरळ रेषांनी जोडलेला दर्शन आराखडा आणि अंदाजे अंतर',
          caption:
            'आधी. ठिपक्यांच्या रेषा, ३.५ किमी “अंदाजे”, आणि निवडल्या त्याच क्रमाने थांबे.',
        },
        {
          id: 'plan-after',
          alt: 'क्रम सुधारल्यानंतर तोच आराखडा, खऱ्या रस्त्यांवरील ठोस मार्ग आणि बदललेला क्रम',
          caption:
            '“Optimise order” नंतर. गल्ल्यांवरून जाणारा ठोस मार्ग, बदललेला क्रम, आणि खरे अंतर.',
        },
        {
          id: 'metro',
          alt: 'मेट्रो कार्ड: मंडईला चढा, एक स्थानक, कसबा पेठला उतरा, नंतर ७७० मीटर चालणे',
          caption:
            'Metro वर. कोणते स्थानक, कोणती लाईन, किती स्थानके, आणि उतरल्यावरचे चालणे.',
        },
        {
          id: 'navigate',
          alt: '“Start my darshan” च्या वर “Optimise order” बटण, जे मार्ग Google Maps मध्ये उघडते',
          caption:
            '“Start my darshan” अख्खा मार्ग Google Maps मध्ये उघडते, तुम्ही जिथे आहात तिथून.',
        },
      ],
      note: {
        heading: 'सुरुवात तुमच्यापासून',
        body:
          'थांबा १ पेक्षा थांबा २ तुम्हाला जवळ असेल, तर अ‍ॅप तसे सांगते आणि तिथून सुरू करायचे का विचारते. लांबचे मार्ग Google Maps मध्ये भागांमध्ये उघडतात, कारण Google सुरुवात आणि शेवट यांमध्ये फक्त नऊ थांबे घेते — प्रत्येक भाग आधीचा जिथे संपला तिथून सुरू होतो, म्हणून एकही मंडळ सुटत नाही.',
      },
    },
    {
      n: 6,
      id: 'mandals',
      title: 'कोणतेही मंडळ शोधा',
      short: 'सर्व मंडळे',
      sub: 'All mandals',
      lede:
        'Explore ही पूर्ण यादी — अ‍ॅपमधले प्रत्येक मंडळ, कार्डावर आत्ताची रांग, आणि नाव, मंडळ किंवा पेठेनुसार शोध.',
      dos: [
        'इंग्रजी किंवा मराठी नावाने, मंडळाच्या नावाने, किंवा पेठेने शोधा.',
        'प्रत्येक कार्डावर रांगेचा रंग, मानाचा क्रम (असेल तर), आणि पेठ असते.',
        'एखादे उघडा आणि त्याची माहिती, नेमकी जागा, आणि आत्ताची गर्दी दिसेल.',
        '“Get directions” थेट तिथे नेते. “Add to darshan” ते तुमच्या मार्गात टाकते.',
        'हृदयाचे चिन्ह ते Saved मध्ये साठवते — या फोनवर, खात्याची गरज नाही.',
      ],
      shots: [
        {
          id: 'explore',
          alt: 'Explore मधील मंडळांच्या कार्डांची मांडणी, प्रत्येकावर रांगेचा बॅज',
          caption: 'सर्व २९ मंडळे, प्रत्येक कार्डावर आत्ताची रांग.',
        },
        {
          id: 'mandal',
          alt: 'श्रीमंत दगडूशेठ हलवाई गणपतीचे पेज, दिशा आणि गर्दीचा भाग',
          caption:
            'मंडळाचे पेज: ते काय आहे, दिशा, तुमच्या दर्शनात टाकणे, आणि आत्ताची गर्दी.',
        },
      ],
      cta: { href: '/explore', label: 'सर्व मंडळे पाहा' },
    },
    {
      n: 7,
      id: 'routes',
      title: 'किंवा तयार मार्ग घ्या',
      short: 'तयार मार्ग',
      sub: 'Curated routes',
      lede:
        'काहीच ठरवायला वेळ नाही? Routes मध्ये आधीच तयार केलेले फेरे आहेत — मानाचे पाच क्रमाने, सदाशिव पेठेचा अंधार पडल्यानंतरचा टप्पा, आणि कमी रांगांसाठी उशिरा रात्रीचा.',
      dos: [
        '“Good for right now” पुण्यातल्या आत्ताच्या वेळेला शोभणारे मार्ग निवडते.',
        'प्रत्येक मार्गावर थांबे, अंतर, आणि रांगेचा वेळ धरून एकूण वेळ दिसतो.',
        'एखादा उघडा आणि थांबे क्रमाने नकाशावर पाहा.',
        'तुम्ही जिथे आहात तिथून सुरू करा, किंवा तो तुमच्या दर्शनात टाकून बदला.',
      ],
      shots: [
        {
          id: 'routes',
          alt: 'तयार मार्गांचे पेज, Good for right now आणि All routes हे भाग',
          caption:
            'तयार मार्ग. दाखवलेल्या वेळेत रांगेचा वेळ धरलेला असतो, आणि त्यावरच तो जमतो की नाही ठरते.',
        },
        {
          id: 'route-detail',
          alt: 'एका तयार मार्गाचे थांबे नकाशावर काढलेले',
          caption: 'मार्गाच्या आत: थांबे क्रमाने, नकाशावर, निघण्यासाठी तयार.',
        },
      ],
      cta: { href: '/routes', label: 'मार्ग पाहा' },
    },
    {
      n: 8,
      id: 'about',
      title: 'काही चुकले आहे, की सुचवायचे आहे? विकसकाला सांगा',
      short: 'संपर्क',
      sub: 'Contact',
      lede:
        'हे अ‍ॅप एका माणसाने बनवले आहे आणि कोणताही सपोर्ट डेस्क नाही — म्हणजे प्रत्येक पेजच्या तळाशी असलेला ईमेल आणि फोन नंबर थेट त्याच्यापर्यंत पोहोचतो, आणि आज तुम्ही सांगितलेली गोष्ट आज रात्रीच दुरुस्त होऊ शकते.',
      dos: [
        'मंडळ यादीत नाही, पिन चुकीच्या गल्लीत, नाव चुकीचे लिहिले, वेळा बरोबर नाहीत — सांगा आणि दुरुस्त होईल.',
        'अडचणींसारख्याच सूचनाही स्वागतार्ह आहेत. येथले बरेच काही कोणी मागितल्यामुळेच आले आहे.',
        'singhgurnoor080@gmail.com वर लिहा किंवा +91 62830 31102 वर फोन करा. दोन्ही About पेजवर आहेत.',
        'अ‍ॅपमधली चूक असेल तर कोणते मंडळ किंवा कोणती स्क्रीन ते सांगा — शोधायला तेवढे पुरेसे असते.',
        'तळाशी असलेले “Your data” तुमच्या फोनवर साठवलेले सर्व दाखवते आणि एका दाबात पुसते.',
      ],
      shots: [
        {
          id: 'footer',
          alt: 'साइटचा तळभाग, Explore, Plan आणि About हे स्तंभ',
          caption:
            'तळभाग, प्रत्येक पेजवर. अ‍ॅपमधले सर्व काही येथून उघडता येते.',
        },
        {
          id: 'about',
          alt: 'About पेज, बनवणाऱ्याची माहिती, संपर्क आणि विभागांचे दुवे',
          caption: 'About: कोणी बनवले, का बनवले, आणि संपर्क कसा करायचा.',
        },
      ],
      note: {
        heading: 'मोफत, आणि हा व्यवसाय नाही',
        body:
          'जाहिराती नाहीत, शुल्क नाही, खाते नाही, कोणालाही काहीही विकले जात नाही. एका माणसाने स्वतःच्या खर्चाने चालवलेला स्वतंत्र प्रकल्प, कोणत्याही मंडळ, ट्रस्ट किंवा उत्सव समितीशी संबंधित नाही — म्हणून तक्रार करायला त्याच्याशिवाय कोणी नाही, आणि तो सगळे वाचतो.',
      },
      cta: { href: '/about#contact', label: 'संपर्क तपशील' },
    },
  ],
  help: {
    heading: 'अडले आहे, की काही चुकीचे दिसले?',
    body:
      'सूचना आणि दुरुस्त्या एकाच ठिकाणी जातात — एका माणसाकडे, जो उत्तर देतो. तुम्ही काय पाहिले आणि कुठे ते सांगा.',
    email: 'ईमेल',
    call: 'फोन',
    more: 'अधिक पर्याय',
  },
};
