/**
 * Verifies the Google Maps integration against the live APIs.
 *
 * Checks each key independently so a failure names the exact cause — a
 * missing API, a referrer/IP restriction, or billing not enabled — rather
 * than surfacing as "the map didn't render".
 *
 *   BROWSER_KEY=... [SERVER_KEY=...] [BASE=http://127.0.0.1:3100] \
 *     node tools/verify-maps.mjs
 */
import { chromium } from '@playwright/test';

const BROWSER_KEY = process.env.BROWSER_KEY;
const SERVER_KEY = process.env.SERVER_KEY;
const BASE = process.env.BASE ?? 'http://127.0.0.1:3100';
const SHOTS = process.env.SHOTS ?? '/tmp';

const results = [];
const check = (n, pass, d = '') => {
  results.push({ n, pass, d });
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${n.padEnd(40)} ${d}`);
};

// Two real mandals ~236 m apart; the routed distance must exceed the
// straight line, which is how we know a real road route came back.
const KASBA = { lat: 18.5196, lng: 73.8553 };
const TAMBDI = { lat: 18.5175, lng: 73.8556 };

/* ---------------- 1. Maps JavaScript API ---------------- */
if (!BROWSER_KEY) {
  console.log('  SKIP  BROWSER_KEY not set — map checks skipped\n');
} else {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 420, height: 720 } });

  const authFailures = [];
  page.on('console', (m) => {
    const t = m.text();
    if (/InvalidKey|RefererNotAllowed|ApiNotActivated|BillingNotEnabled|ApiProjectMapError|Quota/i.test(t)) {
      authFailures.push(t.slice(0, 160));
    }
  });

  // Load the SDK in isolation first: this separates "the key is bad" from
  // "our app code is bad".
  await page.setContent('<div id="map" style="width:400px;height:600px"></div>');
  const loaded = await page.evaluate(async (key) => {
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&v=weekly&libraries=maps,marker`;
      s.onerror = () => resolve({ ok: false, reason: 'script failed to load' });
      s.onload = async () => {
        try {
          const { Map } = await google.maps.importLibrary('maps');
          const map = new Map(document.getElementById('map'), {
            center: { lat: 18.5204, lng: 73.8567 }, zoom: 15,
          });
          await new Promise((r) => google.maps.event.addListenerOnce(map, 'idle', r));
          resolve({ ok: true });
        } catch (e) { resolve({ ok: false, reason: String(e).slice(0, 140) }); }
      };
      document.head.appendChild(s);
    });
  }, BROWSER_KEY);

  await page.waitForTimeout(1500);
  check('Maps JavaScript API accepts the key',
    loaded.ok && authFailures.length === 0,
    loaded.ok ? (authFailures[0] ?? 'map reached idle') : loaded.reason);

  // Tiles actually painted? A key can authenticate and still render nothing.
  const painted = await page.evaluate(() => {
    const imgs = document.querySelectorAll('#map img');
    const canvases = document.querySelectorAll('#map canvas');
    return { imgs: imgs.length, canvases: canvases.length };
  });
  check('map tiles rendered',
    painted.imgs > 0 || painted.canvases > 0,
    `${painted.imgs} tile images, ${painted.canvases} canvases`);

  await page.screenshot({ path: `${SHOTS}/maps-sdk-raw.png` });

  /* ---------------- 2. Places API ---------------- */
  const places = await page.evaluate(async () => {
    try {
      const { AutocompleteSuggestion } = await google.maps.importLibrary('places');
      const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: 'Dagdusheth', locationBias: { lat: 18.5204, lng: 73.8567 },
        includedRegionCodes: ['in'],
      });
      return { ok: true, n: suggestions.length,
        first: suggestions[0]?.placePrediction?.text?.text?.slice(0, 60) ?? '' };
    } catch (e) { return { ok: false, reason: String(e).slice(0, 140) }; }
  });
  check('Places API returns suggestions', places.ok && places.n > 0,
    places.ok ? `${places.n} results — "${places.first}"` : places.reason);

  /* ---------------- 3. The app's own map surface ---------------- */
  const app = await page.context().newPage();
  const appErrors = [];
  app.on('console', (m) => m.type() === 'error' && appErrors.push(m.text().slice(0, 120)));
  await app.goto(`${BASE}/map`, { waitUntil: 'networkidle' });
  await app.waitForTimeout(3000);

  const unavailable = await app.getByRole('heading', { name: /Map isn.t configured|Map couldn.t load/i })
    .isVisible().catch(() => false);
  check('app /map renders a real map', !unavailable,
    unavailable ? 'still showing the unavailable state' : 'map surface active');

  await app.screenshot({ path: `${SHOTS}/maps-app-map.png` });
  await browser.close();
}

/* ---------------- 4. Routes API ---------------- */
if (!SERVER_KEY) {
  console.log('  SKIP  SERVER_KEY not set — Routes checks skipped');
} else {
  const body = {
    origin: { location: { latLng: { latitude: KASBA.lat, longitude: KASBA.lng } } },
    destination: { location: { latLng: { latitude: TAMBDI.lat, longitude: TAMBDI.lng } } },
    travelMode: 'WALK', languageCode: 'en-IN', units: 'METRIC',
  };
  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': SERVER_KEY,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  const route = json.routes?.[0];
  check('Routes API returns a walking route', res.ok && Boolean(route),
    res.ok ? `${route?.distanceMeters} m, ${route?.duration}`
           : `HTTP ${res.status}: ${(json.error?.message ?? '').slice(0, 90)}`);

  // A real street route between these two points must be longer than the
  // 236 m straight line — this is what distinguishes it from our estimate.
  if (route) {
    check('routed distance exceeds the straight line',
      route.distanceMeters > 236,
      `${route.distanceMeters} m routed vs 236 m straight-line`);
    check('polyline returned for map drawing',
      Boolean(route.polyline?.encodedPolyline),
      `${route.polyline?.encodedPolyline?.length ?? 0} chars`);
  }

  // Route Matrix powers the optimiser.
  const mres = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': SERVER_KEY,
      'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,condition',
    },
    body: JSON.stringify({
      origins: [KASBA, TAMBDI].map((p) => ({ waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lng } } } })),
      destinations: [KASBA, TAMBDI].map((p) => ({ waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lng } } } })),
      travelMode: 'WALK',
    }),
  });
  const mjson = await mres.json().catch(() => []);
  check('Route Matrix works (powers the optimiser)',
    mres.ok && Array.isArray(mjson) && mjson.length === 4,
    mres.ok ? `${mjson.length} pairs` : `HTTP ${mres.status}`);
}

const failed = results.filter((r) => !r.pass).length;
console.log(`\n  ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
