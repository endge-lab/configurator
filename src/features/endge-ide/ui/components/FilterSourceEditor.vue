<script setup lang="ts">
import type { FilterProgramPayload } from '@endge/core'

import { Endge, evaluateSourceExpression } from '@endge/core'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useEndgeSourceMonaco } from '@/features/endge-ide/tools/source-editor/use-endge-source-monaco'
import SourceEditorSplitView from '@/features/endge-ide/ui/components/source-document-editor/SourceEditorSplitView.vue'
import SourceJsonTree from '@/features/endge-ide/ui/components/SourceJsonTree.vue'

interface SourceJsonTreeHandle {
  expandAll: () => void
  collapseAll: () => void
}

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
  (event: 'outputState', value: { available: boolean, collapsed: boolean, data: unknown }): void
}>()
const container = ref<HTMLDivElement | null>(null)
const source = ref(props.modelValue ?? '')
const inlinePreviewOutput = ref<Record<string, unknown> | null>(null)
const inlinePreviewCollapsed = ref(false)
const inlinePreviewTree = ref<SourceJsonTreeHandle | null>(null)
const splitRatio = ref(0.7)
const outputVisible = computed(() => inlinePreviewOutput.value !== null && !inlinePreviewCollapsed.value)
let previewTimer: ReturnType<typeof setTimeout> | null = null

const monaco = useEndgeSourceMonaco({
  container,
  sourceKind: 'filter',
  value: () => source.value,
  onChange: (value) => {
    source.value = value
    emit('update:modelValue', value)
    scheduleInlinePreview()
  },
})
watch(() => props.modelValue, (value) => {
  source.value = value ?? ''
  monaco.setValue(source.value)
  scheduleInlinePreview()
})

onMounted(() => {
  monaco.setValue(source.value)
  scheduleInlinePreview()
})

onBeforeUnmount(() => {
  if (previewTimer) {
    clearTimeout(previewTimer)
  }
})

function expandOutput(): void {
  inlinePreviewTree.value?.expandAll()
}

function collapseOutput(): void {
  inlinePreviewTree.value?.collapseAll()
}

function toggleOutput(): void {
  inlinePreviewCollapsed.value = !inlinePreviewCollapsed.value
}

defineExpose({ expandOutput, collapseOutput, toggleOutput })

/** Обновляет preview после паузы ввода, не компилируя Filter на каждый символ. */
function scheduleInlinePreview(): void {
  if (previewTimer) {
    clearTimeout(previewTimer)
  }

  previewTimer = setTimeout(() => {
    updateInlinePreview()
  }, 240)
}

/** Формирует единый JSON всех Filter outputs на state, полученном из defaults. */
function updateInlinePreview(): void {
  const compiled = Endge.source.compile('filter', source.value)
  const artifact = compiled.ok && isFilterArtifact(compiled.artifact)
    ? compiled.artifact
    : null
  if (!artifact) {
    inlinePreviewOutput.value = null
    return
  }

  try {
    const state = Object.fromEntries(artifact.fields.map(field => [
      field.key,
      field.defaultValue
        ? evaluateSourceExpression(field.defaultValue)
        : undefined,
    ]))
    const outputs = Object.fromEntries(artifact.outputs.map((output) => {
      if (output.kind === 'json') {
        const value = evaluateSourceExpression(output.expression, { values: state })
        return [output.key, value ?? null]
      }

      // Predicate зависит от row, которого у preview Filter нет.
      return [output.key, null]
    }))
    inlinePreviewOutput.value = outputs
  }
  catch {
    inlinePreviewOutput.value = null
  }
}

function isFilterArtifact(value: unknown): value is FilterProgramPayload {
  return Boolean(value) && typeof value === 'object' && (value as { type?: unknown }).type === 'filter'
}

watch(
  [inlinePreviewOutput, inlinePreviewCollapsed],
  ([preview, collapsed]) => {
    emit('outputState', {
      available: preview !== null,
      collapsed,
      data: preview,
    })
  },
  { immediate: true },
)
</script>

<template>
  <div class="filter-source-editor">
    <SourceEditorSplitView v-model:ratio="splitRatio" :output-visible="outputVisible">
      <template #editor>
        <div ref="container" class="filter-source-editor__monaco" />
      </template>
      <template #output>
        <SourceJsonTree ref="inlinePreviewTree" :data="inlinePreviewOutput" root-path="outputs" />
      </template>
    </SourceEditorSplitView>
  </div>
</template>

<style scoped>
.filter-source-editor {
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--editor-surface);
}

.filter-source-editor__monaco {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  width: 100%;
  background: var(--editor-surface);
}
</style>
