import { defineConfig, devices } from '@playwright/test';

/**
 * Guide §7.3: every F7-F9 test runs on a 360 x 800 touch viewport and on
 * Desktop Chrome, and checks that the page never scrolls sideways.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    // Buyers are in Peru: dates and numbers render as they would for them,
    // whatever the zone and language of the machine running the tests.
    locale: 'es-PE',
    timezoneId: 'America/Lima',
  },
  projects: [
    {
      name: 'mobile-360',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 360, height: 800 },
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 2,
      },
    },
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
