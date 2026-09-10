import { test, expect, type Page } from '@playwright/test';
import catalogue from '../src/content/catalogue.json';

/**
 * Crowd intelligence, end to end.
 *
 * These run against the real API and the real database, so each test mints
 * its own device id rather than sharing one. Two tests using the same id
 * would race on the one-report-per-hour rule and fail each other
 * intermittently — the kind of flake that gets a suite disabled.
 *
 * A handful of real reports land in the database as a result. They age out
 * of the active window in 90 minutes and are deleted by the retention
 * sweep, so they neither linger nor distort anything for long.
 */

/** RFC 4122 v4 — the API validates the version and variant bits. */
function deviceId(): string {
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 36; i++) {
    if ([8, 13, 18, 23].includes(i)) out += '-';
    else if (i === 14) out += '4';
    else if (i === 19) out += hex[8 + Math.floor(Math.random() * 4)];
    else out += hex[Math.floor(Math.random() * 16)];
  }
  return out;
}

/**
 * A distinct client address per test.
 *
 * Every request in this suite originates from 127.0.0.1, so without this
 * the per-IP write limiter sees one client making dozens of reports a
 * minute and starts refusing them — the tests would be measuring the rate
 * limiter rather than what they claim to test, and would fail depending
 * on which ran first. Each test represents a different devotee, so it gets
 * a different address, which is what a reverse proxy sets in production.
 *
 * This is only safe to spoof here because the app is not exposed directly:
 * behind Vercel or Cloudflare this header is OVERWRITTEN, not appended.
 * See docs/07-crowd.md — deploying without such a proxy makes IP limiting
 * bypassable, which is why it is the outermost layer and never the only
 * one.
 */
let clientCounter = 0;
function clientHeaders(): Record<string, string> {
  clientCounter += 1;
  const n = clientCounter + Math.floor(Math.random() * 10_000);
  return { 'X-Forwarded-For': `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}` };
}

/** Seed a fresh device id before any script runs, so the page picks it up. */
async function withFreshDevice(page: Page, id = deviceId()) {
  await page.setExtraHTTPHeaders(clientHeaders());
  await page.addInitScript((value) => {
    window.localStorage.setItem('ganpatigo_device_id', value);
    // Clear any restored snapshot so the panel starts from the network.
    window.localStorage.removeItem('ganpatigo_crowd_snapshot');
  }, id);
  return id;
}

/**
 * Stand the browser at a mandal.
 *
 * Reporting is now refused beyond 1.5 km, so a test that submits one has
 * to be somewhere plausible — an ungeolocated browser sees an explanation
 * instead of buttons, which is the feature working rather than a failure.
 *
 * Done per test with setGeolocation rather than a file-level test.use,
 * because these tests report on different mandals and one fixed position
 * cannot be near all of them: Sarasbaug is 1.9 km from Dagdusheth and
 * Morya Gosavi is fifteen.
 */
async function standAt(page: Page, mandal: { latitude: number; longitude: number }) {
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({
    latitude: mandal.latitude,
    longitude: mandal.longitude,
    accuracy: 20,
  });
}

const SLUG = catalogue.ganpatis[0].slug;

