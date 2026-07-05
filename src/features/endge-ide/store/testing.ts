import type { EndgeScenarioTestingOptions } from '@endge/core'

import { Endge } from '@endge/core'
import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTestingStore = defineStore('endge-testing-store', () => {
  const options = useLocalStorage<EndgeScenarioTestingOptions>(
    'endge-testing-options',
    {
      generatorCount: 0,
      updatesPerSeconds: 0,
    },
  )

  const isUPSRunning = ref(false)

  function toggleUpdates(): void {
    Endge.testing.setupTestingOptions(options.value, { mode: 'append' })

    //
    //
    if (isUPSRunning.value) {
      Endge.testing.stopUpdatesThread()
    }
    else {
      Endge.testing.startUpdatesThread()
    }

    //
    //
    isUPSRunning.value = !isUPSRunning.value
  }

  return {
    options,
    isUPSRunning,
    toggleUpdates,
  }
})
