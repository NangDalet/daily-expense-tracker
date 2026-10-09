import { defineConfig } from '@playwright/test'
const baseURL = process.env.EXPORT_TEST_BASE_URL ?? 'http://127.0.0.1:4174'
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    channel: process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined),
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
  },
  webServer: process.env.EXPORT_TEST_BASE_URL ? undefined : {
    command: 'npm run dev -- --host 127.0.0.1 --port 4174 --strictPort',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
})