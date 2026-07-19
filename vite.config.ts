import { execSync } from 'node:child_process'
import { dirname } from 'node:path'
import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'
import vueDevTools from 'vite-plugin-vue-devtools'
import pkg from './package.json'
import { endgeCodegen } from './plugins/vite-plugin-endge-codegen'
import { endgeTestIntegrations } from './plugins/vite-plugin-endge-test-integrations'

process.env.VITE_VERSION = process.env.npm_package_version
process.env.VITE_GIT_SHA = execSync('git rev-parse --short=8 HEAD').toString().trim()

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  const cwd = dirname(fileURLToPath(import.meta.url)) // same as process.cwd()
  const env = loadEnv(mode, cwd)
  const isDevServer = command === 'serve'
  const testIntegrationsEnabled = isDevServer || mode === 'test-integrations'
  const testIntegrationsRoot = fileURLToPath(new URL('../integrations/test', import.meta.url))
  const packagesRoot = fileURLToPath(new URL('../../packages', import.meta.url))
  const codegenEnabled =
    isDevServer &&
    (env.VITE_ENDGE_CODEGEN_ENABLED === 'true' || env.VITE_ENDGE_CODEGEN_ENABLED === '1')

  return {
    base: '/',
    plugins: [
      vue(),
      vueDevTools(),
      tailwindcss(),
      endgeCodegen({ enabled: codegenEnabled }),
      endgeTestIntegrations({
        enabled: testIntegrationsEnabled,
        registryPath: fileURLToPath(new URL('../integrations/test/index.ts', import.meta.url)),
      }),
    ],
    server: {
      fs: {
        allow: [cwd, testIntegrationsRoot, packagesRoot],
      },
    },
    resolve: {
      // Endge runtime packages and class-transformer share singleton state.
      // Without dedupe, optimizeDeps can resolve nested published copies:
      // Raph then exposes an older API, while class-transformer loses the
      // decorator metadata used by Serialize.fromJSON in @endge/core.
      dedupe: ['@endge/raph', '@endge/utils', 'class-transformer'],
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@axios': fileURLToPath(new URL('./src/plugins/axios', import.meta.url)),
        '@endge/integration-api': fileURLToPath(
          new URL('../../packages/egorkozelskij-integration-api/src/index.ts', import.meta.url),
        ),
      },
    },
    define: {
      process: { env: {} },
      __APP_VERSION__: JSON.stringify(pkg.version),
      __APP_VERSION_UPDATED__: JSON.stringify(pkg.version_updated),
    },
  }
})
