import { defineConfig, devices } from '@playwright/test';

const emulator = process.env.E2E_EMULATOR === '1';
const port = Number(process.env.E2E_PORT || (emulator ? 3466 : 3465));
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: emulator ? undefined : {
    command: `DISABLE_HMR=true INSTITUTION_PREVIEW=1 NEXT_DIST_DIR=.next-e2e npx next dev -p ${port} -H 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 600_000,
  },
});
