<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useEndgeSourceMonaco } from '@/features/endge-ide/tools/source-editor/use-endge-source-monaco'

const props = defineProps<{ modelValue: string, identity?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const container = ref<HTMLDivElement | null>(null)
const source = computed({ get: () => props.modelValue, set: value => emit('update:modelValue', value) })
const monaco = useEndgeSourceMonaco({
  container,
  sourceKind: 'configuration',
  value: () => source.value,
  onChange: (value) => { source.value = value },
  owner: 'endge-configuration-source',
  ownerIdentity: () => props.identity,
})
watch(() => props.modelValue, value => monaco.setValue(value))
defineExpose({ formatDocument: monaco.formatDocument })
</script>

<template>
  <div ref="container" class="h-full min-h-[280px] w-full bg-editor-surface" />
</template>
