import type { EndgeExecutionContext } from '@endge/core'
import { Endge } from '@endge/core'

import { onScopeDispose, ref } from 'vue'

import { Configurator } from '@/app/Configurator'

/** Thin Vue bridge к IDE context reboot orchestration. */
export function useEndgeIDEContext() {
  const version = ref(0)
  const off = Configurator.context.subscribe(() => {
    version.value += 1
  })
  const offCore = Endge.context.subscribe(() => {
    version.value += 1
  })
  onScopeDispose(off)
  onScopeDispose(offCore)

  return {
    version,
    currentContext: () => {
      void version.value
      return Endge.context.getExecutionContext()
    },
    switchContext: (next: Partial<EndgeExecutionContext>) => Configurator.context.switchContext(next),
    reloadCurrentContext: () => Configurator.context.reloadCurrentContext(),
    isMockEnabled: () => {
      void version.value
      return Endge.context.isMockEnabled
    },
    isDataModeOverridden: () => {
      void version.value
      return Endge.context.isDataModeOverridden
    },
    setMockEnabled: (enabled: boolean) => Endge.commands.execute({ type: 'context:set-data-mode', payload: { dataMode: enabled ? 'mock' : 'live' } }),
    clearDataModeOverride: () => Endge.commands.execute({ type: 'context:set-data-mode', payload: { dataMode: null } }),
    isSwitching: () => {
      void version.value
      return Configurator.context.isSwitchingContext
    },
  }
}
