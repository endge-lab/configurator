<script setup lang="ts">
import type { StoreRuntimeHost } from '@endge/core'

import { Raph } from '@endge/raph'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import StoreFieldsPreview from './StoreFieldsPreview.vue'

const props = defineProps<{
  runtime: StoreRuntimeHost
}>()

const revision = ref(0)
let disposeWatch: VoidFunction | null = null

watch(
  () => props.runtime,
  (runtime) => {
    disposeWatch?.()
    revision.value += 1
    const path = runtime.getDataPath()
    disposeWatch = Raph.watch([path, `${path}.*`], () => {
      revision.value += 1
    })
  },
  { immediate: true },
)

onBeforeUnmount(() => disposeWatch?.())

const fields = computed(() => {
  void revision.value
  const snapshot = props.runtime.getDataSnapshot()
  return props.runtime.getFields().map(field => ({
    key: field.key,
    kind: field.kind,
    value: snapshot[field.key],
  }))
})
</script>

<template>
  <StoreFieldsPreview :fields="fields" />
</template>
