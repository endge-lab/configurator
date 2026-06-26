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

process.env.VITE_VERSION = process.env.npm_package_version
process.env.VITE_GIT_SHA = execSync('git rev-parse --short=8 HEAD').toString().trim()

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  const cwd = dirname(fileURLToPath(import.meta.url)) // same as process.cwd()
  const env = loadEnv(mode, cwd)
  const isDevServer = command === 'serve'
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
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@axios': fileURLToPath(new URL('./src/plugins/axios', import.meta.url)),
      },
    },
    define: {
      process: { env: {} },
      __APP_VERSION__: JSON.stringify(pkg.version),
      __APP_VERSION_UPDATED__: JSON.stringify(pkg.version_updated),
    },
  }
})
