import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const BASE_URL = `http://127.0.0.1:${PORT}/csp-paperback/`
// The desktop CSP test must run against bundled scripts, not Vite's inline dev preamble.
const preview = process.env.CSP_PAPERBACK_E2E_PREVIEW === '1' || !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run ${preview ? 'preview' : 'dev'} -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
