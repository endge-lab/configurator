import type { EndgeExecutionContext } from '@endge/core'

import { onScopeDispose, ref } from 'vue'

import { EndgeConfigurator } from './endge-configurator'

/** Thin Vue bridge к configurator reboot orchestration. */
export function useConfiguratorContext() {
  const version = ref(0)
  const off = EndgeConfigurator.subscribe(() => {
    version.value += 1
  })
  onScopeDispose(off)

  return {
    version,
    currentContext: () => {
      void version.value
      return EndgeConfigurator.currentContext
    },
    switchContext: (next: Partial<EndgeExecutionContext>) => EndgeConfigurator.switchContext(next),
    reloadCurrentContext: () => EndgeConfigurator.reloadCurrentContext(),
    isSwitching: () => {
      void version.value
      return EndgeConfigurator.isSwitchingContext
    },
  }
}
