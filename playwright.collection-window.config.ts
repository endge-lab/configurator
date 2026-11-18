import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './src/test/e2e',
  testMatch: 'collection-window.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 60000,
  expect: { timeout: 15000 },
  use: {
    baseURL: 'http://127.0.0.1:4181',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command:
      'pnpm exec vite --config src/test/e2e/collection-window.vite.config.ts --host 127.0.0.1 --port 4181 --strictPort',
    url: 'http://127.0.0.1:4181/src/test/e2e/collection-window.html',
    reuseExistingServer: false,
    timeout: 120000,
  },
})
