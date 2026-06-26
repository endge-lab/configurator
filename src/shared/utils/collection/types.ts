export interface IndexCollectionEntity<ID = string> {
  id: ID
  index: number // глобальный индекс в отсортированной коллекции
  filteredIndex: number // индекс в отфильтрованном массиве
}

export abstract class IndexCollectionEntityDefault implements IndexCollectionEntity<string> {
  id: string = ''
  index: number = -1
  filteredIndex: number = -1
}

export interface CollectionOptions<T extends IndexCollectionEntity<ID>, ID = string> {
  sortFn: (a: T, b: T) => number
  filterFn: (item: T) => boolean
  indexEnabled: boolean
  filterIndexEnabled: boolean
}

export interface ReadonlyIndexCollection<T extends IndexCollectionEntity<ID>, ID = string> {
  get(id: ID): T | undefined
  all(): ReadonlyArray<T>
  size(): number
  unfiltered(): ReadonlyArray<T>
  has(id: ID): boolean
  forEach(callback: (item: T) => void): void
}
