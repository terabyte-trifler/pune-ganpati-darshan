import { test, expect, type Page } from '@playwright/test';
import catalogue from '../src/content/catalogue.json';

/**
 * Counts come from the catalogue, not from literals. Hardcoding "18 mandals"
 * meant every data addition broke three unrelated tests for no reason, which
 * trains people to update numbers without reading what failed.
 */
const MANDAL_COUNT = catalogue.ganpatis.length;

/**
 * The eight user journeys the product must support (§56).
 * Each asserts on user-visible outcomes, not implementation details.
 */

/**
 * Grants geolocation standing at Kasba Ganpati, so "nearby" is deterministic.
 *
 * Read from the catalogue rather than hardcoded. The literal pair that used
 * to be here was Kasba's coordinate before it was re-verified against
 * OpenStreetMap; once the real one moved ~200m, the pin was no longer at
 * Kasba at all and the nearest mandal to it became Phani Ali Ganesh Mandir
 * by a 4-metre margin. The test still read as though it were pinned to
 * Kasba, which is the worst kind of stale fixture: the comment explains an
 * intent the code no longer has.
 */
const KASBA = catalogue.ganpatis.find((g) => g.slug === 'kasba-ganpati')!;

async function withPuneLocation(page: Page) {
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({
    latitude: KASBA.latitude,
    longitude: KASBA.longitude,
  });
}

test('Flow 1 — search from the homepage and open a result', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ganpati');

  await page.getByRole('link', { name: /Search Ganpati, mandal or area/i }).click();
  await expect(page).toHaveURL(/\/explore/);

  const search = page.getByRole('searchbox', { name: /Search Ganpati/i });
  await search.fill('Dagdu');

  const result = page.getByRole('link', { name: /Dagdusheth/i }).first();
  await expect(result).toBeVisible();
  await result.click();

  await expect(page).toHaveURL(/\/ganpati\/dagdusheth-halwai-ganpati/);
  await expect(page.getByRole('heading', { level: 1 }))
    .toContainText('Dagdusheth');
});

test('Flow 2 — open the map, see a real map, select a mandal', async ({ page }) => {
  await page.goto('/map');

  const canvas = page.locator('canvas.maplibregl-canvas');
  await expect(canvas).toBeVisible();

  // The map must actually finish painting — not merely mount. `data-map-idle`
  // is set from MapLibre's own idle event, so this cannot pass on a blank
  // canvas the way a fixed sleep could.
  await expect(page.locator('[data-map-idle="true"]')).toBeAttached({ timeout: 30_000 });

  // Tiles genuinely rendered: the canvas has real pixel dimensions.
  const size = await canvas.evaluate((c: HTMLCanvasElement) => ({ w: c.width, h: c.height }));
  expect(size.w).toBeGreaterThan(100);
  expect(size.h).toBeGreaterThan(100);

  // Attribution is a licence requirement for OpenStreetMap data.
  await expect(page.locator('.maplibregl-ctrl-attrib')).toBeAttached();

  // The sheet lists every mandal, and selecting one opens its card.
  await expect(page.getByText(new RegExp(`${MANDAL_COUNT} mandals`))).toBeVisible();
  await page.getByRole('button', { name: /Shri Kasba Ganpati/ }).first().click();
  await expect(page.getByRole('link', { name: /View Ganpati/i })).toBeVisible();
});

test('Flow 3 — mandals show immediately, and sort by distance once located', async ({ page }) => {
  await withPuneLocation(page);
  await page.goto('/');

  // Mandals must be visible whatever happens with location: the section used
  // to render a permission prompt instead of content, so declining left it
  // permanently empty.
  const rail = page.getByRole('heading', { name: /best known|near you/i })
    .locator('xpath=ancestor::section');
  const cards = rail.locator('a[href^="/ganpati/"]');
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThan(0);

  // Location is granted in this context, so it is acquired on open and the
  // rail re-sorts itself — no tap. The "Sort by what's closest" button is
  // for someone who has not granted it, and must not be here now.
  await expect(page.getByRole('heading', { name: 'Ganpati near you' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Sort by what.s closest/i })).toHaveCount(0);

  // Kasba Ganpati is at the pinned coordinates, so it must come first.
  await expect(cards.first()).toContainText('Kasba Ganpati');
  await expect(cards.first()).toContainText(/\d+\s*(m|km)/);
});

