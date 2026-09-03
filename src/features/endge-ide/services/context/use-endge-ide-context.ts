import type { EndgeExecutionContext } from '@endge/core'

import { onScopeDispose, ref } from 'vue'

import { Configurator } from '@/app/Configurator'

/** Thin Vue bridge к IDE context reboot orchestration. */
export function useEndgeIDEContext() {
  const version = ref(0)
  const off = Configurator.context.subscribe(() => {
    version.value += 1
  })
  onScopeDispose(off)

  return {
    version,
    currentContext: () => {
      void version.value
      return Configurator.context.currentContext
    },
    switchContext: (next: Partial<EndgeExecutionContext>) => Configurator.context.switchContext(next),
    reloadCurrentContext: () => Configurator.context.reloadCurrentContext(),
    isMockEnabled: () => {
      void version.value
      return Configurator.context.isMockEnabled
    },
    isDataModeOverridden: () => {
      void version.value
      return Configurator.context.isDataModeOverridden
    },
    setMockEnabled: (enabled: boolean) => Configurator.context.setMockEnabled(enabled),
    clearDataModeOverride: () => Configurator.context.clearDataModeOverride(),
    isSwitching: () => {
      void version.value
      return Configurator.context.isSwitchingContext
    },
  }
}
