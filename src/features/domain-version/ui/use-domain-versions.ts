import type { DomainVersionTarget } from '@/features/domain-version/domain/types/domain-version.type'

import { onScopeDispose, ref } from 'vue'

import { Configurator } from '@/app/model/kernel/configurator'

export function useDomainVersions() {
  const revision = ref(0)
  const unsubscribe = Configurator.domainVersions.subscribe(() => {
    revision.value += 1
  })
  onScopeDispose(unsubscribe)

  return {
    state: (target: DomainVersionTarget | null) => {
      void revision.value
      return Configurator.domainVersions.state(target)
    },
    refresh: (target: DomainVersionTarget, force = false) => Configurator.domainVersions.refresh(target, force),
    refreshMany: (targets: DomainVersionTarget[], force = false) => Configurator.domainVersions.refreshMany(targets, force),
  }
}