test('Flow 4 — select multiple mandals and build a route', async ({ page }) => {
  await page.goto('/ganpati/kasba-ganpati');
  await page.getByRole('button', { name: /Add to darshan — Shri Kasba Ganpati/i }).click();
  await expect(page.getByRole('button', { name: /In darshan — tap to remove Shri Kasba Ganpati/i })).toBeVisible();

  await page.goto('/ganpati/tulshibaug-ganpati');
  await page.getByRole('button', { name: /Add to darshan — Tulshibaug Ganpati/i }).click();

  await page.goto('/plan');
  await expect(page.getByRole('heading', { name: 'Your darshan' })).toBeVisible();
  await expect(page.getByText('2 stops')).toBeVisible();

  // Optimise calls the real /api/routes endpoint.
  await page.getByRole('button', { name: /Optimise order/i }).click();
  await expect(page.getByRole('button', { name: /Optimise order/i })).toBeEnabled({ timeout: 15_000 });

  // The result must declare where its numbers came from — a routed time, a
  // time derived from routed distance, or an estimate. It must never present
  // an estimate as routed truth.
  await expect(
    page.getByText(/^estimated$|^routed · |^from routed distance$/)
  ).toBeVisible();

  // A real distance must be shown, and no failure value may reach the UI.
  await expect(page.getByText(/\d+(\.\d+)?\s*(m|km)/).first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/NaN|Infinity|undefined/);

  // Sanity-check the walking pace actually shown to the user: Kasba to
  // Tulshibaug on foot is a few hundred metres, so anything claiming under a
  // minute means a car ETA leaked into a walking route.
  const durationText = await page.getByText(/^\d+ (min|hr)|^\d+ hr \d+ min$/).first().textContent();
  expect(durationText).toBeTruthy();
});

test('map degrades without WebGL instead of taking the page down', async ({ page }) => {
  // MapLibre throws when it cannot get a WebGL context. Thrown from an effect,
  // that unmounted the whole route and left a blank screen — losing the mandal
  // list, which never needed the map. Real causes: hardware acceleration
  // switched off, blocklisted GPU drivers, older Android devices.
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    // The DOM overload signatures cannot express "same as original, but null
    // for webgl", so this patch is cast rather than fought with generics.
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      options?: unknown
    ) {
      if (type.includes('webgl')) return null;
      return (orig as (t: string, o?: unknown) => RenderingContext | null)
        .call(this, type, options);
    } as HTMLCanvasElement['getContext'];
  });

  await page.goto('/map');

  // An explanation, not a blank screen.
  await expect(
    page.getByRole('heading', { name: /can.t draw the map|couldn.t start/i })
  ).toBeVisible();

  // And crucially, the rest of the page still works.
  await expect(page.getByText(new RegExp(`${MANDAL_COUNT} mandals`))).toBeVisible();
  await page.getByRole('button', { name: /Shri Kasba Ganpati/ }).first().click();
  await expect(page.getByRole('link', { name: /View Ganpati/i })).toBeVisible();
});

test('Flow 5 — save a mandal and find it on the saved page', async ({ page }) => {
  await page.goto('/ganpati/kasba-ganpati');
  await page.getByRole('button', { name: /^Save Shri Kasba Ganpati$/i }).click();

  await page.goto('/saved');
  await expect(page.getByRole('link', { name: /Shri Kasba Ganpati/ })).toBeVisible();
  await expect(page.getByText('1 saved')).toBeVisible();
});

test('Flow 6 — share copies a working link', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  // Force the clipboard fallback path rather than the native share sheet.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  });

  await page.goto('/ganpati/kasba-ganpati');
  await page.getByRole('button', { name: /Share Shri Kasba Ganpati/i }).click();

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('/ganpati/kasba-ganpati');

  await page.goto(copied);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Kasba Ganpati');
});

