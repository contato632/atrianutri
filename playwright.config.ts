import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:4176',
    browserName: 'chromium',
    launchOptions: { executablePath: '/usr/bin/chromium' },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 4176',
    url: 'http://127.0.0.1:4176',
    reuseExistingServer: false,
    env: { VITE_DATA_MODE: 'demo' },
  },
})
