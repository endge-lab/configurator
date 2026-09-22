import type { RuntimePreviewEntityType, RuntimePreviewTarget } from '@/features/endge-ide/domain/types/runtime-preview.types'

import { Endge } from '@endge/core'

const STATE_KEY = 'configurator.runtime-preview.history'
const ENTITY_TYPES = new Set<RuntimePreviewEntityType>(['composition', 'component-sfc', 'store', 'simulation'])

interface PersistedRuntimePreviewHistory {
  version: 1
  targets: RuntimePreviewTarget[]
}

/** Читает только корни preview IDE. Runtime-hosts и состояние lifecycle никогда не сохраняются. */
export function readRuntimePreviewHistory(): RuntimePreviewTarget[] {
  try {
    const payload = Endge.context.getState<unknown>(STATE_KEY)
    return parseRuntimePreviewHistory(payload)
  }
  catch {
    return []
  }
}

/** Сохраняет упорядоченный набор корней, показанных сейчас в Runtime Tree. */
export function writeRuntimePreviewHistory(targets: readonly RuntimePreviewTarget[]): void {
  try {
    if (targets.length === 0) {
      Endge.context.removeState(STATE_KEY)
      return
    }
    const payload: PersistedRuntimePreviewHistory = {
      version: 1,
      targets: normalizeTargets(targets),
    }
    Endge.context.setState(STATE_KEY, payload)
  }
  catch {
    // Runtime Tree сохраняет работоспособность, когда browser storage недоступен.
  }
}

export function parseRuntimePreviewHistory(value: unknown): RuntimePreviewTarget[] {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.targets)) {
    return []
  }
  return normalizeTargets(value.targets)
}

export function runtimePreviewHistoryStorageKey(): string {
  return STATE_KEY
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
