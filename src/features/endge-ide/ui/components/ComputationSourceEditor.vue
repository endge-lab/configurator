<script setup lang="ts">
import type * as Monaco from 'monaco-editor'

import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { runComputationSourcePreview } from '@/features/endge-ide/model/computation-preview/computation-source-preview'
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
  previewIdentity?: string
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
let previewRevision = 0
const monacoAdapter = useEndgeSourceMonaco({
  container,
  sourceKind: 'computation',
  value: () => source.value,
  onChange: (value) => {
    source.value = value
    scheduleInlinePreview()
  },
  owner: 'endge-computation-source',
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

defineExpose({
  expandOutput,
  collapseOutput,
  toggleOutput,
  formatDocument: monacoAdapter.formatDocument,
})

/** Планирует live-preview после остановки ввода. */
function scheduleInlinePreview(): void {
  if (previewTimer) {
    clearTimeout(previewTimer)
  }

  previewTimer = setTimeout(() => {
    void updateInlinePreview()
  }, 240)
}

/** Выполняет несохранённый Computation source без публикации transient artifact. */
async function updateInlinePreview(): Promise<void> {
  const revision = ++previewRevision
  const inputSource = props.previewInput?.trim()
  if (!inputSource) {
    inlinePreview.value = null
    return
  }

  try {
    const output = await runComputationSourcePreview(
      editor?.getValue() ?? source.value,
      inputSource,
      props.previewIdentity?.trim() || 'computation-editor-preview',
    )
    if (revision === previewRevision) {
      inlinePreview.value = { data: output === undefined ? null : output }
    }
  }
  catch {
    if (revision === previewRevision) {
      inlinePreview.value = null
    }
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
  previewRevision += 1
  if (previewTimer) {
    clearTimeout(previewTimer)
  }
  editor = null
})
</script>

<template>
  <div class="computation-source-editor">
    <SourceEditorSplitView v-model:ratio="splitRatio" :output-visible="outputVisible">
      <template #editor>
        <div ref="container" class="computation-source-editor__monaco" />
      </template>
      <template #output>
        <SourceJsonTree ref="inlinePreviewTree" :data="inlinePreview?.data" root-path="output" />
      </template>
    </SourceEditorSplitView>
  </div>
</template>

<style scoped>
.computation-source-editor {
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--editor-surface);
}

.computation-source-editor__monaco {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  width: 100%;
  background: var(--editor-surface);
}
</style>
