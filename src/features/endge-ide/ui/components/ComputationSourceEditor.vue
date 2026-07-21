<script setup lang="ts">
import { ref, watch } from 'vue'

import { useEndgeSourceMonaco } from '@/features/endge-ide/tools/source-editor/use-endge-source-monaco'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>()
const container = ref<HTMLDivElement | null>(null)
const source = ref(props.modelValue ?? '')
const monaco = useEndgeSourceMonaco({
  container,
  sourceKind: 'computation',
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

defineExpose({ formatDocument: monaco.formatDocument })
</script>

<template>
  <div ref="container" class="h-full min-h-0 flex-1" />
</template>
