import { defineConfig, devices } from '@playwright/test';

const port = 3465;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  retries: 0,
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `DISABLE_HMR=true NEXT_DIST_DIR=.next-e2e npx next dev -p ${port} -H 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 600_000,
  },
});
