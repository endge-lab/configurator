import type { ComponentSFCRuntimeHost, ControllerRuntimeHost, PageCacheOptions } from '@endge/core'
import { Endge } from '@endge/core'
import { EndgeVuePlugin, SFC_RuntimeRenderer } from '@endge/ui-vue'
import { Raph } from '@raphy-js/raph'
import { createApp, h, nextTick } from 'vue'
import { collectionWindowBundle } from './collection-window-documents'
import '@endge/ui-vue/vue.css'

// Production fixture deliberately renders the product Table, without IDE inspection panels.
Endge.use(EndgeVuePlugin)
const realNow = Date.now.bind(Date)
let clockOffset = 0
Date.now = () => realNow() + clockOffset
const newStorageMetrics = () => ({ opensMs: [] as number[], transactionCount: 0, transactionMs: 0, maxTransactionMs: 0, recentTransactionMs: [] as number[] })
let storageMetrics = newStorageMetrics()
const nativeOpen = IDBFactory.prototype.open
IDBFactory.prototype.open = function (name, version) {
  const metrics = storageMetrics
  const started = performance.now()
  const request = version === undefined ? nativeOpen.call(this, name) : nativeOpen.call(this, name, version)
  request.addEventListener('success', () => {
    if (metrics.opensMs.length < 16) {
      metrics.opensMs.push(performance.now() - started)
    }
  }, { once: true })
  return request
}
const nativeTransaction = IDBDatabase.prototype.transaction
IDBDatabase.prototype.transaction = function (...args) {
  const metrics = storageMetrics
  const started = performance.now()
  const transaction = nativeTransaction.apply(this, args)
  transaction.addEventListener('complete', () => {
    const elapsed = performance.now() - started
    metrics.transactionCount++
    metrics.transactionMs += elapsed
    metrics.maxTransactionMs = Math.max(metrics.maxTransactionMs, elapsed)
    metrics.recentTransactionMs.push(elapsed)
    if (metrics.recentTransactionMs.length > 128) {
      metrics.recentTransactionMs.shift()
    }
  }, { once: true })
  return transaction
}
let unsubscribeMetrics: (() => void) | null = null
let queuePeaks = { pendingWrites: 0, pendingBytes: 0 }
let app: ReturnType<typeof createApp> | null = null
let controller: ControllerRuntimeHost
const raf = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
async function cleanup() {
  unsubscribeMetrics?.()
  unsubscribeMetrics = null
  app?.unmount()
  app = null
  await Endge.reset()
  clockOffset = 0
}
const api = {
  async configure(options: { cache?: PageCacheOptions, rows?: number, retention?: { beforeRows: number, afterRows: number } } = {}) {
    if (app) {
      await cleanup()
    }
    storageMetrics = newStorageMetrics()
    queuePeaks = { pendingWrites: 0, pendingBytes: 0 }
    if (!Raph.configured) {
      Raph.configure({
        mode: 'runtime',
      })
    }
    Endge.context.configurePersistence({ context: 'disabled' })
    const bundle = collectionWindowBundle(location.origin, { cache: options.cache, retention: options.retention, prefetchRows: 0 })
    const compositions = (bundle.documents.compositions as Array<{ identity: string, source: string }>).filter(item => item.identity === 'window-offset')
    bundle.documents.compositions = compositions
    for (const document of compositions) {
      document.source = document.source!.replace('batchSize:40', 'batchSize:100').replace('maxLoadedRows:80', `maxLoadedRows:${options.rows ?? 1000}`).replace('initialOffset:100', 'initialOffset:0').replace('request:{filter:\'all\'}', 'autoLoad:false,request:{filter:\'all\'}')
    }
    await Endge.boot({ dataProvider: 'bundle', bundleSource: bundle, scope: { workspaceIdentity: 'collection-window-fixture' }, vars: {}, ui: { adapterFallbackIds: ['vue-native'] } })
    const invalid = Endge.program.getArtifacts().filter(artifact => artifact.status === 'error')
    if (invalid.length) {
      throw new Error(JSON.stringify(invalid.flatMap(item => item.diagnostics)))
    }
    const session = await Endge.runtime.composition.mount('window-offset', { id: 'performance-window' })
    controller = session.host.getChild('window') as ControllerRuntimeHost
    unsubscribeMetrics = controller.subscribe(() => {
      const status = Raph.get(controller.outputPath('cacheStatus')) as { pendingWrites?: number, pendingBytes?: number } | undefined
      queuePeaks.pendingWrites = Math.max(queuePeaks.pendingWrites, status?.pendingWrites ?? 0)
      queuePeaks.pendingBytes = Math.max(queuePeaks.pendingBytes, status?.pendingBytes ?? 0)
    })
    const screen = session.host.getChild('screen') as ComponentSFCRuntimeHost
    app = createApp({ render: () => h(SFC_RuntimeRenderer, { host: screen, input: screen.getInputSource() ?? { kind: 'local', props: {} } }) })
    app.mount('#app')
    await controller.command('loadInitial')
    for (let i = 1;
      i < Math.ceil((options.rows ?? 1000) / 100);
      i++) {
      await controller.command('loadAfter')
    }
    await nextTick()
    for (let i = 0;
      i < 10;
      i++) {
      await raf()
    }
    await api.drain()
    return api.stats()
  },
  async drain() {
    const deadline = performance.now() + 10000
    while ((controller.getOutput('cacheStatus') as { pendingWrites?: number } | undefined)?.pendingWrites) {
      if (performance.now() > deadline) {
        throw new Error('cache write queue did not drain')
      }
      await new Promise(resolve => setTimeout(resolve, 5))
    }
  },
  async viewport(iterations = 200) {
    const rows = Raph.get(controller.outputPath('rows')) as Array<{ id: string }>
    const revision = controller.getOutput('rowsRevision')
    const samples: number[] = []
    for (let i = 0; i < iterations; i++) {
      const first = 100 + i % Math.max(1, rows.length - 200)
      const start = performance.now()
      const pending = controller.command('setViewport', { rowsRevision: revision, firstVisible: { key: rows[first].id, index: first }, lastVisible: { key: rows[first + 15].id, index: first + 15 }, rowCount: rows.length, reason: 'scroll' })
      samples.push(performance.now() - start)
      await pending
    }
    return samples
  },
  async frames(count = 180) {
    const viewport = document.querySelector<HTMLElement>('.endge-tanstack-table__viewport')!
    const intervals: number[] = []
    const longTasks: number[] = []
    const observer = typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes.includes('longtask')
      ? new PerformanceObserver(list => list.getEntries().forEach(entry => longTasks.push(entry.duration)))
      : null
    observer?.observe({ type: 'longtask' })
    let previous = performance.now()
    for (let i = 0; i < count; i++) {
      await raf()
      const now = performance.now()
      if (i > 10) {
        intervals.push(now - previous)
      }
      previous = now
      viewport.scrollTop = (100 + (i * 3) % 400) * 32
      viewport.dispatchEvent(new Event('scroll'))
    }
    observer?.disconnect()
    return { intervals, longTasks, domRows: document.querySelectorAll('[data-row-key]').length }
  },
  async warmHits(count = 30) {
    const samples: number[] = []
    for (let i = 0; i < count; i++) {
      await controller.command('reset')
      const start = performance.now()
      await controller.command('loadInitial')
      samples.push(performance.now() - start)
    }
    return samples
  },
  async traverse(pages = 120) {
    const lastBefore = (Raph.get(controller.outputPath('rows')) as Array<{ id: string }>).at(-1)?.id
    const continued = Raph.get(controller.outputPath('hasAfter'))
    for (let i = 0; i < pages; i++) {
      const viewport = document.querySelector<HTMLElement>('.endge-tanstack-table__viewport')!
      viewport.scrollTop = viewport.scrollHeight
      viewport.dispatchEvent(new Event('scroll'))
      await raf()
      await controller.command('loadAfter')
      if (Raph.get(controller.outputPath('error'))) {
        throw new Error('Traversal page failed')
      }
      const rows = Raph.get(controller.outputPath('rows')) as Array<{ id: string }>
      await controller.command('setViewport', { rowsRevision: controller.getOutput('rowsRevision'), firstVisible: { key: rows.at(-20)!.id, index: rows.length - 20 }, lastVisible: { key: rows.at(-10)!.id, index: rows.length - 10 }, rowCount: rows.length, reason: 'scroll' })
    }
    await api.drain()
    const result = api.stats()
    if (pages && continued && Number(result.last) <= Number(lastBefore)) {
      throw new Error('Traversal made no progress')
    }
    return result
  },
  async reverse(pages = 30) {
    const firstBefore = (Raph.get(controller.outputPath('rows')) as Array<{ id: string }>)[0]?.id
    const continued = Raph.get(controller.outputPath('hasBefore'))
    for (let i = 0; i < pages; i++) {
      const viewport = document.querySelector<HTMLElement>('.endge-tanstack-table__viewport')!
      viewport.scrollTop = 0
      viewport.dispatchEvent(new Event('scroll'))
      await raf()
      await controller.command('loadBefore')
      if (Raph.get(controller.outputPath('error'))) {
        throw new Error('Reverse page failed')
      }
    }
    await api.drain()
    const result = api.stats()
    if (pages && continued && Number(result.first) >= Number(firstBefore)) {
      throw new Error('Reverse made no progress')
    }
    return result
  },
  async filter(value: string) {
    await controller.setProps({ request: { filter: value } })
    await controller.command('loadInitial')
    await nextTick()
    return api.stats()
  },
  async storagePressure(milliseconds = 80) {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('endge-collection-pages')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const transaction = database.transaction('meta', 'readwrite')
      const started = performance.now()
      const done = new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onabort = () => reject(transaction.error)
      })
      const pump = () => {
        const request = transaction.objectStore('meta').get('fixture-pressure')
        request.onsuccess = () => {
          if (performance.now() - started < milliseconds) {
            pump()
          }
        }
      }
      pump()
      let loadMs = 0
      const loading = controller.command('loadAfter').then(() => {
        loadMs = performance.now() - started
      })
      const frames = await api.frames(12)
      await loading
      await done
      await api.drain()
      return { heldMs: milliseconds, loadMs, frames, stats: api.stats() }
    }
    finally { database.close() }
  },
  age(milliseconds: number) { clockOffset += milliseconds },
  command(name: string) { return controller.command(name) },
  keys() { return (Raph.get(controller.outputPath('rows')) as Array<{ id: string }>).map(row => row.id) },
  stats() {
    const outputs = controller.getOutputs()
    const rows = outputs.rows as Array<{ id: string, label: string }>
    return { loadedRows: outputs.loadedRowCount, revision: outputs.rowsRevision, cache: outputs.cacheStatus, refreshPending: outputs.refreshPending, error: outputs.error, first: rows[0]?.id, last: rows.at(-1)?.id, updatedRows: rows.filter(row => row.label.includes('-fresh')).length, hosts: Endge.runtime.getRuntimeHosts().length, domRows: document.querySelectorAll('[data-row-key]').length, queuePeaks: { ...queuePeaks }, database: { ...storageMetrics, opensMs: [...storageMetrics.opensMs], recentTransactionMs: [...storageMetrics.recentTransactionMs] } }
  },
  async cleanup() {
    await cleanup()
    return Endge.runtime.getRuntimeHosts().length
  },
}
Object.assign(window, { collectionWindowPerformance: api })
document.body.dataset.ready = 'true'
