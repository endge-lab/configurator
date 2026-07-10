<script setup lang="ts">
import { Endge } from '@endge/core'
import { RotateCcw } from 'lucide-vue-next'
import { ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
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
})
const diagnosticsCount = monaco.diagnosticsCount

watch(() => props.modelValue, (value) => {
  source.value = value ?? ''
  monaco.setValue(source.value)
})

function reset(): void {
  const value = Endge.source.createDefault('composition')
  source.value = value
  emit('update:modelValue', value)
  monaco.setValue(value)
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="flex h-11 shrink-0 items-center justify-between border-b bg-muted/40 px-3">
      <span class="text-sm font-medium">Composition source · {{ diagnosticsCount }} diagnostics</span>
      <Button variant="outline" size="icon" class="h-8 w-8" title="Сбросить source" @click="reset">
        <RotateCcw class="size-4" />
      </Button>
    </div>
    <div ref="container" class="min-h-0 flex-1" />
  </div>
</template>
