<script setup lang="ts">
import { ref, watch } from 'vue'

import { createCompositionRuntimePropsContribution } from '@/features/endge-ide/source-editor/contributions/composition/runtime-props/composition-runtime-props.contribution'
import { useEndgeSourceMonaco } from '@/features/endge-ide/tools/source-editor/use-endge-source-monaco'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>()
const container = ref<HTMLDivElement | null>(null)
const source = ref(props.modelValue ?? '')
const monaco = useEndgeSourceMonaco({
  container,
  sourceKind: 'composition',
  value: () => source.value,
  onChange: (value) => {
    source.value = value
    emit('update:modelValue', value)
  },
  extensions: [createCompositionRuntimePropsContribution()],
})
watch(() => props.modelValue, (value) => {
  source.value = value ?? ''
  monaco.setValue(source.value)
})

defineExpose({ formatDocument: monaco.formatDocument })
</script>

<template>
  <div ref="container" class="h-full min-h-0 flex-1" />
</template>

<style scoped>
:deep(.endge-source-inline-action) {
  margin-left: 12px;
  color: #8790a8 !important;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer !important;
  user-select: none;
  transition: color 120ms ease;
}

:deep(.endge-source-inline-action:hover) {
  color: #c792ea !important;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}
</style>