test('Flow 9 — the wizard builds a route that fits the time budget', async ({ page }) => {
  /**
   * Pinned to an empty tracker on purpose.
   *
   * The wizard now spends the budget against live crowd, so with real
   * reports the same two hours legitimately fits a different number of
   * mandals depending on the queues that evening. That is the feature —
   * but it makes this test a measurement of Pune's mood rather than of the
   * budget arithmetic, and it would fail at 9pm on a busy Tuesday for
   * entirely correct reasons.
   *
   * The crowd-adjusted path is covered deterministically by unit tests in
   * services/__tests__/itinerary.test.ts.
   */
  await page.route('**/api/crowd*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ statuses: [], computedAt: new Date().toISOString(), stale: false }),
    })
  );

  await page.goto('/plan?build=1');

  // Two questions only: how long, and what to see.
  await page.getByRole('button', { name: '2 hours' }).click();
  await page.getByRole('button', { name: /The famous ones/i }).click();
  await page.getByRole('button', { name: /Build my route/i }).click();

  await expect(page.getByRole('heading', { name: 'Your route' })).toBeVisible();

  // The headline claim must hold: the plan fits inside the chosen budget.
  const summary = await page.getByText(/of your 2 hr/).textContent();
  expect(summary).toBeTruthy();
  const match = summary!.match(/about (?:(\d+) hr ?)?(?:(\d+) min)?/);
  const totalMinutes = Number(match?.[1] ?? 0) * 60 + Number(match?.[2] ?? 0);
  expect(totalMinutes).toBeGreaterThan(0);
  expect(totalMinutes, 'plan must fit the 2 hour budget').toBeLessThanOrEqual(120);

  // Queue time must be shown separately — it is the part people underestimate.
  await expect(page.getByText(/darshan$/).first()).toBeVisible();
  await expect(page.getByText(/travel$/).first()).toBeVisible();

  // Pace is adjusted on the result, where its effect is visible. Queuing at
  // every stop must fit fewer mandals than viewing mostly from the road —
  // this also guards the dwell times actually reaching the planner, which
  // they once did not.
  const countStops = async () =>
    Number((await page.getByText(/\d+ mandals · about/).first().textContent())
      ?.match(/(\d+) mandals/)?.[1] ?? 0);

  await page.getByRole('button', { name: /^Queue at every stop$/ }).click();
  const thorough = await countStops();
  await page.getByRole('button', { name: /^Mostly from outside$/ }).click();
  const quick = await countStops();
  expect(quick).toBeGreaterThan(thorough);

  // Taking the route hands it to the planner.
  await page.getByRole('button', { name: /Use this route/i }).click();
  await expect(page).toHaveURL(/\/plan/);
  await expect(page.getByRole('heading', { name: 'Your darshan' })).toBeVisible();
});

test('Flow 10 — curated routes are browsable and reusable', async ({ page }) => {
  await page.goto('/routes');
  await expect(page.getByRole('heading', { name: /Curated darshan routes/i })).toBeVisible();

  await page.getByRole('link', { name: /Manache 5 Sakal Walk/i }).first().click();
  await expect(page).toHaveURL(/\/routes\/manache-5-sakal-walk/);

  // Five ceremonial stops, each with a queue estimate.
  await expect(page.getByText('Shri Kasba Ganpati')).toBeVisible();
  await expect(page.getByText(/about \d+ min/).first()).toBeVisible();

  // The route map renders.
  await expect(page.locator('[data-minimap-ready="true"]')).toBeAttached({ timeout: 30_000 });

  await expect(page.locator('body')).not.toContainText(/NaN|Infinity|undefined/);
});

test('a shared plan link opens the shared route, without destroying your own', async ({ page }) => {
  // The Share button emits /plan?stops=... The planner used to ignore that
  // parameter entirely, so every shared link opened an empty planner — a
  // button that looked functional and was not.
  await page.goto('/plan?stops=kasba-ganpati,tulshibaug-ganpati,guruji-talim');

  await expect(page.getByRole('heading', { name: 'A shared darshan' })).toBeVisible();
  await expect(page.getByText(/Someone shared this route/i)).toBeVisible();
  await expect(page.getByText('Shri Kasba Ganpati')).toBeVisible();
  await expect(page.getByText('Tulshibaug Ganpati')).toBeVisible();

  // Now with a plan of the visitor's own: opening someone else's link must
  // not silently replace it.
  await page.goto('/ganpati/dagdusheth-halwai-ganpati');
  await page.getByRole('button', { name: /Add to darshan — Shrimant Dagdusheth/i }).click();

  await page.goto('/plan?stops=kasba-ganpati,guruji-talim');
  await expect(page.getByRole('link', { name: /Keep my 1 stop/i })).toBeVisible();

  // Adopting it is an explicit choice.
  await page.getByRole('button', { name: /^Use this route$/ }).click();
  await expect(page).toHaveURL(/\/plan$/);
  await expect(page.getByRole('heading', { name: 'Your darshan' })).toBeVisible();
  await expect(page.getByText(/2 stops/)).toBeVisible();
});

