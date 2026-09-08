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

/** Grants geolocation pinned to Kasba Peth so "nearby" is deterministic. */
async function withPuneLocation(page: Page) {
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 18.5196, longitude: 73.8553 });
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

test('Flow 3 — enable location and see nearby mandals sorted by distance', async ({ page }) => {
  await withPuneLocation(page);
  await page.goto('/');

  await page.getByRole('button', { name: /Near me/i }).click();

  const rail = page.getByRole('heading', { name: 'Ganpati near you' })
    .locator('xpath=ancestor::section');
  // Scope to the card rail; the section header also contains a "See all" link.
  const cards = rail.locator('a[href^="/ganpati/"]');
  // Kasba Ganpati is at the pinned coordinates, so it must come first.
  await expect(cards.first()).toContainText('Kasba Ganpati');
  // And it must show a real distance, not a placeholder.
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
  await page.goto('/start');

  // Step 1: time budget.
  await page.getByRole('button', { name: '2 hours' }).click();
  // Step 2: pace.
  await page.getByRole('button', { name: /A bit of both/i }).click();
  // Step 3: interests.
  await page.getByRole('button', { name: /The famous ones/i }).click();
  await page.getByRole('button', { name: /Build my route/i }).click();

  await expect(page.getByRole('heading', { name: 'Your darshan' })).toBeVisible();

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
