import type { Plugin } from 'vite'
import { defineConfig, mergeConfig } from 'vite'
import applicationConfig from '../../../vite.config'

const api: Plugin = {
  name: 'collection-window-fixture-api',
  configureServer(server) {
    const requests: Record<string, unknown>[] = []
    let control = { label: '', shift: 0, total: 500, fail: false, delay: 0, status: 503 }
    server.middlewares.use('/__collection-window', (req, res, next) => {
      res.setHeader('Content-Type', 'application/json')
      if (req.url === '/requests') {
        res.end(JSON.stringify(requests))
        return
      }
      if (req.url === '/control') {
        let body = ''
        req.on('data', (chunk) => {
          body += String(chunk)
        })
        req.on('end', () => {
          const patch = JSON.parse(body || '{}')
          if (patch.reset) {
            control = {
              label: '',
              shift: 0,
              total: 500,
              fail: false,
              delay: 0,
              status: 503,
            }
            requests.length = 0
          }
          control = { ...control, ...patch }
          res.end(JSON.stringify(control))
        })
        return
      }
      if (req.url !== '/page') {
        next()
        return
      }
      let body = ''
      req.on('data', (chunk) => {
        body += String(chunk)
      })
      req.on('end', () => {
        const input = JSON.parse(body || '{}') as Record<string, unknown>
        const record = { ...input, completed: false, aborted: false }
        requests.push(record)
        res.on('close', () => {
          if (!record.completed) {
            record.aborted = true
          }
        })
        const limit = Number(input.limit ?? 40)
        const direction = String(input.direction)
        const cursor = Number(input.cursor ?? 100)
        const start = Math.max(
          0,
          Number(
            input.offset ?? (direction === 'before' ? cursor - limit : cursor),
          ),
        )
        const end = Math.min(control.total, start + limit)
        setTimeout(
          () => {
            record.completed = true
            if (input.fail || control.fail) {
              res.statusCode = control.status
              res.end(JSON.stringify({ message: 'Fixture page failure' }))
              return
            }
            res.end(
              JSON.stringify({
                rows: Array.from({ length: end - start }, (_, index) => ({
                  id: String(start + index + control.shift),
                  label: `${input.filter ?? 'all'}${control.label} record ${start + index}`,
                })),
                offset: start,
                total: control.total,
                startCursor: String(start),
                endCursor: String(end),
                hasBefore: start > 0,
                hasAfter: end < control.total,
              }),
            )
          },
          Number(control.delay || input.delay || 20),
        )
      })
    })
  },
}
export default defineConfig(async environment =>
  mergeConfig(
    await (typeof applicationConfig === 'function'
      ? applicationConfig(environment)
      : applicationConfig),
    {
      plugins: [api],
      server: { hmr: false, watch: null },
      cacheDir: 'node_modules/.vite-collection-window',
    },
  ),
)
