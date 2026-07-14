<script setup lang="ts">
import type * as Monaco from 'monaco-editor'

import { Endge } from '@endge/core'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { useEndgeSourceMonaco } from '@/features/endge-ide/tools/source-editor/use-endge-source-monaco'
import SourceJsonTree from '@/features/endge-ide/ui/components/SourceJsonTree.vue'
import SourceJsonTreeControls from '@/features/endge-ide/ui/components/SourceJsonTreeControls.vue'
import SourceOutputPanel from '@/features/endge-ide/ui/components/SourceOutputPanel.vue'

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
}>()

const container = ref<HTMLDivElement | null>(null)
const inlinePreview = ref<{ data: unknown } | null>(null)
const inlinePreviewCollapsed = ref(false)
const inlinePreviewTree = ref<SourceJsonTreeHandle | null>(null)
const source = computed({
  get: () => props.modelValue ?? '',
  set: value => emit('update:modelValue', value),
})

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
const diagnosticsCount = monacoAdapter.diagnosticsCount

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

onBeforeUnmount(() => {
  if (previewTimer) {
    clearTimeout(previewTimer)
  }
  editor = null
})
</script>

<template>
  <div class="data-view-source-editor">
    <div v-if="diagnosticsCount" class="data-view-source-editor__diagnostics">
      {{ diagnosticsCount }} diagnostics
    </div>

    <div class="data-view-source-editor__body">
      <div ref="container" class="data-view-source-editor__monaco" />

      <SourceOutputPanel
        v-if="inlinePreview"
        v-model:collapsed="inlinePreviewCollapsed"
        title="output.json"
        collapse-label="Свернуть output.json"
        expand-label="Показать output.json"
        mode="full-height"
      >
        <template #actions>
          <SourceJsonTreeControls
            :copy-value="inlinePreview.data"
            @expand-all="inlinePreviewTree?.expandAll()"
            @collapse-all="inlinePreviewTree?.collapseAll()"
          />
        </template>

        <SourceJsonTree ref="inlinePreviewTree" :data="inlinePreview.data" root-path="output" />
      </SourceOutputPanel>
    </div>
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

.data-view-source-editor__diagnostics {
  padding: 6px 10px;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--muted) / 0.45);
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.data-view-source-editor__monaco {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  width: 100%;
  background: #1e1e1e;
}

.data-view-source-editor__body {
  position: relative;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: #1e1e1e;
}
</style>
