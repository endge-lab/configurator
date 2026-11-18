import { PAGE_CACHE_DATABASE, PageCacheService } from '../../../../../packages/@endge/@endge-core/src/features/core/modules/runtime/services/controllers/cache/PageCacheService'

// Adapter contract against real browser IndexedDB, without replacing the IDB API.
async function run() {
  const checks: string[] = []
  const assert = (value: unknown, name: string) => {
    if (!value) {
      throw new Error(name)
    }
    checks.push(name)
  }
  for (const storage of ['memory', 'indexeddb'] as const) {
    const service = new PageCacheService()
    const cache = service.create({ key: `contract-${storage}`, storage, maxEntries: 2, maxBytes: 500 }, () => ({ user: 'neutral', workspace: 'example' }))
    await cache.select({ filter: 'a' })
    const put = async (offset: number, value: unknown) => {
      await cache.write({
        offset,
      }, value)
      await service.flush()
    }
    const realNow = Date.now
    const frozenNow = realNow()
    Date.now = () => frozenNow
    await put(0, { rows: [{ id: '0', label: 'zero' }] })
    const first = await cache.read({ offset: 0 })
    ;(first!.value as { rows: { label: string }[] }).rows[0].label = 'mutated'
    assert((await cache.read({ offset: 0 }))?.value && JSON.stringify((await cache.read({ offset: 0 }))!.value).includes('zero'), `${storage}: independent values`)
    await put(1, { rows: [{ id: '1' }] })
    const keys = await Promise.all([0, 1].map(async offset => ({ offset, key: (await cache.read({ offset }) as any).key as string })))
    keys.sort((a, b) => a.key.localeCompare(b.key))
    const recent = keys[0].offset
    const oldest = keys[1].offset
    await cache.read({ offset: oldest })
    await cache.read({ offset: recent })
    await put(2, { rows: [{ id: '2' }] })
    assert(!await cache.read({ offset: oldest }) && !!await cache.read({ offset: recent }) && !!await cache.read({ offset: 2 }), `${storage}: LRU`)
    Date.now = realNow
    await put(3, { payload: 'x'.repeat(470) })
    assert(cache.status().bytes <= 500 && cache.status().entries <= 2, `${storage}: simultaneous budgets`)
    const writing = cache.write({ offset: 4 }, { payload: 'pending' })
    await cache.clear()
    await writing
    await service.flush()
    assert(!await cache.read({ offset: 4 }), `${storage}: clear during write preparation`)
    assert(cache.status().pendingWrites === 0, `${storage}: queue drained`)
    await put(0, { rows: [{ id: '0' }] })
    if (storage === 'indexeddb') {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(PAGE_CACHE_DATABASE)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      const mutate = (change: (entry: any) => void) => new Promise<void>((resolve, reject) => {
        const tx = db.transaction('entries', 'readwrite')
        const request = tx.objectStore('entries').openCursor()
        request.onsuccess = () => {
          const cursor = request.result
          if (cursor) {
            const value = cursor.value
            change(value)
            cursor.update(value)
            cursor.continue()
          }
        }
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
      await mutate((entry) => {
        entry.version = 999
      })
      assert(!await cache.read({ offset: 0 }), 'indexeddb: incompatible format is miss')
      await mutate((entry) => {
        entry.version = 1
        entry.storedAt = NaN
      })
      assert(!await cache.read({ offset: 0 }), 'indexeddb: damaged metadata is miss')
      db.close()
    }
    await cache.clear()
    await service.reset()
    assert(cache.status().pendingWrites === 0, `${storage}: reset releases queue`)
  }
  return checks
}
Object.assign(window, { pageCacheContract: run() })