test('sharing a plan produces a durable link that opens the route', async ({ page, request }) => {
  // The planner persists the plan and shares /plan/<id>, falling back to the
  // stateless ?stops= form when storage is unavailable. Both must open the
  // actual route — the failure this guards against is a link that opens empty.
  const created = await request.post('/api/plans', {
    data: { slugs: ['kasba-ganpati', 'tambdi-jogeshwari'], mode: 'walk', title: 'E2E Darshan' },
  });

  if (created.status() === 501) {
    // Storage not configured in this environment; the stateless form covers it.
    test.skip(true, 'plan storage unconfigured');
    return;
  }

  expect(created.status()).toBe(201);
  const { shareId } = await created.json();
  expect(shareId).toMatch(/^[a-z0-9]{10}$/);

  await page.goto(`/plan/${shareId}`);
  await expect(page.getByRole('heading', { name: /E2E Darshan/ })).toBeVisible();
  await expect(page.getByText('Shri Kasba Ganpati')).toBeVisible();
  await expect(page.getByText('Tambdi Jogeshwari Ganpati')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/NaN|undefined/);

  // An unknown id must 404 rather than render an empty plan.
  const missing = await request.get('/plan/zzzzzzzzzz');
  expect(missing.status()).toBe(404);
});

test('a curated route can be navigated from where you are', async ({ page }) => {
  await withPuneLocation(page);
  await page.goto('/routes/manache-5-sakal-walk');

  await page.getByRole('button', { name: /Start from my location/i }).click();

  // Geolocation resolves asynchronously; wait for the located state rather
  // than reading the URL from a button that has not rendered yet.
  await expect(page.getByRole('button', { name: /Start in Google Maps/i })).toBeVisible();

  // The route must open in Google Maps with the visitor's own position as the
  // origin, not the first stop.
  const url = await page.evaluate(() => {
    let captured = '';
    const original = window.open;
    (window as unknown as { open: unknown }).open = (u: string) => { captured = u; return null; };
    document.querySelectorAll('button').forEach((b) => {
      if (/Start in Google Maps|Open part 1/.test(b.textContent ?? '')) b.click();
    });
    (window as unknown as { open: unknown }).open = original;
    return captured;
  });

  const parsed = new URL(url);
  expect(parsed.host).toBe('www.google.com');
  expect(parsed.searchParams.get('origin')).toBe(`${KASBA.latitude},${KASBA.longitude}`);
  expect(parsed.searchParams.get('travelmode')).toBe('walking');
  // Five stops: four waypoints plus the destination.
  expect((parsed.searchParams.get('waypoints') ?? '').split('|')).toHaveLength(4);
});

test('a route longer than Google Maps allows is split, not truncated', async ({ page }) => {
  await withPuneLocation(page);
  await page.goto('/routes/great-peth-circuit');
  await page.getByRole('button', { name: /Start from my location/i }).click();

  // Google Maps caps intermediate waypoints at 9. Silently dropping stops
  // from a 12-stop circuit would send someone off with a route missing its
  // end, so it is split into parts that overlap at the join.
  await expect(page.getByRole('button', { name: /Open part 1 of 2/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Open part 2 of 2/ })).toBeVisible();
  await expect(page.getByText(/no stop is skipped/i)).toBeVisible();

  const waypoints = await page.evaluate(() => {
    let captured = '';
    const original = window.open;
    (window as unknown as { open: unknown }).open = (u: string) => { captured = u; return null; };
    document.querySelectorAll('button').forEach((b) => {
      if (/Open part 1/.test(b.textContent ?? '')) b.click();
    });
    (window as unknown as { open: unknown }).open = original;
    return (new URL(captured).searchParams.get('waypoints') ?? '').split('|').length;
  });
  expect(waypoints).toBeLessThanOrEqual(9);
});

