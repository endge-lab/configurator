import { defineStore } from 'pinia'
import { Endge } from '@endge/core'
import { useSubscribableRef } from '@endge/ui-vue'
import { ref } from 'vue'

export const useDomainRepository = defineStore('endge-domain-repository', () => {
  const { refObj: domainRepository } = useSubscribableRef(Endge.domainRepository)
  const isPayloadModalActive = ref(false)

  function toggleModal(status?: boolean): void {
    if (status === undefined) {
      isPayloadModalActive.value = !isPayloadModalActive.value
    } else {
      isPayloadModalActive.value = status
    }
  }

  return {
    domainRepository,
    isPayloadModalActive,
    toggleModal,
  }
})
