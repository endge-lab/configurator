import { defineConfig, mergeConfig } from 'vite'
import applicationConfig from '../vite.config'

// A test session must not reload when another local task edits the shared workspace.
export default defineConfig(async environment => mergeConfig(
  await (typeof applicationConfig === 'function' ? applicationConfig(environment) : applicationConfig),
  { server: { hmr: false, watch: null }, cacheDir: 'node_modules/.vite-inspection-e2e' },
))
