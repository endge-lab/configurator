<script setup lang="ts">
import { Endge } from '@endge/core'
import { onBeforeUnmount, onMounted } from 'vue'

import EndgeAdapterRoot from '@/components/endge/EndgeAdapterRoot'
import {
  destroySFCPreviewRuntime,
  launchSFCPreview,
  sfcPreviewInput,
  sfcPreviewRuntime,
} from '@/features/endge-ide/model/sfc-preview/sfc-preview-state'

const IDENTITY = 'schedule-sandbox'

onMounted(async () => {
  const component = Endge.domain.getComponentSFC(IDENTITY)
  if (!component) {
    throw new Error(`Component "${IDENTITY}" is missing.`)
  }

  await launchSFCPreview(component)
})

onBeforeUnmount(() => destroySFCPreviewRuntime())
</script>

<template>
  <main class="h-screen min-h-0 w-screen overflow-hidden">
    <EndgeAdapterRoot
      v-if="sfcPreviewRuntime"
      root-key="sfc-runtime"
      :host="sfcPreviewRuntime"
      :input="sfcPreviewInput"
    />
  </main>
</template>
