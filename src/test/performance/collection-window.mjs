import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import process from 'node:process'
import { chromium, firefox, webkit } from '@playwright/test'

async function main() {
  function option(name, fallback) {
    const index = process.argv.indexOf(name)
    return index < 0 ? fallback : process.argv[index + 1]
  }
  const roots = { baseline: path.resolve(option('--baseline', 'dist-window-baseline')), candidate: path.resolve(option('--candidate', 'dist-window-candidate')), contract: path.resolve(option('--contract', 'dist-page-cache-contract')) }
  const output = path.resolve(option('--out', 'window-performance.json'))
  const blocks = Number(option('--blocks', '5'))
  const engines = option('--engines', 'chromium,firefox,webkit').split(',')
  const smokeOnly = process.argv.includes('--smoke')
  let control = { total: 500000, bytes: 1024, delay: 0, label: '', shift: 0 }
  let requests = 0
  const results = { format: 'endge-window-performance/v1', mode: smokeOnly ? 'correctness-only' : 'full', engines, node: process.version, blocks, correctness: [], aa: [], pairs: [], cache: [], matrix: [], comparison: {}, heap: null, failures: [] }
  const quantile = (values, probability) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * probability))]
  function interval(values) {
    let seed = 17
    const draw = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 4294967296
    }
    const samples = Array.from({ length: 5000 }, () => Math.exp(values.reduce(sum => sum + Math.log(values[Math.floor(draw() * values.length)]), 0) / values.length)).sort((a, b) => a - b)
    return { ratio: Math.exp(values.reduce((sum, value) => sum + Math.log(value), 0) / values.length), low: samples[125], high: samples[4875] }
  }
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost')
      if (url.pathname === '/__collection-window/page') {
        let body = ''
        for await (const chunk of req) {
          body += chunk
        }
        const input = JSON.parse(body || '{}')
        requests++
        const limit = Number(input.limit ?? 100)
        const offset = Number(input.offset ?? 0)
        const end = Math.min(control.total, offset + limit)
        const response = { offset, total: control.total, startCursor: String(offset), endCursor: String(end), hasBefore: offset > 0, hasAfter: end < control.total, rows: Array.from({ length: Math.max(0, end - offset) }, (_, index) => ({ id: String(offset + index + control.shift), label: `row${control.label}-${offset + index}`, payload: `${offset + index}:${'x'.repeat(Math.max(0, control.bytes - 40))}` })) }
        if (control.delay) {
          await new Promise(resolve => setTimeout(resolve, control.delay))
        }
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(response))
        return
      }
      const [, kind, ...parts] = url.pathname.split('/')
      const root = roots[kind]
      if (!root) {
        res.writeHead(404)
        res.end()
        return
      }
      const file = path.resolve(root, ...parts)
      if (!file.startsWith(root + path.sep)) {
        res.writeHead(403)
        res.end()
        return
      }
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html')
      res.end(await readFile(file))
    }
    catch (error) {
      res.writeHead(500)
      res.end(String(error))
    }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  const route = kind => `${origin}/${kind}/src/test/e2e/collection-window-performance.html`
  const launch = engine => engine.launch({ headless: true, ...(engine === chromium ? { args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--enable-precise-memory-info'] } : {}) })
  const call = (page, method, input) => page.evaluate(async ({ method, input }) => window.collectionWindowPerformance[method](input), { method, input })
  async function open(browser, kind) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(route(kind))
    await page.waitForFunction(() => !!window.collectionWindowPerformance)
    return { context, page, errors }
  }

  try {
  // Correctness is a precondition; native IndexedDB is exercised in all supported engines.
    for (const [name, engine] of [['chromium', chromium], ['firefox', firefox], ['webkit', webkit]].filter(([name]) => engines.includes(name))) {
      let browser
      try {
        browser = await launch(engine)
        const contractContext = await browser.newContext()
        try {
          const contractPage = await contractContext.newPage()
          await contractPage.goto(`${origin}/contract/src/test/e2e/page-cache-contract.html`)
          const checks = await contractPage.evaluate(async () => window.pageCacheContract)
          assert.equal(checks.length, 14)
          results.correctness.push({ engine: name, version: browser.version(), status: 'pass', adapterChecks: checks })
        }
        finally { await contractContext.close() }
        const { context, page, errors } = await open(browser, 'candidate')
        control = { total: 500000, bytes: 1024, delay: 0, label: '', shift: 0 }
        const cache = { key: `native-${name}`, storage: 'indexeddb', strategy: 'stale-while-revalidate', maxAgeMs: 60000, maxStaleMs: 600000, maxEntries: 50, maxBytes: 8388608 }
        await call(page, 'configure', { cache })
        const initial = requests
        await call(page, 'warmHits', 3)
        assert.equal(requests, initial, 'warm hit sends no HTTP')
        await page.reload()
        await page.waitForFunction(() => !!window.collectionWindowPerformance)
        await call(page, 'configure', { cache })
        assert.equal(requests, initial, 'IndexedDB survives reload')
        control.label = '-fresh'
        await call(page, 'age', 61000)
        await call(page, 'frames', 40)
        await page.waitForFunction(() => window.collectionWindowPerformance.stats().updatedRows > 0)
        assert.equal((await call(page, 'stats')).refreshPending, false)
        const keys = await call(page, 'keys')
        control.shift = 1
        await call(page, 'age', 61000)
        await call(page, 'frames', 40)
        await page.waitForFunction(() => window.collectionWindowPerformance.stats().refreshPending)
        assert.deepEqual(await call(page, 'keys'), keys)
        const before = requests
        await call(page, 'command', 'loadAfter')
        assert.equal(requests, before)
        await call(page, 'command', 'refresh')
        assert.equal((await call(page, 'stats')).first, '1')
        control.shift = 0
        await call(page, 'filter', 'blue')
        assert.equal((await call(page, 'stats')).first, '0')
        const pressure = await call(page, 'storagePressure', 80)
        assert.ok(pressure.loadMs >= 60)
        assert.equal(pressure.stats.error ?? null, null)
        assert.equal(await call(page, 'cleanup'), 0)
        assert.deepEqual(errors, [])
        results.correctness.push({ engine: name, version: browser.version(), status: 'pass', nativeIndexedDB: true, storagePressureMs: pressure.loadMs })
        await context.close()
      }
      catch (error) {
        results.correctness.push({
          engine: name,
          status: 'fail',
          error: String(error),
        })
        results.failures.push(`${name
        } correctness`)
      }
      finally { await browser?.close() }
    }
    if (results.failures.length) {
      throw new Error('Correctness admission failed')
    }
    if (smokeOnly) {
      throw new Error('SMOKE_ONLY')
    }
    const browser = await launch(chromium)
    try {
      async function sample(kind, cache) {
        control = { total: 50000, bytes: 1024, delay: 0, label: '', shift: 0 }
        const { page, context, errors } = await open(browser, kind)
        try {
          await call(page, 'configure', { ...(cache ? { cache } : {}) })
          const viewport = await call(page, 'viewport', 300)
          const frames = await call(page, 'frames', 180)
          const stats = await call(page, 'stats')
          assert.deepEqual(errors, [])
          assert.equal(await call(page, 'cleanup'), 0)
          return { viewportTotal: viewport.reduce((sum, value) => sum + value, 0), viewportP95: quantile(viewport, 0.95), viewportP99: quantile(viewport, 0.99), frameP95: quantile(frames.intervals, 0.95), longTasks: frames.longTasks, domRows: frames.domRows, stats }
        }
        finally { await context.close() }
      }
      for (let block = 0; block < blocks; block++) {
        const a = await sample('baseline')
        const b = await sample('baseline')
        results.aa.push({ block, a, b })
      }
      const aaComparison = Object.fromEntries(['viewportTotal', 'frameP95'].map(metric => [metric, interval(results.aa.map(item => item.b[metric] / item.a[metric]))]))
      const aaRatios = results.aa.flatMap(item => ['viewportTotal', 'frameP95'].map(metric => item.b[metric] / item.a[metric]))
      const browserAdmitted = aaRatios.every(ratio => ratio >= 0.9 && ratio <= 1.1) && Object.values(aaComparison).every(ci => Number.isFinite(ci.low) && ci.low >= 0.9 && ci.high <= 1.1)
      results.aaComparison = aaComparison
      results.timingAdmitted = browserAdmitted
      if (!browserAdmitted) {
        results.failures.push('A/A browser admission is noisy; subsequent cache profiles are diagnostic')
      }
      for (let block = 0; block < (browserAdmitted ? blocks : 0); block++) {
        const order = block % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate']
        const pair = { block }
        for (const kind of order) {
          pair[kind] = await sample(kind)
        }
        results.pairs.push(pair)
      }
      for (const metric of results.pairs.length ? ['viewportTotal', 'frameP95'] : []) {
        const ci = interval(results.pairs.map(pair => pair.candidate[metric] / pair.baseline[metric]))
        results.comparison[metric] = ci
        if (!Number.isFinite(ci.high) || ci.high > 1.1) {
          results.failures.push(`${metric
          } regression unconfirmed`)
        }
      }
      for (const storage of ['memory', 'indexeddb']) {
        control = { total: 500000, bytes: 1024, delay: 0, label: '', shift: 0 }
        const { page, context } = await open(browser, 'candidate')
        try {
          const cache = { key: `performance-${storage}`, storage, strategy: 'cache-first', maxAgeMs: 60000, maxEntries: 50, maxBytes: 8388608 }
          const seeded = await call(page, 'configure', { cache })
          const cdp = await context.newCDPSession(page)
          await cdp.send('Performance.enable')
          const metricsBefore = await cdp.send('Performance.getMetrics')
          const started = performance.now()
          const before = requests
          const hits = await call(page, 'warmHits', 50)
          const phaseWallMs = performance.now() - started
          const metricsAfter = await cdp.send('Performance.getMetrics')
          const task = data => data.metrics.find(metric => metric.name === 'TaskDuration')?.value ?? 0
          const phaseCpuMs = 1000 * (task(metricsAfter) - task(metricsBefore))
          assert.equal(requests, before)
          const hitP95 = quantile(hits, 0.95)
          if (storage === 'indexeddb' && hitP95 > 25) {
            results.failures.push('IndexedDB warm p95 >25ms')
          }
          const reopened = await call(page, 'configure', { cache })
          await call(page, 'traverse', 60)
          await cdp.send('HeapProfiler.collectGarbage')
          const initialHeap = (await cdp.send('Runtime.getHeapUsage')).usedSize
          const heaps = []
          for (let cycle = 0; cycle < 10; cycle++) {
            await call(page, 'traverse', 60)
            await cdp.send('HeapProfiler.collectGarbage')
            heaps.push((await cdp.send('Runtime.getHeapUsage')).usedSize)
          }
          const stats = await call(page, 'stats')
          assert.ok(stats.loadedRows <= 1000)
          assert.ok(stats.cache.entries <= 50 && stats.cache.bytes <= 8388608)
          if (heaps.at(-1) > initialHeap * 1.1 + 2 * 1024 * 1024) {
            results.failures.push(`${storage
            } heap growth`)
          }
          results.cache.push({ storage, hitP95, coldOpenMs: seeded.database.opensMs, reopenMs: reopened.database.opensMs, phaseWallMs, phaseCpuMs, waitAndSchedulingMs: Math.max(0, phaseWallMs - phaseCpuMs), initialHeap, heaps, stats, requests, hitRatio: stats.cache.hits / Math.max(1, stats.cache.hits + stats.cache.misses) })
          assert.equal(await call(page, 'cleanup'), 0)
        }
        finally { await context.close() }
      }
      // Stress profiles retain the real Store/Table chain and generate pages on demand.
      for (const total of [50000, 500000]) {
        for (const [rows, bytes] of [[1000, 1024], [10000, 1024], [1000, 4096], [10000, 4096]]) {
          for (const storage of ['off', 'memory', 'indexeddb']) {
            control = { total, bytes, delay: storage === 'indexeddb' ? 20 : 0, label: '', shift: 0 }
            const { page, context, errors } = await open(browser, 'candidate')
            try {
              const cache = storage === 'off' ? undefined : { key: `matrix-${total}-${rows}-${bytes}-${storage}`, storage, maxEntries: 25, maxBytes: 4 * 1024 * 1024 }
              const start = performance.now()
              const before = requests
              const seeded = await call(page, 'configure', { rows, cache })
              assert.equal(seeded.loadedRows, rows)
              const openAndSeedMs = performance.now() - start
              const viewport = await call(page, 'viewport', 300)
              const frames = await call(page, 'frames', 60)
              const afterForward = await call(page, 'traverse', 30)
              const afterReverse = await call(page, 'reverse', 10)
              assert.equal(afterForward.error, null)
              assert.equal(afterReverse.error, null)
              await call(page, 'filter', 'blue')
              const stats = await call(page, 'stats')
              assert.ok(afterForward.loadedRows <= rows && afterReverse.loadedRows <= rows && stats.loadedRows <= rows)
              assert.ok(stats.domRows < 100)
              if (cache) {
                assert.ok(stats.cache.entries <= cache.maxEntries && stats.cache.bytes <= cache.maxBytes)
                assert.ok(stats.cache.pendingWrites <= 32 && stats.cache.pendingBytes <= 8 * 1024 * 1024)
              }
              assert.deepEqual(errors, [])
              results.matrix.push({ total, rows, bytes, storage, openAndSeedMs, requests: requests - before, activeWindowRows: seeded.loadedRows, afterForward, afterReverse, viewportP95: quantile(viewport, 0.95), frameP95: quantile(frames.intervals, 0.95), longTasks: frames.longTasks, stats })
              assert.equal(await call(page, 'cleanup'), 0)
            }
            finally { await context.close() }
          }
        }
      }
      const retained = await open(browser, 'candidate')
      try {
        control = { total: 500000, bytes: 1024, delay: 0, label: '', shift: 0 }
        await call(retained.page, 'configure', { retention: { beforeRows: 200, afterRows: 400 }, cache: { key: 'retention-pressure', storage: 'indexeddb', maxEntries: 25, maxBytes: 4 * 1024 * 1024 } })
        await call(retained.page, 'traverse', 30)
        await call(retained.page, 'reverse', 10)
        const pressure = await call(retained.page, 'storagePressure', 80)
        assert.ok(pressure.loadMs >= 60)
        assert.ok(pressure.stats.loadedRows <= 1000)
        assert.ok(pressure.stats.domRows < 100)
        results.matrix.push({ scenario: 'retention-and-native-storage-lock', ...pressure })
        assert.equal(await call(retained.page, 'cleanup'), 0)
      }
      finally { await retained.context.close() }
      const shared = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
      try {
        control = { total: 500000, bytes: 4096, delay: 40, label: '', shift: 0 }
        const pages = await Promise.all([shared.newPage(), shared.newPage()])
        await Promise.all(pages.map(async (page) => {
          await page.goto(route('candidate'))
          await page.waitForFunction(() => !!window.collectionWindowPerformance)
          await call(page, 'configure', { cache: { key: 'two-owners-pressure', storage: 'indexeddb', maxEntries: 25, maxBytes: 4 * 1024 * 1024 } })
        }))
        const start = performance.now()
        await Promise.all(pages.map(async (page, index) => {
          await call(page, 'traverse', 30)
          await call(page, 'reverse', 10)
          await call(page, 'filter', index ? 'blue' : 'green')
        }))
        results.matrix.push({ scenario: 'two-independent-owners-slow-network', elapsedMs: performance.now() - start, stats: await Promise.all(pages.map(page => call(page, 'stats'))) })
        for (const page of pages) {
          assert.equal(await call(page, 'cleanup'), 0)
        }
      }
      finally { await shared.close() }
      control = { total: 50000, bytes: 1024, delay: 0, label: '', shift: 0 }
      const swr = await sample('candidate', { key: 'swr-performance', storage: 'indexeddb', strategy: 'stale-while-revalidate', maxAgeMs: 1, maxStaleMs: 60000, maxEntries: 50, maxBytes: 8388608 })
      results.cache.push({ storage: 'indexeddb', strategy: 'stale-while-revalidate', ...swr })
      for (const pair of results.pairs) {
        if (pair.candidate.viewportP95 > 4 || pair.candidate.viewportP99 > 8) {
          results.failures.push('viewport budget')
        }
        if (pair.candidate.frameP95 > 20 || pair.candidate.longTasks.some(value => value >= 50)) {
          results.failures.push('frame/long-task budget')
        }
      }
      if (swr.frameP95 > 20 || swr.longTasks.some(value => value >= 50)) {
        results.failures.push('SWR frame/long-task budget')
      }
    }
    finally { await browser.close() }
  }
  catch (error) {
    if (error.message !== 'SMOKE_ONLY') {
      results.failures.push(String(error))
    }
  }
  finally {
    await new Promise(resolve => server.close(resolve))
    await mkdir(path.dirname(output), { recursive: true })
    await writeFile(output, JSON.stringify(results, null, 2))
    console.log(JSON.stringify({ correctness: results.correctness, pairs: results.pairs.length, cache: results.cache.map(item => ({ storage: item.storage, hitP95: item.hitP95, frameP95: item.frameP95 })), failures: results.failures }))
    if (results.failures.length) {
      process.exitCode = 1
    }
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
