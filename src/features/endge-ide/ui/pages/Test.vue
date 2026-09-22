<script setup lang="ts">
import { Endge } from '@endge/core'
import { onBeforeUnmount, onMounted } from 'vue'

import { SFCPreviewSession } from '@/features/endge-ide/services/sfc-preview/sfc-preview-state'
import EndgeAdapterRoot from '@/features/endge-ide/ui/runtime/EndgeAdapterRoot'

const IDENTITY = 'schedule-sandbox'
const preview = new SFCPreviewSession()
const { input: previewInput, runtime: previewRuntime } = preview

onMounted(async () => {
  const component = Endge.domain.getComponentSFC(IDENTITY)
  if (!component) {
    throw new Error(`Component "${IDENTITY}" is missing.`)
  }

  await preview.launch(component)
})

onBeforeUnmount(() => preview.dispose())
</script>

<template>
  <main class="h-screen min-h-0 w-screen overflow-hidden">
    <EndgeAdapterRoot
      v-if="previewRuntime"
      root-key="sfc-runtime"
      :host="previewRuntime"
      :input="previewInput"
    />
  </main>
</template>
