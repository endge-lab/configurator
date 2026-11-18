import process from 'node:process'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  plugins: [vue()],
  define: { 'process.env': {} },
  resolve: { alias: {
    '@': fileURLToPath(new URL('../../..', import.meta.url)),
    ...(process.env.ENDGE_BENCH_CORE_ENTRY ? { '@endge/core': process.env.ENDGE_BENCH_CORE_ENTRY } : {}),
  } },
  build: { rollupOptions: { input: fileURLToPath(new URL('./collection-window-performance.html', import.meta.url)) } },
})
