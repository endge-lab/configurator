import { existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@playwright/test'

const servicesDirectory = fileURLToPath(new URL('../../../services/', import.meta.url))
const backendDirectory = existsSync(servicesDirectory)
  ? readdirSync(servicesDirectory).find(name => name.endsWith('endge-service-backend'))
  : undefined
const backendCwd = process.env.ENDGE_E2E_BACKEND_DIR
  ?? resolve(servicesDirectory, backendDirectory ?? 'endge-service-backend')

export default defineConfig({
  testDir: './src/test/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure', screenshot: 'only-on-failure', viewport: { width: 1440, height: 1000 } },
  webServer: [
    { command: 'pnpm exec vite --config src/test/e2e/vite.config.ts --host 127.0.0.1 --port 4173 --strictPort', url: 'http://127.0.0.1:4173/src/test/e2e/fixture.html', reuseExistingServer: false, timeout: 300_000 },
    { command: 'ENDGE_INSPECTION_E2E_PORT=4174 go test -race -count=1 -run TestBrowserInspectionServer -timeout 20m ./internal/api/http/v1/bridge', cwd: backendCwd, url: 'http://127.0.0.1:4174/health', reuseExistingServer: false, timeout: 300_000 },
  ],
})
