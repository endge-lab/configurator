import type { InjectionKey } from 'vue'
import type { ConfiguratorSessionState } from '@/features/configurator-session/domain/types/configurator-session.type'
import type { ConfiguratorSession_Module } from '@/features/configurator-session/model/ConfiguratorSession_Module'

import { computed, inject, onScopeDispose, ref } from 'vue'

export interface ConfiguratorSessionBinding {
  module: ConfiguratorSession_Module | null
  logout: () => Promise<void>
}

/** Vue-контекст предоставляет presentation-слою единственного владельца session. */
export const configuratorSessionBindingKey: InjectionKey<ConfiguratorSessionBinding>
  = Symbol('configurator-session-binding')

/** Реактивный presentation-adapter над framework-neutral session module. */
export function useConfiguratorSession() {
  const binding = inject(configuratorSessionBindingKey, null)
  const revision = ref(0)
  const unsubscribe = binding?.module?.subscribe(() => {
    revision.value += 1
  })

  if (unsubscribe) {
    onScopeDispose(unsubscribe)
  }

  const state = computed<ConfiguratorSessionState>(() => {
    void revision.value
    return binding?.module?.state ?? { status: 'idle' }
  })

  return {
    state,
    logout: async (): Promise<void> => {
      if (!binding) {
        return
      }
      await binding.logout()
    },
  }
}
