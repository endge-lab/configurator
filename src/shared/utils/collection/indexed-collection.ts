import type { CollectionOptions, IndexCollectionEntity } from '@/shared/utils/collection/types'
import type { OneOrMany } from '@/shared/utils/tools/types'

export class IndexedCollection<
  T extends Record<K, ID> & IndexCollectionEntity<ID>,
  ID = string,
  K extends keyof T = 'id',
> {
  private _list: Array<T> = []
  private _filteredList: Array<T> = []
  private readonly _map: Map<T[K], T> = new Map()

  private _dirtySort = false
  private _dirtyFilter = false

  private _sortFn?: (a: T, b: T) => number
  private _filterFn?: (item: T) => boolean
  private _indexEnabled = false
  private _filterIndexEnabled = false

  constructor(
    opts: Partial<CollectionOptions<T, ID>> | null = null,
    private readonly _key: K = 'id' as K,
  ) {
    if (opts) {
      this.options(opts)
    }
  }

  options(opts: Partial<CollectionOptions<T, ID>>): this {
    if (opts.sortFn) {
      this._sortFn = opts.sortFn
      this._dirtySort = true
    }
    if (opts.filterFn) {
      this._filterFn = opts.filterFn
      this._dirtyFilter = true
    }
    if (opts.indexEnabled !== undefined) {
      this._indexEnabled = opts.indexEnabled
      this._dirtySort = true
    }
    if (opts.filterIndexEnabled !== undefined) {
      this._filterIndexEnabled = opts.filterIndexEnabled
      this._dirtyFilter = true
    }

    return this
  }

  markDirty(opts: { filter?: boolean, sort?: boolean }): void {
    if (opts.filter) {
      this._dirtyFilter = true
    }
    if (opts.sort) {
      this._dirtySort = true
    }
  }

  add(items: OneOrMany<T>): void {
    const toAdd = Array.isArray(items) ? items : [items]
    for (const item of toAdd) {
      const keyValue = item[this._key]
      if (this._map.has(keyValue)) {
        continue
      }
      this._map.set(keyValue, item)
      this._list.push(item)
    }

    this._dirtySort = true
    this._dirtyFilter = true
  }

  remove(ids: OneOrMany<T[K]>): void {
    const toRemove = Array.isArray(ids) ? ids : [ids]
    const removeSet = new Set(toRemove)

    for (const id of removeSet) {
      this._map.delete(id)
    }

    this._list = this._list.filter(item => !removeSet.has(item[this._key]))

    this._dirtySort = true
    this._dirtyFilter = true
  }

  all(): Array<T> {
    return this.filtered()
  }

  unfiltered(): Array<T> {
    this.ensureSorted()
    return this._list
  }

  filtered(): Array<T> {
    this.ensure()
    return this._filterFn ? this._filteredList : this._list
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
    return this._map.has(id)
  }

  get(id: T[K]): T | undefined {
    return this._map.get(id)
  }

  forEach(callback: (item: T, index: number) => void): void {
    this.all().forEach(callback)
  }

  size(): number {
    return this.all().length
  }

  clear(): void {
    this._list = []
    this._filteredList = []
    this._map.clear()

    this._dirtySort = false
    this._dirtyFilter = false
  }

  //
  // PRIVATE
  //

  ensure(): void {
    this.ensureSorted()
    this.ensureFiltered()
  }

  ensureSorted(): void {
    if (!this._dirtySort) {
      return
    }

    if (this._sortFn) {
      this._list.sort(this._sortFn)
    }

    if (this._indexEnabled) {
      this._list.forEach((item, i) => {
        item.index = i
      })
    }

    this._dirtySort = false
  }

  ensureFiltered(): void {
    if (!this._filterFn) {
      return
    }

    if (!this._dirtyFilter) {
      return
    }

    this._filteredList = this._list.filter(this._filterFn)

    if (this._filterIndexEnabled) {
      this._list.forEach((item) => {
        item.filteredIndex = -1
      })
      this._filteredList.forEach((item, i) => {
        item.filteredIndex = i
      })
    }

    this._dirtyFilter = false
  }
}
