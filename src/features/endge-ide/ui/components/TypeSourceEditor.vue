<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useEndgeSourceMonaco } from '@/features/endge-ide/tools/source-editor/use-endge-source-monaco'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

const container = ref<HTMLDivElement | null>(null)
const source = computed({
  get: () => props.modelValue ?? '',
  set: value => emit('update:modelValue', value),
})

const monacoAdapter = useEndgeSourceMonaco({
  container,
  sourceKind: 'type',
  value: () => source.value,
  onChange: (value) => { source.value = value },
  owner: 'endge-type-source',
})

watch(
  () => props.modelValue,
  value => monacoAdapter.setValue(value),
)
</script>

<template>
  <div class="type-source-editor">
    <div ref="container" class="type-source-editor__monaco" />
  </div>
</template>

<style scoped>
.type-source-editor {
  display: flex;
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: var(--editor-surface);
}

.type-source-editor__monaco {
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  min-height: 280px;
  background: var(--editor-surface);
}
</style>
