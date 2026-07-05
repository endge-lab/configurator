import { defineStore } from 'pinia'
import { useSubscribableRef } from '@endge/utils'
import { Endge } from '@endge/core'

export const useSchemaStorage = defineStore('endge-schema-storage', () => {
  const { refObj: schema } = useSubscribableRef(Endge.schema)
  const isPayloadModalActive = ref(false)

  function toggleModal(status?: boolean): void {
    if (status === undefined) {
      isPayloadModalActive.value = !isPayloadModalActive.value
    } else {
      isPayloadModalActive.value = status
    }
  }

  return {
    schema,
    isPayloadModalActive,
    toggleModal,
  }
})
