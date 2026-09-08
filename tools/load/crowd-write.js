import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

/**
 * Write-path load test (§39).
 *
 * Three distinct questions, run as separate scenarios:
 *
 *   burst     — hundreds of DIFFERENT devices reporting the same mandal at
 *               once. Every one should be accepted; this is the honest
 *               festival case, not an attack.
 *   duplicate — the SAME device hammering the same mandal concurrently.
 *               Exactly one may succeed, however many land together. This
 *               is the race the cooldown ledger exists to lose gracefully.
 *   retry     — the same device and the same idempotency key, repeatedly,
 *               as a flaky mobile connection would. Every response must
 *               report success, and exactly one row may exist.
 *
 * On the X-Forwarded-For header: every request here originates from
 * 127.0.0.1, so without it the per-IP throttle would reject the run and we
 * would be measuring the rate limiter instead of the cooldown. Setting a
 * distinct value per virtual user simulates what a real proxy writes.
 * That is also a live deployment constraint worth stating plainly — see
 * docs/07-crowd.md: IP-based limiting is only sound behind a proxy that
 * OVERWRITES this header, because otherwise a client can set it freely.
 * The device cooldown and the per-device cap do not depend on it.
 *
 * Usage:
 *   k6 run -e SCENARIO=burst -e BASE=... -e MANDAL=<uuid> tools/load/crowd-write.js
 */

const BASE = __ENV.BASE || 'http://127.0.0.1:3153';
const MANDAL = __ENV.MANDAL;
const SCENARIO = __ENV.SCENARIO || 'burst';
/** Fixed device for the duplicate/retry scenarios, supplied by the runner. */
const FIXED_DEVICE = __ENV.DEVICE || '';
const FIXED_REQUEST = __ENV.REQUEST_ID || '';

const accepted = new Counter('reports_accepted');
const cooldown = new Counter('reports_cooldown');
const limited = new Counter('reports_rate_limited');
const other = new Counter('reports_other');
const byStatus = new Counter('reports_by_status');

const SCENARIOS = {
  /**
   * 300 reports arriving over 5 seconds — the shape real traffic has,
   * even at aarti. An earlier version fired all 300 from cold connections
   * in the same instant, which does not test the application at all: it
   * overruns the OS listen backlog (kern.ipc.somaxconn, 128 on macOS) and
   * ~40% of the SYNs are dropped before Node ever sees them. Those showed
   * up as k6 status 0 with no corresponding server error, which is the
   * signature of a transport-level drop rather than a rejected request.
   */
  burst: {
    executor: 'constant-arrival-rate',
    rate: 60,
    timeUnit: '1s',
    duration: '5s',
    preAllocatedVUs: 100,
    maxVUs: 300,
  },
  duplicate: {
    executor: 'per-vu-iterations',
    vus: 100,
    iterations: 1,
    maxDuration: '60s',
  },
  retry: {
    executor: 'per-vu-iterations',
    vus: 50,
    iterations: 1,
    maxDuration: '60s',
  },
};

export const options = {
  scenarios: { [SCENARIO]: SCENARIOS[SCENARIO] },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    // The brief's target for submissions (§43).
    http_req_duration: ['p(95)<500'],
  },
};

/** RFC-4122 v4, because the server validates the version and variant bits. */
function uuid() {
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += '-';
    else if (i === 14) out += '4';
    else if (i === 19) out += hex[(Math.random() * 4) | (0 + 8)];
    else out += hex[(Math.random() * 16) | 0];
  }
  return out;
}

const LEVELS = ['short', 'moving', 'long'];

export default function () {
  const device = FIXED_DEVICE || uuid();
  const body = {
    deviceId: device,
    status: LEVELS[(Math.random() * LEVELS.length) | 0],
  };

  if (SCENARIO === 'retry') body.requestId = FIXED_REQUEST || 'retry-key-000001';

  const response = http.post(`${BASE}/api/crowd/${MANDAL}/report`, JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
      // One simulated client per VU, as a proxy would set.
      'X-Forwarded-For': `10.${(__VU >> 16) & 255}.${(__VU >> 8) & 255}.${__VU & 255}`,
    },
  });

  let parsed = {};
  try {
    parsed = response.json();
  } catch {
    parsed = {};
  }

  if (parsed.success) accepted.add(1);
  else if (parsed.reason === 'cooldown') cooldown.add(1);
  else if (parsed.reason === 'rate_limited') limited.add(1);
  else other.add(1);

  // Status is recorded as a tagged counter so a failure is diagnosable
  // rather than just a percentage.
  byStatus.add(1, { status: String(response.status) });

  check(response, {
    'answered without a server error': (r) => r.status < 500,
    'structured response': () => typeof parsed.success === 'boolean',
  });
}
