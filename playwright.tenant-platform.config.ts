import process from 'node:process'
import { defineConfig } from '@playwright/test'

/**
 * UI e2e tenant-platform против уже запущенных backend, поддельного сервера рейсов
 * и dev-сервера Configurator (см. src/test/e2e/tenant-platform/tenant-platform.helpers.ts).
 * Запуск: ENDGE_TENANT_E2E=1 pnpm exec playwright test -c playwright.tenant-platform.config.ts
 */
export default defineConfig({
  testDir: './src/test/e2e/tenant-platform',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  outputDir: 'test-results/tenant-platform',
  use: {
    baseURL: process.env.ENDGE_E2E_CONFIGURATOR_URL ?? 'http://localhost:5273',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 1000 },
    permissions: ['clipboard-read', 'clipboard-write'],
  },
})
