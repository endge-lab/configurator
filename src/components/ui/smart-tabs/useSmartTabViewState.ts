import type { SmartTabViewStateSlice } from '@/components/ui/smart-tabs/types'
import type { InjectionKey, Ref } from 'vue'

import { inject, ref, watch } from 'vue'

export interface SmartTabViewStateScope {
  read: (key: string) => SmartTabViewStateSlice | undefined
  write: (key: string, slice: SmartTabViewStateSlice) => void
  clear: (key: string) => void
  readShared: (key: string) => SmartTabViewStateSlice | undefined
  writeShared: (key: string, slice: SmartTabViewStateSlice) => void
  clearShared: (key: string) => void
}

export interface SmartTabViewStateOptions<T> {
  version?: number
  defaultValue: () => T
  validate?: (value: unknown) => boolean
  migrate?: (value: unknown, fromVersion: number) => unknown
}

export const SMART_TAB_VIEW_STATE_SCOPE: InjectionKey<SmartTabViewStateScope>
  = Symbol('smart-tab-view-state-scope')

type SmartTabViewStateSliceScope = Pick<SmartTabViewStateScope, 'read' | 'write' | 'clear'>

export function resolveSmartTabViewState<T>(
  stored: SmartTabViewStateSlice | undefined,
  options: SmartTabViewStateOptions<T>,
): { restored: boolean, value: T } {
  const fallback = options.defaultValue()
  if (!stored) {
    return { restored: false, value: fallback }
  }

  try {
    const version = options.version ?? 1
    const candidate = stored.version === version
      ? stored.value
      : options.migrate?.(stored.value, stored.version)
    if (candidate === undefined || (options.validate && !options.validate(candidate))) {
      return { restored: false, value: fallback }
    }
    return { restored: true, value: candidate as T }
  }
  catch {
    return { restored: false, value: fallback }
  }
}

export function useSmartTabViewState<T>(
  key: string,
  options: SmartTabViewStateOptions<T>,
): Ref<T> {
  const scope = inject(SMART_TAB_VIEW_STATE_SCOPE, null)
  if (!scope) {
    return ref(options.defaultValue()) as Ref<T>
  }

  return useViewStateFromScope(key, options, scope)
}

function useViewStateFromScope<T>(
  key: string,
  options: SmartTabViewStateOptions<T>,
  scope: SmartTabViewStateSliceScope,
): Ref<T> {
  let stored: SmartTabViewStateSlice | undefined
  try {
    stored = scope.read(key)
  }
  catch (error) {
    console.warn('[SmartTabs] Failed to read view state.', { key, error })
  }

  const restored = resolveSmartTabViewState(stored, options)
  const state = ref(restored.value) as Ref<T>
  if (stored && !restored.restored) {
    console.warn('[SmartTabs] Ignored invalid view state.', { key })
    try {
      scope.clear(key)
    }
    catch (error) {
      console.warn('[SmartTabs] Failed to clear invalid view state.', { key, error })
    }
  }

  const version = options.version ?? 1
  watch(state, (value) => {
    try {
      if (options.validate && !options.validate(value)) {
        return
      }
      scope.write(key, { version, value })
    }
    catch (error) {
      console.warn('[SmartTabs] Failed to update view state.', { key, error })
    }
  }, { deep: true, flush: 'sync' })

  return state
}

export function useSmartTabSharedViewState<T>(
  key: string,
  options: SmartTabViewStateOptions<T>,
): Ref<T> {
  const scope = inject(SMART_TAB_VIEW_STATE_SCOPE, null)
  if (!scope) {
    return ref(options.defaultValue()) as Ref<T>
  }

  const sharedScope: SmartTabViewStateSliceScope = {
    read: scope.readShared,
    write: scope.writeShared,
    clear: scope.clearShared,
  }

  return useViewStateFromScope(key, options, sharedScope)
}

export function useSmartTabSelection<T extends string>(
  key: string,
  defaultValue: T,
  allowedValues: readonly T[],
): Ref<T> {
  return useSmartTabViewState(key, {
    defaultValue: () => defaultValue,
    validate: value => typeof value === 'string' && allowedValues.includes(value as T),
  })
}
