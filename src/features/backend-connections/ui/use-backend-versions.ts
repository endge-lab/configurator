import type { BackendVersionState } from '@/features/backend-connections/domain/types/backend-version.type'

import { onScopeDispose, ref } from 'vue'

import { Configurator } from '@/app/model/kernel/configurator'

export function useBackendVersions() {
  const revision = ref(0)
  const unsubscribe = Configurator.backendVersions.subscribe(() => {
    revision.value += 1
  })
  onScopeDispose(unsubscribe)

  return {
    state: (backendURL: string): BackendVersionState => {
      void revision.value
      return Configurator.backendVersions.state(backendURL)
    },
    refresh: (backendURL: string, force = false) => Configurator.backendVersions.refresh(backendURL, force),
    refreshMany: (backendURLs: string[], force = false) => Configurator.backendVersions.refreshMany(backendURLs, force),
  }
}
