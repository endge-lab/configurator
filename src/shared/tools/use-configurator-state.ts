import type { Ref } from 'vue'

import { Endge } from '@endge/core'
import { ref } from 'vue'

interface ConfiguratorStateOptions<T> {
  legacyKeys?: readonly string[]
  merge?: (stored: T, defaults: T) => T
}

/** Связывает Configurator UI state с user-scoped Endge context и переносит legacy LS. */
export function useConfiguratorState<T>(
  key: string,
  initialValue: T,
  options: ConfiguratorStateOptions<T> = {},
): Ref<T> {
  if (Endge.mode === 'debugger') {
    return ref(structuredClone(initialValue)) as Ref<T>
  }
  migrateLegacyState(key, options.legacyKeys ?? [])

  const stored = Endge.context.getState<T>(key)
  if (stored !== undefined && options.merge) {
    Endge.context.setState(key, options.merge(stored, initialValue))
  }

  return Endge.vue.useContextState(key, () => structuredClone(initialValue))
}

function migrateLegacyState(key: string, legacyKeys: readonly string[]): void {
  if (
    Endge.context.getState(key) !== undefined
    || typeof window === 'undefined'
    || !Endge.context.getCurrentWorkspace()
  ) {
    return
  }
  for (const legacyKey of legacyKeys) {
    try {
      const raw = window.localStorage.getItem(legacyKey)
      if (raw == null) {
        continue
      }
      Endge.context.setState(key, JSON.parse(raw))
      if (Endge.context.getState(key) !== undefined) {
        window.localStorage.removeItem(legacyKey)
      }
      return
    }
    catch {
      // Повреждённое legacy-значение не блокирует UI; следующий key всё ещё можно проверить.
    }
  }
}
