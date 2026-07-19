import type { RuntimePreviewEntityType, RuntimePreviewTarget } from '@/features/endge-ide/domain/types/runtime-preview.types'

import { Endge } from '@endge/core'

const STORAGE_KEY_PREFIX = 'endge:runtime-preview:history:v1'
const ENTITY_TYPES = new Set<RuntimePreviewEntityType>(['project', 'composition', 'component-sfc', 'store'])

interface PersistedRuntimePreviewHistory {
  version: 1
  targets: RuntimePreviewTarget[]
}

/** Reads IDE preview roots only. Runtime hosts and lifecycle state are never persisted. */
export function readRuntimePreviewHistory(): RuntimePreviewTarget[] {
  if (typeof window === 'undefined') {
    return []
  }
  try {
    const raw = window.localStorage.getItem(runtimePreviewHistoryStorageKey())
    if (!raw) {
      return []
    }
    return parseRuntimePreviewHistory(JSON.parse(raw))
  }
  catch {
    return []
  }
}

/** Persists the ordered set of roots currently shown in Runtime Tree. */
export function writeRuntimePreviewHistory(targets: readonly RuntimePreviewTarget[]): void {
  if (typeof window === 'undefined') {
    return
  }
  const key = runtimePreviewHistoryStorageKey()
  try {
    if (targets.length === 0) {
      window.localStorage.removeItem(key)
      return
    }
    const payload: PersistedRuntimePreviewHistory = {
      version: 1,
      targets: normalizeTargets(targets),
    }
    window.localStorage.setItem(key, JSON.stringify(payload))
  }
  catch {
    // Runtime Tree remains usable when browser storage is unavailable.
  }
}

export function parseRuntimePreviewHistory(value: unknown): RuntimePreviewTarget[] {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.targets)) {
    return []
  }
  return normalizeTargets(value.targets)
}

export function runtimePreviewHistoryStorageKey(): string {
  const workspace = Endge.context.getCurrentWorkspace() ?? 'detached'
  const context = Endge.context.getExecutionContext()
  return [
    STORAGE_KEY_PREFIX,
    workspace,
    context.tenantIdentity,
    context.projectIdentity,
    context.environmentIdentity,
  ].map(value => encodeURIComponent(String(value ?? ''))).join(':')
}

function normalizeTargets(values: readonly unknown[]): RuntimePreviewTarget[] {
  const targets = new Map<string, RuntimePreviewTarget>()
  for (const value of values) {
    if (!isRecord(value) || !isEntityType(value.entityType)) {
      continue
    }
    const identity = String(value.identity ?? '').trim()
    if (!identity) {
      continue
    }
    const target = { entityType: value.entityType, identity }
    targets.set(`${target.entityType}:${target.identity}`, target)
  }
  return [...targets.values()]
}

function isEntityType(value: unknown): value is RuntimePreviewEntityType {
  return typeof value === 'string' && ENTITY_TYPES.has(value as RuntimePreviewEntityType)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
