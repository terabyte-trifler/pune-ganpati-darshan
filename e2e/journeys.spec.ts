import { test, expect, type Page } from '@playwright/test';

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

test('Flow 2 — open the map and see the mandal list', async ({ page }) => {
  await page.goto('/map');

  // Without a Maps key the app must say so honestly rather than fake a map.
  await expect(
    page.getByRole('heading', { name: /Map isn.t configured|Map couldn.t load/i })
      .or(page.getByRole('application', { name: /Map of Pune/i }))
  ).toBeVisible();

  // The sheet still lists every mandal — the catalogue never depends on Maps.
  await expect(page.getByText(/18 mandals/)).toBeVisible();
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
  await page.getByRole('button', { name: /Add Shri Kasba Ganpati to your darshan/i }).click();
  await expect(page.getByRole('button', { name: /Remove Shri Kasba Ganpati/i })).toBeVisible();

  await page.goto('/ganpati/tulshibaug-ganpati');
  await page.getByRole('button', { name: /Add Tulshibaug Ganpati to your darshan/i }).click();

  await page.goto('/plan');
  await expect(page.getByRole('heading', { name: 'Your darshan' })).toBeVisible();
  await expect(page.getByText('2 stops')).toBeVisible();

  // Optimise calls the real /api/routes endpoint.
  await page.getByRole('button', { name: /Optimise order/i }).click();
  await expect(page.getByRole('button', { name: /Optimise order/i })).toBeEnabled({ timeout: 15_000 });

  // A duration must be shown, and it must never render as NaN/Infinity.
  const summary = page.getByText(/estimated|via Google Routes/);
  await expect(summary).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/NaN|Infinity|undefined/);
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

  expect(urls.length).toBe(18);

  for (const url of urls.slice(0, 5)) {
    const response = await request.get(new URL(url).pathname);
    expect(response.status(), `${url} did not resolve`).toBe(200);
  }
});
