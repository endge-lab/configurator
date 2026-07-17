<script setup lang="ts">
import type * as Monaco from 'monaco-editor'

import { Endge } from '@endge/core'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { formatSource } from '@/features/endge-ide/tools/format-source'
import { useEndgeSourceMonaco } from '@/features/endge-ide/tools/source-editor/use-endge-source-monaco'
import SourceEditorSplitView from '@/features/endge-ide/ui/components/source-document-editor/SourceEditorSplitView.vue'
import SourceJsonTree from '@/features/endge-ide/ui/components/SourceJsonTree.vue'

interface SourceJsonTreeHandle {
  expandAll: () => void
  collapseAll: () => void
}

const props = defineProps<{
  modelValue: string
  previewInput?: string
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
  (event: 'outputState', value: { available: boolean, collapsed: boolean, data: unknown }): void
}>()

const container = ref<HTMLDivElement | null>(null)
const inlinePreview = ref<{ data: unknown } | null>(null)
const inlinePreviewCollapsed = ref(false)
const inlinePreviewTree = ref<SourceJsonTreeHandle | null>(null)
const splitRatio = ref(0.7)
const source = computed({
  get: () => props.modelValue ?? '',
  set: value => emit('update:modelValue', value),
})
const outputVisible = computed(() => inlinePreview.value !== null && !inlinePreviewCollapsed.value)

let editor: Monaco.editor.IStandaloneCodeEditor | null = null
let previewTimer: ReturnType<typeof setTimeout> | null = null
const monacoAdapter = useEndgeSourceMonaco({
  container,
  sourceKind: 'data-view',
  value: () => source.value,
  onChange: (value) => {
    source.value = value
    scheduleInlinePreview()
  },
  owner: 'endge-data-view-source',
  onReady: (instance) => {
    editor = instance
    scheduleInlinePreview()
  },
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

async function formatDocument(): Promise<void> {
  const formatted = await formatSource(editor?.getValue() ?? source.value, 'typescript')
  source.value = formatted
  monacoAdapter.setValue(formatted)
}

defineExpose({ expandOutput, collapseOutput, toggleOutput, formatDocument })

/** Планирует live-preview после остановки ввода, чтобы не выполнять transform на каждый символ. */
function scheduleInlinePreview(): void {
  if (previewTimer) {
    clearTimeout(previewTimer)
  }

  previewTimer = setTimeout(() => {
    updateInlinePreview()
  }, 240)
}

/** Выполняет DataView source на preview input и показывает output только при полностью успешном результате. */
function updateInlinePreview(): void {
  const inputSource = props.previewInput?.trim()
  if (!inputSource) {
    inlinePreview.value = null
    return
  }

  try {
    const input = JSON.parse(inputSource)
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      inlinePreview.value = null
      return
    }

    const output = Endge.runtime.dataView.runSource(editor?.getValue() ?? source.value, input as Record<string, unknown>)
    inlinePreview.value = { data: output }
  }
  catch {
    inlinePreview.value = null
  }
}

watch(
  () => props.modelValue,
  (value) => {
    monacoAdapter.setValue(value)
    scheduleInlinePreview()
  },
)

watch(
  () => props.previewInput,
  () => scheduleInlinePreview(),
)

watch(
  [inlinePreview, inlinePreviewCollapsed],
  ([preview, collapsed]) => {
    emit('outputState', {
      available: preview !== null,
      collapsed,
      data: preview?.data,
    })
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (previewTimer) {
    clearTimeout(previewTimer)
  }
  editor = null
})
</script>

<template>
  <div class="data-view-source-editor">
    <SourceEditorSplitView v-model:ratio="splitRatio" :output-visible="outputVisible">
      <template #editor>
        <div ref="container" class="data-view-source-editor__monaco" />
      </template>
      <template #output>
        <SourceJsonTree ref="inlinePreviewTree" :data="inlinePreview?.data" root-path="output" />
      </template>
    </SourceEditorSplitView>
  </div>
</template>

<style scoped>
.data-view-source-editor {
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: hsl(var(--background));
}

.data-view-source-editor__monaco {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  width: 100%;
  background: #1e1e1e;
}
</style>
