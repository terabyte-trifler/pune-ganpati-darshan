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

const SLUG = catalogue.ganpatis[0].slug;

test('the crowd panel appears on a mandal page and offers all three levels', async ({ page }) => {
  await withFreshDevice(page);
  await page.goto(`/ganpati/${SLUG}`);

  const panel = page.getByRole('region', { name: /crowd right now/i });
  await expect(panel).toBeVisible();

  await expect(panel.getByRole('button', { name: 'Short' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Moving' })).toBeVisible();
  await expect(panel.getByRole('button', { name: '30+ min' })).toBeVisible();
});

test('submitting a report is acknowledged and starts the cooldown', async ({ page }) => {
  await withFreshDevice(page);
  await page.goto(`/ganpati/${SLUG}`);

  const panel = page.getByRole('region', { name: /crowd right now/i });
  await panel.getByRole('button', { name: 'Moving' }).click();

  await expect(panel.getByText(/thanks/i)).toBeVisible();
  await expect(panel.getByText(/helps other devotees/i)).toBeVisible();

  // The buttons are gone, so there is nothing to tap that the server would
  // refuse.
  await expect(panel.getByRole('button', { name: 'Moving' })).toHaveCount(0);
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
  await withFreshDevice(page);
  await page.goto('/map');

  // Pick a mandal from the sheet list rather than hunting for a marker.
  await page.getByRole('button', { name: /Shrimant Dagdusheth/i }).first().click();

  const report = page.getByRole('button', { name: /Report Moving crowd/i });
  await expect(report).toBeVisible();
  await report.click();

  await expect(page.getByText(/thanks/i)).toBeVisible();
});