test('the crowd panel appears on a mandal page and offers all three levels', async ({ page }) => {
  await withFreshDevice(page);
  await standAt(page, catalogue.ganpatis[0]);
  await page.goto(`/ganpati/${SLUG}`);

  const panel = page.getByRole('region', { name: /crowd right now/i });
  await expect(panel).toBeVisible();

  await expect(panel.getByRole('button', { name: 'Short' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Moving' })).toBeVisible();
  await expect(panel.getByRole('button', { name: '30+ min' })).toBeVisible();
});

test('submitting a report is acknowledged and starts the cooldown', async ({ page }) => {
  await withFreshDevice(page);
  await standAt(page, catalogue.ganpatis[0]);
  await page.goto(`/ganpati/${SLUG}`);

  const panel = page.getByRole('region', { name: /crowd right now/i });
  await panel.getByRole('button', { name: 'Moving' }).click();

  await expect(panel.getByText(/thanks/i)).toBeVisible();
  await expect(panel.getByText(/helps other devotees/i)).toBeVisible();

  // During the thank-you there is nothing to tap that the server would
  // refuse.
  await expect(panel.getByRole('button', { name: 'Moving' })).toHaveCount(0);

  // The thank-you then retires and hands the row back — disabled, and
  // carrying the reason. It used to stop at "Thanks" until a reload, which
  // hid the reading the report had just moved.
  const moving = panel.getByRole('button', { name: 'Moving' });
  await expect(moving).toBeVisible({ timeout: 15_000 });
  await expect(moving).toBeDisabled();
  await expect(panel.getByText(/you can report it again/i)).toBeVisible();

  // The level this device chose is announced, not just outlined.
  await expect(moving).toHaveAttribute('aria-pressed', 'true');
});

test('the cooldown is enforced by the server, not just the button state', async ({ page, request }) => {
  const id = await withFreshDevice(page);
  const mandalId = catalogue.ganpatis[0].id;

  // First report through the API directly, as a modified client would.
  const first = await request.post(`/api/crowd/${mandalId}/report`, {
    data: { deviceId: id, status: 'short' },
    headers: clientHeaders(),
  });
  expect(first.status()).toBe(201);

  // Second one from the same device. localStorage is irrelevant here —
  // this is a raw HTTP call, exactly what someone bypassing the UI would
  // send (§11, §31).
  const second = await request.post(`/api/crowd/${mandalId}/report`, {
    data: { deviceId: id, status: 'long' },
    headers: clientHeaders(),
  });
  expect(second.status()).toBe(429);

  const body = await second.json();
  expect(body.success).toBe(false);
  expect(body.reason).toBe('cooldown');
  expect(body.retryAfter).toBeGreaterThan(0);
});

test('a report on one mandal does not block reporting another', async ({ request }) => {
  const id = deviceId();
  const [a, b] = catalogue.ganpatis;

  expect(
    (await request.post(`/api/crowd/${a.id}/report`, { data: { deviceId: id, status: 'short' }, headers: clientHeaders() }))
      .status()
  ).toBe(201);

  expect(
    (await request.post(`/api/crowd/${b.id}/report`, { data: { deviceId: id, status: 'long' }, headers: clientHeaders() }))
      .status()
  ).toBe(201);
});

test('a retried submission does not create a second report', async ({ request }) => {
  const id = deviceId();
  const mandalId = catalogue.ganpatis[2].id;
  const requestId = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  const first = await request.post(`/api/crowd/${mandalId}/report`, {
    data: { deviceId: id, status: 'moving', requestId },
    headers: clientHeaders(),
  });
  const second = await request.post(`/api/crowd/${mandalId}/report`, {
    data: { deviceId: id, status: 'moving', requestId },
    headers: clientHeaders(),
  });

  expect(first.status()).toBe(201);
  // The retry must report success, not a cooldown error for its own write.
  expect(second.status()).toBe(201);
  expect((await second.json()).idempotent).toBe(true);
});

test('the API rejects malformed input rather than trusting it', async ({ request }) => {
  const mandalId = catalogue.ganpatis[0].id;
  const id = deviceId();

  const cases: { name: string; path: string; data: unknown; expected: number }[] = [
    { name: 'bad status', path: `/api/crowd/${mandalId}/report`, data: { deviceId: id, status: 'empty' }, expected: 400 },
    { name: 'device id that is not a uuid', path: `/api/crowd/${mandalId}/report`, data: { deviceId: '../../etc/passwd', status: 'short' }, expected: 400 },
    { name: 'missing body fields', path: `/api/crowd/${mandalId}/report`, data: {}, expected: 400 },
    { name: 'unsafe idempotency key', path: `/api/crowd/${mandalId}/report`, data: { deviceId: id, status: 'short', requestId: 'a/../../b' }, expected: 400 },
  ];

  for (const testCase of cases) {
    const response = await request.post(testCase.path, {
      data: testCase.data,
      headers: clientHeaders(),
    });
    expect(response.status(), testCase.name).toBe(testCase.expected);
  }

  // A mandal id that is not a UUID never reaches a cache key.
  expect((await request.get('/api/crowd/not-a-uuid')).status()).toBe(400);

  // A genuinely well-formed v4 id for a mandal that does not exist. This
  // used to be the all-zeros "nil" UUID, which is a sentinel rather than a
  // real identifier and is rejected by the shared UUID rule before any
  // lookup happens — so it was testing the validator, not the 404 path.
  expect(
    (await request.get('/api/crowd/deadbeef-1234-4abc-8def-0123456789ab')).status()
  ).toBe(404);
});

test('batch reads are bounded and validated', async ({ request }) => {
  const ids = catalogue.ganpatis.slice(0, 3).map((g) => g.id);

  const ok = await request.get(`/api/crowd/batch?mandalIds=${ids.join(',')}`);
  expect(ok.status()).toBe(200);
  expect((await ok.json()).items.length).toBe(3);

  // One bad id poisons the whole list rather than being silently dropped.
  expect(
    (await request.get(`/api/crowd/batch?mandalIds=${ids[0]},DROP TABLE`)).status()
  ).toBe(400);

  // Over the cap.
  const tooMany = Array.from({ length: 101 }, () => ids[0]).join(',');
  expect((await request.get(`/api/crowd/batch?mandalIds=${tooMany}`)).status()).toBe(400);

  expect((await request.post('/api/crowd/batch', { data: { mandalIds: [] } })).status()).toBe(400);
});

test('crowd reads are cacheable and revalidate with an ETag', async ({ request }) => {
  const response = await request.get('/api/crowd');
  expect(response.status()).toBe(200);

  const cacheControl = response.headers()['cache-control'] ?? '';
  // Without a shared-cache directive the CDN cannot absorb the read load,
  // which is the whole scaling strategy.
  expect(cacheControl).toContain('s-maxage');
  expect(cacheControl).toContain('stale-while-revalidate');

  const etag = response.headers()['etag'];
  expect(etag).toBeTruthy();

  const revalidated = await request.get('/api/crowd', {
    headers: { 'If-None-Match': etag },
  });

  // Asserting a flat 304 made this test race every other test in the file:
  // any report submitted in between legitimately changes the snapshot, and
  // the endpoint then correctly answers 200 with a new ETag. The invariant
  // that actually matters is that an unchanged body revalidates and a
  // changed one carries a different tag — never a 200 repeating the same
  // tag, which would mean the ETag is not tracking content at all.
  if (revalidated.status() === 200) {
    expect(revalidated.headers()['etag']).not.toBe(etag);
  } else {
    expect(revalidated.status()).toBe(304);
  }
});

test('device-specific responses are never cached by a shared cache', async ({ request }) => {
  const mandalId = catalogue.ganpatis[0].id;
  const response = await request.post(`/api/crowd/${mandalId}/report`, {
    data: { deviceId: deviceId(), status: 'short' },
    headers: clientHeaders(),
  });

  // A cooldown or a success belongs to one device. Caching it publicly
  // would hand one visitor's state to another (§54).
  expect(response.headers()['cache-control'] ?? '').toContain('no-store');
});

test('the panel never presents an unknown crowd as a calm one', async ({ page }) => {
  await standAt(page, catalogue.ganpatis[0]);
  await withFreshDevice(page);
  await page.goto(`/ganpati/${SLUG}`);

  const panel = page.getByRole('region', { name: /crowd right now/i });
  await expect(panel).toBeVisible();

  const text = (await panel.textContent()) ?? '';

  // Whatever state it is in, it must either name a reported level or say
  // there are no reports — never imply a short queue from silence (§33).
  const saysSomething =
    /no recent reports/i.test(text) ||
    /short|moving|heavy/i.test(text) ||
    /temporarily unavailable/i.test(text);
  expect(saysSomething, `panel said: ${text.slice(0, 200)}`).toBe(true);

  // And it must never state a queue duration as fact.
  expect(text).not.toMatch(/queue is \d+ minutes/i);
});

test('raw device identifiers are never exposed by the public API', async ({ request }) => {
  const id = deviceId();
  const mandalId = catalogue.ganpatis[1].id;
  await request.post(`/api/crowd/${mandalId}/report`, {
    data: { deviceId: id, status: 'long' },
    headers: clientHeaders(),
  });

  for (const path of ['/api/crowd', `/api/crowd/${mandalId}`]) {
    const body = await (await request.get(path)).text();
    expect(body, path).not.toContain(id);
    expect(body, path).not.toContain('device');
  }
});

test('the metrics endpoint is invisible without its token', async ({ request }) => {
  const response = await request.get('/api/crowd/metrics');
  // 404 rather than 401: an endpoint that says "unauthorised" has
  // confirmed it exists.
  expect([404, 200]).toContain(response.status());
  if (response.status() === 200) {
    // Only when a token is configured AND supplied, which it is not here.
    throw new Error('metrics endpoint answered without a token');
  }
});

test('a reported mandal still shows its cooldown after a reload', async ({ page, request }) => {
  const id = deviceId();
  const mandal = catalogue.ganpatis[4];
  // The cooldown row is only rendered for someone close enough to report.
  await standAt(page, mandal);

  // Report through the API, then arrive on the page as a returning visitor.
  const submitted = await request.post(`/api/crowd/${mandal.id}/report`, {
    data: { deviceId: id, status: 'short' },
    headers: clientHeaders(),
  });
  expect(submitted.status()).toBe(201);

  await withFreshDevice(page, id);
  await page.goto(`/ganpati/${mandal.slug}`);

  const panel = page.getByRole('region', { name: /crowd right now/i });
  // The panel used to render three enabled buttons here, and the only way
  // to discover the cooldown was to tap one and be refused.
  await expect(panel.getByText(/report it again in/i)).toBeVisible();
  await expect(panel.getByRole('button', { name: /Report Short crowd/i })).toBeDisabled();
});

test('the cooldown endpoint is device-scoped and never cached', async ({ request }) => {
  const id = deviceId();
  const mandal = catalogue.ganpatis[5];

  await request.post(`/api/crowd/${mandal.id}/report`, {
    data: { deviceId: id, status: 'long' },
    headers: clientHeaders(),
  });

  const mine = await request.post('/api/crowd/cooldowns', {
    data: { deviceId: id },
    headers: clientHeaders(),
  });
  expect(mine.status()).toBe(200);
  // Device-specific: a shared cache must never hold this (§54).
  expect(mine.headers()['cache-control'] ?? '').toContain('no-store');
  expect((await mine.json()).cooldowns[mandal.id]).toBeGreaterThan(0);

  // A different device sees none of it.
  const other = await request.post('/api/crowd/cooldowns', {
    data: { deviceId: deviceId() },
    headers: clientHeaders(),
  });
  expect((await other.json()).cooldowns[mandal.id]).toBeUndefined();

  // And it validates its input like everything else.
  expect(
    (await request.post('/api/crowd/cooldowns', {
      data: { deviceId: 'nope' },
      headers: clientHeaders(),
    })).status()
  ).toBe(400);
});

test('the map lets you see and report crowd without leaving it', async ({ page }) => {
  await standAt(page, catalogue.ganpatis[0]);
  await withFreshDevice(page);
  await page.goto('/map');

  // Pick a mandal from the sheet list rather than hunting for a marker.
  await page.getByRole('button', { name: /Shrimant Dagdusheth/i }).first().click();

  const report = page.getByRole('button', { name: /Report Moving crowd/i });
  await expect(report).toBeVisible();
  await report.click();

  await expect(page.getByText(/thanks/i)).toBeVisible();
});

/* ------------------------------------------------------------------ *
 * Reporting without searching first.
 *
 * The home page works out which mandal you mean from the position you
 * already shared, so someone standing in a queue does not have to type a
 * name to rate it. These assert the two claims the prompt can make and,
 * more importantly, the cases where it must refuse to make either.
 * ------------------------------------------------------------------ */

const AT_PROMPT = 'section[aria-labelledby="at-mandal-heading"]';
const NEAR_PROMPT = 'section[aria-labelledby="near-report-heading"]';

/** The first catalogue mandal, with its real coordinates. */
const ANCHOR = catalogue.ganpatis[0];

test('the report prompt stays hidden when location is refused', async ({ page }) => {
  await withFreshDevice(page);
  await page.goto('/');

  // No permission granted in this context, so the on-open request is
  // refused and there is nothing the prompt could honestly claim.
  await expect(page.locator(AT_PROMPT)).toHaveCount(0);
  await expect(page.locator(NEAR_PROMPT)).toHaveCount(0);
});

test.describe('standing at a mandal, with a precise fix', () => {
  test.use({
    permissions: ['geolocation'],
    geolocation: { latitude: ANCHOR.latitude, longitude: ANCHOR.longitude, accuracy: 20 },
  });

  test('names the mandal and offers the buttons without a search', async ({ page }) => {
    await withFreshDevice(page);
    await page.goto('/');

    // No tap: permission is already granted, so the position arrives on
    // open and the prompt is simply there.
    const prompt = page.locator(AT_PROMPT);
    await expect(prompt).toBeVisible();
    await expect(prompt.getByText(ANCHOR.name)).toBeVisible();
    await expect(prompt.getByRole('button', { name: 'Report Moving crowd' })).toBeVisible();
  });
});

test.describe('at the same spot, but with a coarse fix', () => {
  test.use({
    permissions: ['geolocation'],
    // Wider than the distance between neighbouring peth mandals, so the
    // app cannot know which one you are at.
    geolocation: { latitude: ANCHOR.latitude, longitude: ANCHOR.longitude, accuracy: 400 },
  });

  test('refuses to claim you are anywhere and offers a shortlist instead', async ({ page }) => {
    await withFreshDevice(page);
    await page.goto('/');

    await expect(page.locator(NEAR_PROMPT)).toBeVisible();
    // The point of the accuracy gate: no "you're here" claim it cannot support.
    await expect(page.locator(AT_PROMPT)).toHaveCount(0);
  });
});

test.describe('nowhere near Pune', () => {
  test.use({
    permissions: ['geolocation'],
    geolocation: { latitude: 19.076, longitude: 72.8777, accuracy: 20 },
  });

  test('shows no prompt at all', async ({ page }) => {
    await withFreshDevice(page);
    await page.goto('/');

    await expect(page.locator(AT_PROMPT)).toHaveCount(0);
    await expect(page.locator(NEAR_PROMPT)).toHaveCount(0);
  });

  test('will not let you report a mandal you are nowhere near', async ({ page }) => {
    /**
     * The rule the whole tracker rests on: a report is worth something
     * only if the person making it can see the queue.
     *
     * The mandal page used to offer all three buttons to anyone, anywhere,
     * and counted the report at half weight. Half of a guess is still a
     * guess, and enough of them outvote the people at the gate — so
     * outside 1.5 km the controls are not offered at all.
     *
     * This browser is standing in Mumbai.
     */
    await withFreshDevice(page);
    await page.goto(`/ganpati/${SLUG}`);

    const panel = page.getByRole('region', { name: /crowd right now/i });
    await expect(panel).toBeVisible();

    // Reading the queue is unaffected — anyone may look.
    await expect(panel.getByRole('button', { name: /Report .* crowd/ })).toHaveCount(0);

    // And it says why, with the distance, rather than just withholding the
    // controls: a refusal without a reason reads as the app being broken.
    await expect(panel.getByText(/away\. Reports come from people within/)).toBeVisible();
  });
});

/* ------------------------------------------------------------------ *
 * "Right now" — the live crowd section that leads the homepage.
 *
 * Its empty state is the part worth guarding. Reports expire after 90
 * minutes, so before the festival and on any quiet morning there is
 * genuinely nothing to show, and a top section that could only say "no
 * data" would make the app look broken to a first-time visitor.
 * ------------------------------------------------------------------ */

const LIVE_SECTION = 'section[aria-labelledby="live-crowd-heading"]';

test('the live crowd section leads the homepage and links onward', async ({ page }) => {
  await withFreshDevice(page);
  await page.goto('/');

  const section = page.locator(LIVE_SECTION);
  await expect(section).toBeVisible();

  // It must come before the routes rail: the whole point of the section is
  // that it answers the first question, not the second.
  const routes = page.getByRole('heading', { name: /good for right now|ready-made routes/i });
  await expect(routes).toBeVisible();
  const order = await page.evaluate((selector) => {
    const first = document.querySelector(selector);
    const second = [...document.querySelectorAll('h2')].find((h) =>
      /good for right now|ready-made routes/i.test(h.textContent ?? '')
    );
    if (!first || !second) return null;
    // 4 === DOCUMENT_POSITION_FOLLOWING
    return (first.compareDocumentPosition(second) & 4) === 4;
  }, LIVE_SECTION);
  expect(order, 'live crowd section must precede the routes rail').toBe(true);
});

test('the live crowd section invites a report when nobody has reported', async ({ page }) => {
  await withFreshDevice(page);

  // An empty snapshot, not an error: "nobody has reported" and "we cannot
  // reach the service" are different states and must not look alike (§55).
  await page.route('**/api/crowd*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ statuses: [], computedAt: new Date().toISOString(), stale: false }),
    })
  );

  await page.goto('/');
  const section = page.locator(LIVE_SECTION);
  await expect(section).toBeVisible();
  await expect(section.getByText(/no queues reported yet/i)).toBeVisible();
  await expect(section.getByText(/you would be the first/i)).toBeVisible();
});

test('the live crowd section says so when crowd data cannot be reached', async ({ page }) => {
  await withFreshDevice(page);
  await page.route('**/api/crowd*', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"x"}' })
  );

  await page.goto('/');
  const section = page.locator(LIVE_SECTION);
  await expect(section).toBeVisible();
  await expect(section.getByText(/temporarily unavailable/i)).toBeVisible();
  // The rest of the page must survive it.
  await expect(page.locator('a[href^="/ganpati/"]').first()).toBeVisible();
});

