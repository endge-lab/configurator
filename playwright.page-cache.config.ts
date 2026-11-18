import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './src/test/e2e',
  testMatch: 'page-cache-adapters.spec.ts',
  workers: 1,
  reporter: 'list',
  timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:4182', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'firefox', use: { browserName: 'firefox' } }, { name: 'webkit', use: { browserName: 'webkit' } }],
  webServer: { command: 'pnpm exec vite --host 127.0.0.1 --port 4182 --strictPort', url: 'http://127.0.0.1:4182/src/test/e2e/page-cache-contract.html', reuseExistingServer: false, timeout: 120000 },
})
