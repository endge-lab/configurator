import { Raph } from '@endge/raph'

export type PersistedFilterPayload = Record<string, unknown>
type PersistedFiltersStore = Record<string, PersistedFilterPayload>

const FILTERS_STORAGE_KEY = 'endge:filters'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function normalizeFilterIdentity(filter: string | { identity?: string | null } | null | undefined): string {
  const raw = typeof filter === 'string'
    ? filter
    : String(filter?.identity ?? '')
  const normalized = raw.trim()
  return normalized.startsWith('filters.')
    ? normalized.slice('filters.'.length)
    : normalized
}

function normalizeFilterSpace(space?: string | null): string {
  return String(space ?? 'default').trim() || 'default'
}

function buildStorageKey(filter: string | { identity?: string | null }, space?: string | null): string {
  const identity = normalizeFilterIdentity(filter)
  const normalizedSpace = normalizeFilterSpace(space)
  return identity && normalizedSpace ? `${identity}.${normalizedSpace}` : ''
}

function readPersistedFiltersStore(): PersistedFiltersStore {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) as unknown : {}
    return isPlainObject(parsed) ? parsed as PersistedFiltersStore : {}
  }
  catch {
    return {}
  }
}

function writePersistedFiltersStore(store: PersistedFiltersStore): void {
  localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(store))
}

function areEqualValues(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false
    }
    return a.every((item, index) => areEqualValues(item, b[index]))
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)
    if (aKeys.length !== bKeys.length) {
      return false
    }
    return aKeys.every(key => areEqualValues(a[key], b[key]))
  }

  return false
}

export function hasObjectPatchChanges(current: unknown, patch: PersistedFilterPayload): boolean {
  const source = isPlainObject(current) ? current : {}
  return Object.entries(patch).some(([key, value]) => !areEqualValues(source[key], value))
}

export function loadPersistedFilterPayload(
  filter: string | { identity?: string | null },
  space?: string | null,
): PersistedFilterPayload | null {
  const key = buildStorageKey(filter, space)
  if (!key) {
    return null
  }

  const value = readPersistedFiltersStore()[key]
  return isPlainObject(value) ? value : null
}

export function savePersistedFilterPayload(
  filter: string | { identity?: string | null },
  payload: PersistedFilterPayload,
  space?: string | null,
): void {
  const key = buildStorageKey(filter, space)
  if (!key) {
    return
  }

  const store = readPersistedFiltersStore()
  const prev = store[key]
  store[key] = isPlainObject(prev)
    ? { ...prev, ...payload }
    : { ...payload }
  writePersistedFiltersStore(store)
}

export function restorePersistedFilterToRaph(
  filter: string | { identity?: string | null },
  space?: string | null,
): PersistedFilterPayload | null {
  const identity = normalizeFilterIdentity(filter)
  if (!identity) {
    return null
  }

  const payload = loadPersistedFilterPayload(identity, space)
  if (!payload) {
    return null
  }

  const raphKey = `filters.${identity}.${normalizeFilterSpace(space)}`
  if (!hasObjectPatchChanges(Raph.get(raphKey), payload)) {
    return payload
  }

  Raph.merge(raphKey, payload)
  return payload
}
