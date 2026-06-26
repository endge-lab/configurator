import type { OneOrMany } from '@/shared/utils/tools/types'
import type { CollectionOptions, IndexCollectionEntity } from '@/shared/utils/collection/types'

export class IndexedCollection<
  T extends Record<K, ID> & IndexCollectionEntity<ID>,
  ID = string,
  K extends keyof T = 'id',
> {
  private list: Array<T> = []
  private filteredList: Array<T> = []
  private readonly map: Map<T[K], T> = new Map()

  private dirtySort = false
  private dirtyFilter = false

  private sortFn?: (a: T, b: T) => number
  private filterFn?: (item: T) => boolean
  private indexEnabled = false
  private filterIndexEnabled = false

  constructor(
    opts: Partial<CollectionOptions<T, ID>> | null = null,
    private readonly key: K = 'id' as K,
  ) {
    if (opts) {
      this.options(opts)
    }
  }

  options(opts: Partial<CollectionOptions<T, ID>>): this {
    if (opts.sortFn) {
      this.sortFn = opts.sortFn
      this.dirtySort = true
    }
    if (opts.filterFn) {
      this.filterFn = opts.filterFn
      this.dirtyFilter = true
    }
    if (opts.indexEnabled !== undefined) {
      this.indexEnabled = opts.indexEnabled
      this.dirtySort = true
    }
    if (opts.filterIndexEnabled !== undefined) {
      this.filterIndexEnabled = opts.filterIndexEnabled
      this.dirtyFilter = true
    }

    return this
  }

  markDirty(opts: { filter?: boolean; sort?: boolean }): void {
    if (opts.filter) {
      this.dirtyFilter = true
    }
    if (opts.sort) {
      this.dirtySort = true
    }
  }

  add(items: OneOrMany<T>): void {
    const toAdd = Array.isArray(items) ? items : [items]
    for (const item of toAdd) {
      const keyValue = item[this.key]
      if (this.map.has(keyValue)) {
        continue
      }
      this.map.set(keyValue, item)
      this.list.push(item)
    }

    this.dirtySort = true
    this.dirtyFilter = true
  }

  remove(ids: OneOrMany<T[K]>): void {
    const toRemove = Array.isArray(ids) ? ids : [ids]
    const removeSet = new Set(toRemove)

    for (const id of removeSet) {
      this.map.delete(id)
    }

    this.list = this.list.filter(item => !removeSet.has(item[this.key]))

    this.dirtySort = true
    this.dirtyFilter = true
  }

  all(): Array<T> {
    return this.filtered()
  }

  unfiltered(): Array<T> {
    this.ensureSorted()
    return this.list
  }

  filtered(): Array<T> {
    this.ensure()
    return this.filterFn ? this.filteredList : this.list
  }

  pos(index: number): T | null {
    const all = this.all()
    if (index < 0 || index >= all.length) {
      return null
    }
    return all[index]
  }

  last(): T | null {
    const all = this.all()
    if (all.length === 0) {
      return null
    }
    return all[all.length - 1]
  }

  first(): T | null {
    const all = this.all()
    if (all.length === 0) {
      return null
    }
    return all[0]
  }

  has(id: T[K]): boolean {
    return this.map.has(id)
  }

  get(id: T[K]): T | undefined {
    return this.map.get(id)
  }

  forEach(callback: (item: T, index: number) => void): void {
    this.all().forEach(callback)
  }

  size(): number {
    return this.all().length
  }

  clear(): void {
    this.list = []
    this.filteredList = []
    this.map.clear()

    this.dirtySort = false
    this.dirtyFilter = false
  }

  //
  // PRIVATE
  //

  ensure(): void {
    this.ensureSorted()
    this.ensureFiltered()
  }

  ensureSorted(): void {
    if (!this.dirtySort) {
      return
    }

    if (this.sortFn) {
      this.list.sort(this.sortFn)
    }

    if (this.indexEnabled) {
      this.list.forEach((item, i) => {
        item.index = i
      })
    }

    this.dirtySort = false
  }

  ensureFiltered(): void {
    if (!this.filterFn) {
      return
    }

    if (!this.dirtyFilter) {
      return
    }

    this.filteredList = this.list.filter(this.filterFn)

    if (this.filterIndexEnabled) {
      this.list.forEach(item => {
        item.filteredIndex = -1
      })
      this.filteredList.forEach((item, i) => {
        item.filteredIndex = i
      })
    }

    this.dirtyFilter = false
  }
}