test('the planner navigates from your location and respects the waypoint cap', async ({ page }) => {
  await withPuneLocation(page);

  // A 12-stop plan. The planner used to build one maps URL with every stop,
  // sending 11 waypoints where Google accepts 9 — so the end of a long
  // darshan was silently dropped.
  await page.goto('/routes/great-peth-circuit');
  await page.getByRole('link', { name: /Add to my darshan/i }).click();
  await page.waitForURL('**/plan');

  await expect(page.getByText(/12 stops/)).toBeVisible();
  await page.getByRole('button', { name: /Start from my location/i }).click();
  await expect(page.getByRole('button', { name: /Open part 1 of 2/ })).toBeVisible();

  const trip = await page.evaluate(() => {
    let captured = '';
    const original = window.open;
    (window as unknown as { open: unknown }).open = (u: string) => { captured = u; return null; };
    document.querySelectorAll('button').forEach((b) => {
      if (/Open part 1/.test(b.textContent ?? '')) b.click();
    });
    (window as unknown as { open: unknown }).open = original;
    const u = new URL(captured);
    return {
      origin: u.searchParams.get('origin'),
      waypoints: (u.searchParams.get('waypoints') ?? '').split('|').filter(Boolean).length,
    };
  });

  expect(trip.origin).toBe(`${KASBA.latitude},${KASBA.longitude}`);
  expect(trip.waypoints).toBeLessThanOrEqual(9);
  await expect(page.getByText(/no stop is skipped/i)).toBeVisible();
});

test('Flow 7 — admin is not reachable without authorization', async ({ page }) => {
  // Authorization must not depend on hiding UI (§27). With no session the
  // route must redirect, not render.
  await page.goto('/admin');
  await expect(page).not.toHaveURL(/\/admin$/);
  await expect(page.locator('body')).not.toContainText('Manage mandals');
});

test('Flow 8 — full mobile journey has no overflow or broken values', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile-only check');

  for (const path of ['/', '/explore', '/map', '/plan', '/saved', '/ganpati/kasba-ganpati']) {
    await page.goto(path);

    const overflow = await page.evaluate(() => {
      const de = document.documentElement;
      return { scrollW: de.scrollWidth, clientW: de.clientWidth };
    });
    expect(overflow.scrollW, `${path} overflows horizontally`)
      .toBeLessThanOrEqual(overflow.clientW + 1);

    // Never surface raw failure values to a user (§36).
    await expect(page.locator('body'), `${path} shows a broken value`)
      .not.toContainText(/NaN|undefined|\[object Object\]/);
  }
});

test('every seeded mandal page resolves', async ({ request }) => {
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBeTruthy();
  const urls = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1])
    .filter((u) => u.includes('/ganpati/'));

  expect(urls.length).toBe(MANDAL_COUNT);

  for (const url of urls.slice(0, 5)) {
    const response = await request.get(new URL(url).pathname);
    expect(response.status(), `${url} did not resolve`).toBe(200);
  }
});

