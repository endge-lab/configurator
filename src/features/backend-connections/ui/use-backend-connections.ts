import { computed, onScopeDispose, ref } from 'vue'

import { Configurator } from '@/app'

export function useBackendConnections() {
  const revision = ref(0)
  const unsubscribe = Configurator.connections.subscribe(() => {
    revision.value += 1
  })
  onScopeDispose(unsubscribe)

  return {
    state: computed(() => {
      void revision.value
      return Configurator.connections.state
    }),
    catalog: computed(() => {
      void revision.value
      return Configurator.connections.catalog
    }),
    activeBackendURL: computed(() => {
      void revision.value
      return Configurator.connections.activeBackendURL
    }),
    isPrimaryActive: computed(() => {
      void revision.value
      return Configurator.connections.isPrimaryActive
    }),
  }
}
