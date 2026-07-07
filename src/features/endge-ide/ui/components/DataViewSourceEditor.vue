<script setup lang="ts">
import type * as Monaco from 'monaco-editor'

import { Endge } from '@endge/core'
import * as monaco from 'monaco-editor'
import { ChevronDown, ChevronUp, FileJson, RotateCcw } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { registerDataViewSourceLanguage } from '@/features/endge-ide/tools/source-editor/register-data-view-source-language'

const props = defineProps<{
  modelValue: string
  previewInput?: string
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

const container = ref<HTMLDivElement | null>(null)
const diagnosticsCount = ref(0)
const inlinePreviewOutput = ref<string | null>(null)
const inlinePreviewCollapsed = ref(false)
const source = computed({
  get: () => props.modelValue ?? '',
  set: value => emit('update:modelValue', value),
})

let editor: Monaco.editor.IStandaloneCodeEditor | null = null
let previewTimer: ReturnType<typeof setTimeout> | null = null

/** Сбрасывает source к базовому шаблону RDataView v1. */
function resetToDefaultSource(): void {
  source.value = Endge.source.createDefault('data-view')
  scheduleInlinePreview()
}

/** Обновляет Monaco markers по diagnostics source language strategy. */
function updateMarkers(): void {
  const model = editor?.getModel()
  if (!model)
    return

  const validation = Endge.source.validate('data-view', model.getValue())
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
    'endge-data-view-source',
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
  const normalizedStart = startOffset == null ? null : Math.max(0, Math.min(startOffset, modelLength))
  const normalizedEnd = normalizedStart == null ? null : Math.max(normalizedStart, Math.min(endOffset ?? normalizedStart + 1, modelLength))
  const range = normalizedStart == null || normalizedEnd == null
    ? fallbackRange
    : offsetRangeToMarkerRange(model, normalizedStart, normalizedEnd)

  return {
    severity: diagnostic.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
    message: diagnostic.message ?? diagnostic.code ?? 'DataView source diagnostic',
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
  if (startPosition.lineNumber === endPosition.lineNumber && startPosition.column === endPosition.column) {
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

/** Планирует live-preview после остановки ввода, чтобы не выполнять transform на каждый символ. */
function scheduleInlinePreview(): void {
  if (previewTimer)
    clearTimeout(previewTimer)

  previewTimer = setTimeout(() => {
    updateInlinePreview()
  }, 240)
}

/** Выполняет DataView source на preview input и показывает output только при полностью успешном результате. */
function updateInlinePreview(): void {
  const inputSource = props.previewInput?.trim()
  if (!inputSource) {
    inlinePreviewOutput.value = null
    return
  }

  try {
    const input = JSON.parse(inputSource)
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      inlinePreviewOutput.value = null
      return
    }

    const output = Endge.dataView.runSource(editor?.getValue() ?? source.value, input as Record<string, unknown>)
    inlinePreviewOutput.value = JSON.stringify(output, null, 2) ?? 'undefined'
  }
  catch {
    inlinePreviewOutput.value = null
  }
}

onMounted(() => {
  const languageId = registerDataViewSourceLanguage(monaco)
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
    scrollBeyondLastLine: true,
    padding: { bottom: 10 },
    wordWrap: 'on',
    formatOnPaste: true,
    formatOnType: true,
  })

  editor.onDidChangeModelContent(() => {
    source.value = editor?.getValue() ?? ''
    updateMarkers()
    scheduleInlinePreview()
  })

  updateMarkers()
  scheduleInlinePreview()
})

watch(
  () => props.modelValue,
  value => {
    if (editor && editor.getValue() !== value) {
      editor.setValue(value)
      updateMarkers()
      scheduleInlinePreview()
    }
  },
)

watch(
  () => props.previewInput,
  () => scheduleInlinePreview(),
)

onBeforeUnmount(() => {
  if (previewTimer)
    clearTimeout(previewTimer)
  const model = editor?.getModel()
  if (model)
    monaco.editor.setModelMarkers(model, 'endge-data-view-source', [])
  editor?.dispose()
  editor = null
})
</script>

<template>
  <div class="data-view-source-editor">
    <div class="data-view-source-editor__toolbar">
      <div class="data-view-source-editor__title">
        <Label class="font-semibold">DataView source</Label>
        <span v-if="diagnosticsCount" class="data-view-source-editor__diagnostics">
          {{ diagnosticsCount }} diagnostics
        </span>
      </div>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              type="button"
              variant="outline"
              size="icon"
              class="h-8 w-8 shrink-0"
              aria-label="Сбросить source"
              @click="resetToDefaultSource"
            >
              <RotateCcw class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Сбросить source</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>

    <div class="data-view-source-editor__body">
      <div ref="container" class="data-view-source-editor__monaco" />

      <Button
        v-if="inlinePreviewOutput && inlinePreviewCollapsed"
        type="button"
        variant="outline"
        size="sm"
        class="data-view-source-editor__preview-collapsed"
        title="Показать output.json"
        @click="inlinePreviewCollapsed = false"
      >
        <FileJson class="size-4" />
        output.json
        <ChevronDown class="size-4" />
      </Button>

      <div
        v-else-if="inlinePreviewOutput"
        class="data-view-source-editor__preview-popover"
      >
        <div class="data-view-source-editor__preview-title">
          <span>output.json</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            class="data-view-source-editor__preview-toggle"
            aria-label="Свернуть output.json"
            title="Свернуть output.json"
            @click="inlinePreviewCollapsed = true"
          >
            <ChevronUp class="size-4" />
          </Button>
        </div>
        <pre class="data-view-source-editor__preview-content">{{ inlinePreviewOutput }}</pre>
      </div>
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

.data-view-source-editor__toolbar {
  min-height: 44px;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--muted) / 0.45);
}

.data-view-source-editor__title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.data-view-source-editor__diagnostics {
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
  border-top: 1px solid hsl(var(--border));
  overflow: hidden;
  background: #1e1e1e;
}

.data-view-source-editor__preview-popover {
  position: absolute;
  top: 12px;
  right: 18px;
  z-index: 5;
  width: min(420px, calc(100% - 36px));
  max-height: min(52%, 420px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgb(71 85 105 / 0.75);
  border-radius: 8px;
  background: rgb(15 23 42 / 0.94);
  color: #e5e7eb;
  box-shadow: 0 18px 40px rgb(0 0 0 / 0.38);
}

.data-view-source-editor__preview-collapsed {
  position: absolute;
  top: 12px;
  right: 18px;
  z-index: 5;
  gap: 7px;
  border-color: rgb(71 85 105 / 0.75);
  background: rgb(15 23 42 / 0.94);
  color: #bfdbfe;
  box-shadow: 0 12px 28px rgb(0 0 0 / 0.28);
}

.data-view-source-editor__preview-collapsed:hover {
  background: rgb(30 41 59 / 0.96);
  color: #dbeafe;
}

.data-view-source-editor__preview-title {
  flex: 0 0 auto;
  min-height: 37px;
  padding: 5px 6px 5px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-bottom: 1px solid rgb(71 85 105 / 0.75);
  color: #93c5fd;
  font-size: 12px;
  font-weight: 600;
}

.data-view-source-editor__preview-toggle {
  width: 26px;
  height: 26px;
  color: #bfdbfe;
}

.data-view-source-editor__preview-toggle:hover {
  background: rgb(51 65 85 / 0.8);
  color: #dbeafe;
}

.data-view-source-editor__preview-content {
  min-height: 0;
  margin: 0;
  padding: 10px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.45;
  white-space: pre;
}
</style>