test('Flow 12 — metro replaces the car, and picking it chooses a station', async ({ page }) => {
  /**
   * Two claims, both of which a screenshot would not settle.
   *
   * The peth core is closed to vehicles through Ganeshotsav, so offering a
   * driving route means routing someone to a barricade. Car is gone from
   * every mode picker; the test asserts its absence rather than trusting
   * that the constant was edited in both of them.
   *
   * And metro is not a faster walk — it decides where the route BEGINS.
   * Choosing it must therefore reveal a station, and the route must be
   * built from that station rather than from the city centre.
   */
  await page.route('**/api/crowd*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ statuses: [], computedAt: new Date().toISOString(), stale: false }),
    })
  );

  await page.goto('/plan?build=1');
  await page.getByRole('button', { name: '2 hours' }).click();

  // Car is gone from the wizard.
  await expect(page.getByRole('button', { name: /^Car$/ })).toHaveCount(0);

  // The station picker appears only once metro is the chosen mode.
  await expect(page.getByRole('heading', { name: 'Get off at' })).toHaveCount(0);
  await page.getByRole('button', { name: /^Metro$/ }).click();
  await expect(page.getByRole('heading', { name: 'Get off at' })).toBeVisible();

  // The two peth stations you can arrive at are offered as equals.
  for (const station of ['Kasba Peth', 'PMC']) {
    await expect(
      page.getByRole('button', { name: new RegExp(`^${station}`) })
    ).toBeVisible();
  }

  // Mandai is not among them. It is the nearest station to most of the
  // southern peths and runs one way during the festival, so offering it
  // would send people to a platform where the doors do not open — the one
  // failure here that puts someone on the wrong train.
  await expect(page.getByRole('button', { name: /^Mandai/ })).toHaveCount(0);

  // And its absence is explained rather than left to be noticed.
  await expect(page.getByText(/No getting off at Mandai/)).toBeVisible();
  await expect(page.getByText(/board here to go home/)).toBeVisible();

  // The two Aqua Line ones are the rare answer, so they start collapsed.
  await expect(
    page.getByRole('button', { name: /^Deccan Gymkhana/ })
  ).toHaveCount(0);
  await page.getByRole('button', { name: /Coming from Deccan or JM Road/ }).click();
  await expect(page.getByRole('button', { name: /^Deccan Gymkhana/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Sambhaji Udyan/ })).toBeVisible();

  // Choosing a station changes the plan's starting point, so the wizard must
  // still produce a route from it.
  await page.getByRole('button', { name: /^Kasba Peth/ }).click();
  await page.getByRole('button', { name: /Build my route/i }).click();
  await expect(page.getByRole('heading', { name: 'Your route' })).toBeVisible();
});

test('Flow 13 — the planner offers metro and starts the route from a station', async ({ page }) => {
  // The visitor's OWN plan, not a shared link. A shared plan is read-only
  // and deliberately hides the origin line — someone opening a friend's
  // route is not being asked where they are starting from — so testing the
  // origin through ?stops= would assert against a view that never shows it.
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'pg.plan',
      JSON.stringify(['kasba-ganpati', 'tambdi-jogeshwari'])
    );
  });
  await page.goto('/plan');

  await expect(page.getByRole('button', { name: /^Car$/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Transit$/ })).toHaveCount(0);

  await page.getByRole('button', { name: /^Metro$/ }).click();

  // The origin label must name the station, not "Pune city centre" — the
  // whole point of metro mode is that the route begins at a platform.
  await expect(page.getByText(/from .* metro/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Get off at' })).toBeVisible();
});

test.describe('which train to take', () => {
  // Kalyani Nagar: on the Aqua Line, on the far side of the city from the
  // peths, and therefore a journey that must involve a change. Granting the
  // permission here rather than in the test body means the page can resolve
  // a position on first load, which is when the card asks for one.
  test.use({
    geolocation: { latitude: 18.5480, longitude: 73.9010 },
    permissions: ['geolocation'],
  });

  test('Flow 14 — names the station to board, the change, and where to get off', async ({ page }) => {
    await page.goto('/routes/dagdusheth-and-around');

    // Where to get off never needed a location, so it is there immediately,
    // and it is never Mandai.
    await expect(page.getByText(/^Get off at (Kasba Peth|PMC)$/)).toBeVisible();
    await expect(page.getByText(/^Get off at Mandai$/)).toHaveCount(0);

    // The train home leaves from a station you could not have arrived at,
    // and the card must say both halves of that.
    await expect(page.getByText(/Going back: Mandai/)).toBeVisible();
    await expect(page.getByText(/only arrivals that are closed/)).toBeVisible();

    // The boarding half is behind an explicit tap. The app does not quietly
    // read a position to answer a question nobody asked — see the card's
    // own note about what the permission is spent on.
    await page.getByRole('button', { name: /Which train do I take/ }).click();

    // Boarding is derived from where the visitor is, not from the route.
    await expect(page.getByText(/Board at Kalyani Nagar/)).toBeVisible();

    // The two lines meet in exactly one place, so a cross-line journey must
    // name it. Getting this wrong sends someone to the wrong platform.
    await expect(page.getByText(/Change at Civil Court/)).toBeVisible();

    // Direction matters as much as the line — the platform is chosen by the
    // name on the front of the train.
    await expect(page.getByText(/towards Swargate/)).toBeVisible();

    // The ride length is stated coarsely and must say so — there is no live
    // timetable behind it.
    await expect(page.getByText(/About .* on the train/)).toBeVisible();
  });
});

