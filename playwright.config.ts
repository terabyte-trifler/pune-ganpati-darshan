import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs against a production build: the app's caching, static generation
 * and service worker only behave correctly there.
 */
/**
 * Guard against a silent false pass.
 *
 * The variable is E2E_BASE_URL. Setting a plausible-looking alternative
 * instead leaves the run on the default port with `reuseExistingServer`, so
 * it happily tests whatever else is already listening there and reports a
 * full green suite for a build it never loaded.
 */
const MISNAMED = ['PLAYWRIGHT_BASE_URL', 'BASE_URL', 'E2E_URL'] as const;
if (!process.env.E2E_BASE_URL) {
  const wrong = MISNAMED.find((name) => process.env[name]);
  if (wrong) {
    throw new Error(
      `${wrong} is set but the variable this config reads is E2E_BASE_URL. ` +
        `Re-run with E2E_BASE_URL=${process.env[wrong]}.`
    );
  }
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3100',
    trace: 'on-first-retry',
  },
  projects: [
    // Mobile is the primary product, so it runs first.
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run start -- --port 3100',
        url: 'http://127.0.0.1:3100',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
