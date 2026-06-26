/**
 * Vite-плагин кодогенерации домена.
 * Работает только в dev (command === 'serve'); в production build не регистрирует middleware и не отдаёт push-код.
 */

import path from 'node:path'
import type { Plugin } from 'vite'
import { generateDomainArtifacts } from '@endge/codegen'
import type { EndgeDomainBundle } from '@endge/codegen'

const CODEGEN_ENDPOINT = '/__endge_codegen__/domain'
const VIRTUAL_MODULE_ID = 'virtual:endge-codegen-push'
const RESOLVED_VIRTUAL_ID = '\0' + VIRTUAL_MODULE_ID

export interface EndgeCodegenPluginOptions {
  /** Включить кодогенерацию (middleware + push). По умолчанию true в dev, false при build. */
  enabled?: boolean
  /** Папка для сгенерированных файлов. По умолчанию: config.root/src/gen */
  outputDir?: string
}

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  return new Promise((resolve, reject) => {
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export function endgeCodegen(options: EndgeCodegenPluginOptions = {}): Plugin {
  let _outputDir: string | null = null
  const enabled = options.enabled ?? true

  return {
    name: 'endge-codegen',
    configResolved(config) {
      _outputDir = options.outputDir ?? path.join(config.root, 'src', 'gen')
    },
    resolveId(id: string) {
      if (id === VIRTUAL_MODULE_ID) return RESOLVED_VIRTUAL_ID
      return null
    },
    load(id: string) {
      if (id !== RESOLVED_VIRTUAL_ID) return null
      if (!enabled) return 'export {}'
      return `
import { AppBus } from '@endge/utils'
const EP = '${CODEGEN_ENDPOINT}'
function send() {
  const bridge = typeof window !== 'undefined' && window.__ENDGE_ADMIN_BRIDGE__
  if (!bridge) return
  try {
    const bundle = bridge.exportDomainBundle()
    fetch(EP, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bundle) })
      .then(r => r.json())
      .then(res => { if (res?.ok) console.log('[endge-codegen] Генерация прошла.') })
      .catch(() => {})
  } catch (_) {}
}
if (typeof window !== 'undefined') {
  AppBus.on('domainLoaded', send)
  AppBus.on('domainChanged', send)
  if (window.__ENDGE_ADMIN_BRIDGE__) setTimeout(send, 500)
  else window.addEventListener('load', () => setTimeout(send, 2000))
}
`
    },
    configureServer(server) {
      if (!enabled) return
      server.middlewares.use(CODEGEN_ENDPOINT, async (req, res, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }

        const outputDir = _outputDir ?? path.join(server.config.root, 'src', 'gen')
        try {
          const body = await readBody(req)
          const bundle = JSON.parse(body) as EndgeDomainBundle
          const result = await generateDomainArtifacts(bundle, { outputDir })
          res.setHeader('Content-Type', 'application/json')
          res.statusCode = 200
          res.end(JSON.stringify({ ok: true, outputDir: result.outputDir, files: result.files }))
          console.log('[endge-codegen] Записано в', result.outputDir)
        }
        catch (e) {
          console.error('[endge-codegen] Ошибка:', e)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }))
        }
      })
    },
  }
}
