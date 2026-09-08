import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate } from 'k6/metrics';

/**
 * Read-path load test for the crowd feature.
 *
 * The traffic model matters more than the headline number. "10,000
 * concurrent users" is not 10,000 requests per second: the client polls
 * every 20 seconds and pauses when the tab is hidden, so 10,000 users
 * reading crowd status generate about
 *
 *     10,000 / 20s = 500 requests/second
 *
 * against the origin, before any CDN. Testing at 10,000 rps would be
 * measuring a system nobody is going to build; testing at 500 rps with
 * the real cache behaviour is the honest question, and the saturation
 * scenario below then finds where the origin actually breaks.
 *
 * Scenarios (select with -e SCENARIO=name):
 *   steady    — 500 rps, the modelled 10,000-user read load
 *   hot       — 500 rps all aimed at one popular mandal (§25, §38-E)
 *   spike     — a sudden jump to 4x, as at aarti time (§38-D, §37)
 *   saturate  — ramp until it breaks, to find the real ceiling
 *
 * Usage:
 *   k6 run -e SCENARIO=steady -e BASE=http://127.0.0.1:3151 tools/load/crowd-read.js
 */

const BASE = __ENV.BASE || 'http://127.0.0.1:3151';
const HOT_MANDAL = __ENV.HOT_MANDAL || '';
const SCENARIO = __ENV.SCENARIO || 'steady';

const notModified = new Counter('http_304_responses');
const served = new Rate('served_ok');

const SCENARIOS = {
  steady: {
    executor: 'constant-arrival-rate',
    rate: 500,
    timeUnit: '1s',
    duration: '60s',
    preAllocatedVUs: 200,
    maxVUs: 1500,
  },
  hot: {
    executor: 'constant-arrival-rate',
    rate: 500,
    timeUnit: '1s',
    duration: '45s',
    preAllocatedVUs: 200,
    maxVUs: 1500,
  },
  spike: {
    executor: 'ramping-arrival-rate',
    startRate: 250,
    timeUnit: '1s',
    preAllocatedVUs: 300,
    maxVUs: 3000,
    stages: [
      { target: 250, duration: '15s' },   // an ordinary evening
      { target: 2000, duration: '5s' },   // aarti begins
      { target: 2000, duration: '30s' },  // everyone looks at once
      { target: 250, duration: '10s' },   // and it passes
    ],
  },
  saturate: {
    executor: 'ramping-arrival-rate',
    startRate: 250,
    timeUnit: '1s',
    preAllocatedVUs: 500,
    maxVUs: 6000,
    stages: [
      { target: 500, duration: '20s' },
      { target: 1000, duration: '20s' },
      { target: 2000, duration: '20s' },
      { target: 4000, duration: '20s' },
      { target: 8000, duration: '20s' },
    ],
  },
};

export const options = {
  scenarios: { [SCENARIO]: SCENARIOS[SCENARIO] },
  thresholds: {
    // The brief's target for cached reads (§43).
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<200'],
  },
  // The saturation run is meant to find the breaking point, so a failed
  // threshold there is a result, not an error.
  ...(SCENARIO === 'saturate' ? { thresholds: {} } : {}),
};

export default function () {
  const url =
    SCENARIO === 'hot' && HOT_MANDAL
      ? `${BASE}/api/crowd/${HOT_MANDAL}`
      : `${BASE}/api/crowd`;

  const response = http.get(url, {
    headers: { Accept: 'application/json' },
    tags: { endpoint: SCENARIO === 'hot' ? 'single' : 'snapshot' },
  });

  if (response.status === 304) notModified.add(1);
  served.add(response.status === 200 || response.status === 304);

  check(response, {
    'served': (r) => r.status === 200 || r.status === 304,
    'no server error': (r) => r.status < 500,
  });
}