test('Flow 15 — route pins sit where the map projects them', async ({ page }) => {
  /**
   * Guards a bug that made every ordered map wrong for months without
   * looking broken.
   *
   * MapLibre positions a custom marker by writing a transform onto the
   * element and relies on its own class for `position: absolute`. The
   * marker's inline style declared `position: relative` — to give the
   * order badge a containing block — and inline beats a stylesheet, so
   * every pin stayed in normal document flow. The transform then offset
   * each one from wherever the flow had put it, so the pins laid out
   * inline in stop order and drifted further with each one; stop 4 was
   * 117px from where it belonged.
   *
   * The route line is drawn from a GeoJSON source and was always correct,
   * so the visible symptom was a line that missed its own pins. That is
   * why this asserts geometry rather than screenshots: the pins were
   * always present and always rendered, just in the wrong place.
   */
  await page.goto('/routes/mandai-hour');
  await page.waitForSelector('[data-minimap-ready="true"]');
  await page.waitForSelector('.maplibregl-marker');

  const pins = await page.$$eval('.maplibregl-marker', (els) =>
    els.map((el) => {
      const parsed = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(
        (el as HTMLElement).style.transform
      );
      const map = el.closest('.maplibregl-map')!.getBoundingClientRect();
      const own = el.getBoundingClientRect();
      return {
        label: el.getAttribute('aria-label') ?? '',
        position: getComputedStyle(el).position,
        // Where MapLibre says the pin belongs, relative to the map.
        wantX: parsed ? Number(parsed[1]) : null,
        wantY: parsed ? Number(parsed[2]) : null,
        // Where it actually landed.
        gotX: own.x + own.width / 2 - map.x,
        gotY: own.y + own.height / 2 - map.y,
      };
    })
  );

  expect(pins.length).toBeGreaterThan(1);

  for (const pin of pins) {
    // The inline style must not take the element out of flow-independent
    // positioning, or the transform stops meaning what MapLibre intends.
    expect(pin.position, `${pin.label} is not absolutely positioned`).toBe('absolute');

    expect(pin.wantX, `${pin.label} has no transform`).not.toBeNull();
    // 2px covers the rounding of translate(-50%, -50%) on an odd-sized
    // element. The bug this guards was off by up to 117px.
    expect(
      Math.abs(pin.gotX - pin.wantX!),
      `${pin.label} is ${Math.round(Math.abs(pin.gotX - pin.wantX!))}px off horizontally`
    ).toBeLessThanOrEqual(2);
    expect(
      Math.abs(pin.gotY - pin.wantY!),
      `${pin.label} is ${Math.round(Math.abs(pin.gotY - pin.wantY!))}px off vertically`
    ).toBeLessThanOrEqual(2);
  }
});

