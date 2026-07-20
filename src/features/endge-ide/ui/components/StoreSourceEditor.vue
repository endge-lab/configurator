<script setup lang="ts">
import type { StoreRuntimeHost } from '@endge/core'

import { ref, watch } from 'vue'

import { useEndgeSourceMonaco } from '@/features/endge-ide/tools/source-editor/use-endge-source-monaco'
import StoreRuntimePreview from '@/features/endge-ide/ui/components/StoreRuntimePreview.vue'

const props = defineProps<{
  modelValue: string
  runtime?: StoreRuntimeHost | null
}>()
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>()
const container = ref<HTMLDivElement | null>(null)
const source = ref(props.modelValue ?? '')
const monaco = useEndgeSourceMonaco({
  container,
  sourceKind: 'store',
  value: () => source.value,
  onChange: (value) => {
    source.value = value
    emit('update:modelValue', value)
  },
})
watch(() => props.modelValue, (value) => {
  source.value = value ?? ''
  monaco.setValue(source.value)
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="relative flex min-h-0 flex-1 overflow-hidden bg-editor-surface">
      <div ref="container" class="min-h-0 flex-1" />
      <StoreRuntimePreview :runtime="runtime ?? null" />
    </div>
  </div>
</template>
