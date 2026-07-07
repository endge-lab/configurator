<script setup lang="ts">
import type * as Monaco from 'monaco-editor'

import { Endge } from '@endge/core'
import * as monaco from 'monaco-editor'
import { RotateCcw } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { registerQuerySourceLanguage } from '@/features/endge-ide/tools/source-editor/register-query-source-language'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

const container = ref<HTMLDivElement | null>(null)
const diagnosticsCount = ref(0)
const source = computed({
  get: () => props.modelValue ?? '',
  set: value => emit('update:modelValue', value),
})

let editor: Monaco.editor.IStandaloneCodeEditor | null = null

/** Сбрасывает source к базовому шаблону RQuery v1. */
function resetToDefaultSource(): void {
  source.value = Endge.source.createDefault('query')
}

/** Обновляет Monaco markers по diagnostics source language strategy. */
function updateMarkers(): void {
  const model = editor?.getModel()
  if (!model)
    return

  const validation = Endge.source.validate('query', model.getValue())
  const diagnostics = validation.diagnostics as Array<{
    severity?: string
    message?: string
    code?: string
    start?: number
    end?: number
  }>
  diagnosticsCount.value = diagnostics.length

  monaco.editor.setModelMarkers(
    model,
    'endge-query-source',
    diagnostics.map(diagnostic => toEditorMarker(model, diagnostic)),
  )
}

/** Конвертирует compiler diagnostic offset в Monaco marker. */
function toEditorMarker(
  model: Monaco.editor.ITextModel,
  diagnostic: {
    severity?: string
    message?: string
    code?: string
    start?: number
    end?: number
  },
): Monaco.editor.IMarkerData {
  const fallbackRange = {
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: 1,
    endColumn: Math.max(2, model.getLineMaxColumn(1)),
  }

  const startOffset = typeof diagnostic.start === 'number' ? diagnostic.start : null
  const endOffset = typeof diagnostic.end === 'number' ? diagnostic.end : null
  const modelLength = model.getValueLength()
  const normalizedStart = startOffset == null
    ? null
    : Math.max(0, Math.min(startOffset, modelLength))
  const normalizedEnd = normalizedStart == null
    ? null
    : Math.max(normalizedStart, Math.min(endOffset ?? normalizedStart + 1, modelLength))
  const range = normalizedStart == null || normalizedEnd == null
    ? fallbackRange
    : offsetRangeToMarkerRange(model, normalizedStart, normalizedEnd)

  return {
    severity: diagnostic.severity === 'error'
      ? monaco.MarkerSeverity.Error
      : monaco.MarkerSeverity.Warning,
    message: diagnostic.message ?? diagnostic.code ?? 'Query source diagnostic',
    ...range,
  }
}

/** Строит непустой Monaco range из абсолютных offsets. */
function offsetRangeToMarkerRange(
  model: Monaco.editor.ITextModel,
  startOffset: number,
  endOffset: number,
): Pick<Monaco.editor.IMarkerData, 'startLineNumber' | 'startColumn' | 'endLineNumber' | 'endColumn'> {
  const startPosition = model.getPositionAt(startOffset)
  const endPosition = model.getPositionAt(endOffset)

  if (
    startPosition.lineNumber === endPosition.lineNumber
    && startPosition.column === endPosition.column
  ) {
    return {
      startLineNumber: startPosition.lineNumber,
      startColumn: startPosition.column,
      endLineNumber: endPosition.lineNumber,
      endColumn: endPosition.column + 1,
    }
  }

  return {
    startLineNumber: startPosition.lineNumber,
    startColumn: startPosition.column,
    endLineNumber: endPosition.lineNumber,
    endColumn: endPosition.column,
  }
}

onMounted(() => {
  const languageId = registerQuerySourceLanguage(monaco)
  if (!container.value)
    return

  editor = monaco.editor.create(container.value, {
    value: source.value,
    language: languageId,
    theme: 'vs-dark',
    minimap: { enabled: false },
    automaticLayout: true,
    fontSize: 14,
    tabSize: 2,
    insertSpaces: true,
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    formatOnPaste: true,
    formatOnType: true,
    suggest: {
      showMethods: true,
      showFunctions: true,
      showProperties: true,
      showSnippets: true,
    },
  })

  editor.onDidChangeModelContent(() => {
    source.value = editor?.getValue() ?? ''
    updateMarkers()
  })

  updateMarkers()
})

watch(
  () => props.modelValue,
  value => {
    if (editor && editor.getValue() !== value) {
      editor.setValue(value)
      updateMarkers()
    }
  },
)

onBeforeUnmount(() => {
  const model = editor?.getModel()
  if (model)
    monaco.editor.setModelMarkers(model, 'endge-query-source', [])

  editor?.dispose()
  editor = null
})
</script>

<template>
  <div class="query-source-editor">
    <div class="query-source-editor__toolbar">
      <div class="query-source-editor__title">
        <Label class="font-semibold">Query source</Label>
        <span
          v-if="diagnosticsCount"
          class="query-source-editor__diagnostics"
        >
          {{ diagnosticsCount }} diagnostics
        </span>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        class="gap-2"
        @click="resetToDefaultSource"
      >
        <RotateCcw class="size-4" />
        Сбросить
      </Button>
    </div>

    <div ref="container" class="query-source-editor__monaco" />
  </div>
</template>

<style scoped>
.query-source-editor {
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: hsl(var(--background));
}

.query-source-editor__toolbar {
  min-height: 44px;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--muted) / 0.45);
}

.query-source-editor__title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.query-source-editor__diagnostics {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.query-source-editor__monaco {
  flex: 1;
  min-height: 0;
  width: 100%;
  border-top: 1px solid hsl(var(--border));
  background: #1e1e1e;
}
</style>
