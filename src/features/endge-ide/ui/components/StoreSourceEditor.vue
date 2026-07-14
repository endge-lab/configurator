<script setup lang="ts">
import type { StoreRuntimeHost } from '@endge/core'

import { Endge } from '@endge/core'
import { RotateCcw } from 'lucide-vue-next'
import { ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { useEndgeSourceMonaco } from '@/features/endge-ide/tools/source-editor/use-endge-source-monaco'
import StoreRuntimeInspector from '@/features/endge-ide/ui/components/StoreRuntimeInspector.vue'

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
const diagnosticsCount = monaco.diagnosticsCount

watch(() => props.modelValue, (value) => {
  source.value = value ?? ''
  monaco.setValue(source.value)
})

function reset(): void {
  const value = Endge.source.createDefault('store')
  source.value = value
  emit('update:modelValue', value)
  monaco.setValue(value)
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="flex h-11 shrink-0 items-center justify-between border-b bg-muted/40 px-3">
      <span class="text-sm font-medium">Store source · {{ diagnosticsCount }} diagnostics</span>
      <Button variant="outline" size="icon" class="h-8 w-8" title="Сбросить source" @click="reset">
        <RotateCcw class="size-4" />
      </Button>
    </div>
    <div class="relative flex min-h-0 flex-1 overflow-hidden bg-[#1e1e1e]">
      <div ref="container" class="min-h-0 flex-1" />
      <StoreRuntimeInspector :runtime="runtime ?? null" />
    </div>
  </div>
</template>
