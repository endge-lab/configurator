import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: { rollupOptions: { input: fileURLToPath(new URL('./page-cache-contract.html', import.meta.url)) } },
})