test.describe('walking between mandals', () => {
  test.use({
    permissions: ['geolocation'],
    geolocation: { latitude: 18.51514, longitude: 73.856379, accuracy: 20 }, // Dagdusheth
  });

  /**
   * The app used to take one fix and keep it forever, so someone who walked
   * three hundred metres was still told they were where they opened it. That
   * is the single situation this feature exists for, and only a reload fixed
   * it.
   *
   * `watchPosition` must deliver this with NO trigger at all — no tab
   * switch, no tick, no reload. The test deliberately does nothing except
   * move the device, because anything else would also pass against the
   * weaker interval-based version this replaced.
   *
   * The watch must also use `maximumAge: 0`. Any allowance lets the browser
   * answer from the stale fix it already holds, which reproduced the
   * original bug exactly while looking like working code.
   */
  test('the prompt follows the visitor without a reload', async ({ page }) => {
    await withFreshDevice(page);
    await page.goto('/');

    const prompt = page.locator(AT_PROMPT);
    await expect(prompt).toBeVisible();
    await expect(prompt.getByText(/Dagdusheth/i)).toBeVisible();

    // Walk to Kasba Ganpati, ~400m north. Nothing else happens.
    await page.context().setGeolocation({ latitude: 18.51903, longitude: 73.857241 });

    await expect(prompt.getByText(/Kasba Ganpati/i)).toBeVisible({ timeout: 20_000 });
    await expect(prompt.getByText(/Dagdusheth/i)).toHaveCount(0);
  });
});
