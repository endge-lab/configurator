<script setup lang="ts">
import { Endge } from '@endge/core'
import { ref, watch } from 'vue'
import { useEndgeSourceMonaco } from '@/features/endge-ide/tools/source-editor/use-endge-source-monaco'

const props = defineProps<{ modelValue: string, readOnly?: boolean }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>()
const container = ref<HTMLDivElement | null>(null)
const source = ref(props.modelValue ?? '')
const monaco = useEndgeSourceMonaco({
  container,
  sourceKind: 'action',
  value: () => source.value,
  onChange: (value) => {
    if (props.readOnly) {
      return
    }
    source.value = value
    emit('update:modelValue', value)
  },
  owner: 'endge-action-source',
  readOnly: props.readOnly,
  languageContext: () => ({
    documentSymbols: [
      ...Endge.actions.listResolved().map(item => ({
        target: 'action' as const,
        identity: item.identity,
        displayName: item.displayName,
        description: item.description,
      })),
      ...Endge.domain.getQueries().map(item => documentSymbol('query', item)),
      ...Endge.domain.getUpdates().map(item => documentSymbol('update', item)),
      ...Endge.domain.getComputations().map(item => documentSymbol('computation', item)),
      ...Endge.domain.getDataViews().map(item => documentSymbol('data-view', item)),
      ...Endge.domain.getConverters().map(item => documentSymbol('converter', item)),
    ],
  }),
})
watch(() => props.modelValue, (value) => {
  source.value = value ?? ''
  monaco.setValue(source.value)
})
defineExpose({ formatDocument: monaco.formatDocument })

function documentSymbol(target: 'query' | 'update' | 'computation' | 'data-view' | 'converter', item: any) {
  return {
    target,
    identity: item.identity,
    displayName: item.displayName || item.name || item.identity,
    description: item.description ?? null,
  }
}
</script>

<template>
  <div ref="container" class="h-full min-h-0 w-full bg-editor-surface" />
</template>