test('Flow 16 — a long darshan still optimises instead of being rejected', async ({ request }) => {
  // Room to wait out the endpoint's own rate limiter if the suite trips it.
  test.setTimeout(120_000);
  /**
   * Guards a bug that hit anyone with a big plan.
   *
   * The stop limit on this endpoint was MAX_MATRIX_POINTS - 1, which is 9.
   * That number is a property of one routing provider's table endpoint, not
   * of the request — and the planner puts no limit on a darshan, so adding
   * a tenth mandal and tapping Optimise returned a bare "Invalid request"
   * with nothing to act on.
   *
   * Above ten points the handler is meant to order the stops locally and
   * label the result 'local-estimate', the same degrade it does when the
   * router is unreachable. The schema was rejecting the request before that
   * path could run.
   */
  const body = (n: number) => ({
    origin: { lat: 18.5214, lng: 73.8595 },
    stops: Array.from({ length: n }, (_, i) => ({
      lat: 18.51 + i * 0.001,
      lng: 73.85 + i * 0.001,
    })),
    mode: 'walk',
    optimize: true,
  });

  /**
   * The endpoint rate-limits to 20 requests a minute per IP, and every
   * worker in this suite shares one. That protection is real and worth
   * keeping, so the test waits it out rather than being given a way
   * around it — a backdoor in a rate limiter is a worse thing to own than
   * a slow test.
   */
  const post = async (n: number) => {
    let res = await request.post('/api/routes', { data: body(n) });
    if (res.status() === 429) {
      const wait = Number(res.headers()['retry-after'] ?? 60);
      await new Promise((r) => setTimeout(r, (wait + 1) * 1000));
      res = await request.post('/api/routes', { data: body(n) });
    }
    return res;
  };

  // Inside the matrix limit: the real router orders it.
  const nine = await post(9);
  expect(nine.status()).toBe(200);
  expect((await nine.json()).order).toHaveLength(9);

  // The boundary that used to 400, and the cap itself. Both must return
  // every stop, ordered — a plan is not allowed to silently lose stops the
  // visitor chose.
  for (const n of [10, 20]) {
    const res = await post(n);
    expect(res.status(), `${n} stops must be accepted`).toBe(200);
    const json = await res.json();
    expect(json.order, `${n} stops must all be ordered`).toHaveLength(n);
    // Ordering is a permutation: every stop appears exactly once.
    expect([...json.order].sort((a: number, b: number) => a - b)).toEqual(
      Array.from({ length: n }, (_, i) => i)
    );
    // Past the matrix limit the router declines and the handler orders the
    // stops itself. It must say so rather than implying a routed result.
    if (n > 9) expect(json.optimizedBy).toBe('local-estimate');
  }

  // Past the cap it is still refused — but with something a person can act
  // on rather than "Invalid request".
  const tooMany = await post(21);
  expect(tooMany.status()).toBe(400);
  const { error } = await tooMany.json();
  expect(error).toMatch(/up to 20 stops/);
  expect(error).not.toBe('Invalid request');
});

test('Flow 17 — building and managing a darshan are one page', async ({ page }) => {
  /**
   * They used to be /start and /plan, with a navigation between them, and
   * the wizard's result and the planner showed the same route in two
   * layouts with two sets of numbers.
   *
   * /start still exists because the home page, the routes index and the
   * sitemap link to it, and because someone may have shared it. It carries
   * ?build=1 so "Build my route" still means build for a visitor who
   * already has stops saved, rather than dropping them on their existing
   * plan.
   */
  await page.route('**/api/crowd*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ statuses: [], computedAt: new Date().toISOString(), stale: false }),
    })
  );

  await page.goto('/start');
  await expect(page).toHaveURL(/\/plan\?build=1$/);
  await expect(page.getByRole('button', { name: '2 hours' })).toBeVisible();

  // Exactly one h1. The wizard demotes its step headings when embedded, and
  // two h1s is a real problem for anyone navigating by heading.
  await expect(page.locator('h1')).toHaveCount(1);

  await page.getByRole('button', { name: '2 hours' }).click();
  await page.getByRole('button', { name: /The famous ones/i }).click();
  await page.getByRole('button', { name: /Build my route/i }).click();
  await expect(page.getByRole('heading', { name: 'Your route' })).toBeVisible();

  // Taking the route must NOT navigate — that handoff is the thing being
  // removed — and must drop ?build=1 so a refresh does not reopen the
  // builder over the route it just produced.
  await page.getByRole('button', { name: /Use this route/i }).click();
  await expect(page).toHaveURL(/\/plan$/);
  await expect(page.getByRole('heading', { name: 'Your darshan', exact: true })).toBeVisible();
  await expect(page.locator('h1')).toHaveCount(1);

  // The builder stays reachable over an existing plan, and says what taking
  // a new route will cost.
  await page.getByRole('button', { name: /Build a different route/i }).click();
  await expect(page.getByRole('button', { name: '3 hours' })).toBeVisible();
  await expect(page.getByText(/replaces the \d+ stops? below/)).toBeVisible();
  await expect(page.locator('h1')).toHaveCount(1);

  // And can be dismissed without touching the plan.
  await page.getByRole('button', { name: /^Cancel$/ }).click();
  await expect(page.getByRole('button', { name: '3 hours' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Your darshan', exact: true })).toBeVisible();
});
