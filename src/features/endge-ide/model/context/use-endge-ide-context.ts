import type { EndgeExecutionContext } from '@endge/core'

import { onScopeDispose, ref } from 'vue'

import { EndgeIDEContext } from './endge-ide-context'

/** Thin Vue bridge к IDE context reboot orchestration. */
export function useEndgeIDEContext() {
  const version = ref(0)
  const off = EndgeIDEContext.subscribe(() => {
    version.value += 1
  })
  onScopeDispose(off)

  return {
    version,
    currentContext: () => {
      void version.value
      return EndgeIDEContext.currentContext
    },
    switchContext: (next: Partial<EndgeExecutionContext>) => EndgeIDEContext.switchContext(next),
    reloadCurrentContext: () => EndgeIDEContext.reloadCurrentContext(),
    isMockEnabled: () => {
      void version.value
      return EndgeIDEContext.isMockEnabled
    },
    isDataModeOverridden: () => {
      void version.value
      return EndgeIDEContext.isDataModeOverridden
    },
    setMockEnabled: (enabled: boolean) => EndgeIDEContext.setMockEnabled(enabled),
    clearDataModeOverride: () => EndgeIDEContext.clearDataModeOverride(),
    isSwitching: () => {
      void version.value
      return EndgeIDEContext.isSwitchingContext
    },
  }
}
