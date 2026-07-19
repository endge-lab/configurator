<script setup lang="ts">
import type { ComponentSFCRuntimeHost, CompositionSession } from '@endge/core'

import { Endge } from '@endge/core'
import { SFC_RuntimeRenderer } from '@endge/ui-vue'
import { onBeforeUnmount, onMounted, shallowRef } from 'vue'

import { ensureCompositionRuntimeArtifacts } from '@/features/endge-ide/model/composition-preview/composition-preview-state'

const IDENTITY = 'groundhandling-control-page'
const table = shallowRef<ComponentSFCRuntimeHost>()
let session: CompositionSession | undefined

onMounted(async () => {
  await Endge.build()
  const composition = Endge.domain.getComposition(IDENTITY)
  if (!composition) {
    throw new Error(`Composition "${IDENTITY}" is missing.`)
  }

  ensureCompositionRuntimeArtifacts(composition.source, new Set([IDENTITY]))
  Endge.compiler.buildComposition(composition)
  session = await Endge.runtime.composition.mount(IDENTITY)
  table.value = session.host.getChild('table') as ComponentSFCRuntimeHost
})

onBeforeUnmount(() => session?.unmount())
</script>

<template>
  <main class="h-screen min-h-0 w-screen overflow-hidden">
    <SFC_RuntimeRenderer
      v-if="table"
      :host="table"
      :input="table.getInputSource() ?? { kind: 'local', props: {} }"
    />
  </main>
</template>

<style scoped>
main :deep(.endge-sfc-table) {
  height: 100% !important;
  min-height: 0;
}
</style>
