import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: 'html',

  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: 'http://localhost:3000',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Take screenshot on failure
    screenshot: 'only-on-failure',
  },

  // Configure projects for different browsers/environments
  projects: [
    {
      name: 'electron',
      use: {
        ...devices['Desktop Chrome'],
        // Additional Electron-specific configuration can go here
      },
    },
  ],

  // Run Vite dev server before starting tests
  webServer: {
    command: 'npm run dev:vite',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
