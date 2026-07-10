<script setup lang="ts">
import type * as Monaco from 'monaco-editor'

import { DomainSectionType, Endge } from '@endge/core'
import { RotateCcw } from 'lucide-vue-next'
import * as monaco from 'monaco-editor'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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
const DOMAIN_ENTITY_MIME = 'application/x-endge-domain-entity'

interface DomainDragPayloadItem {
  id?: string | number
  identity?: string
  sectionType?: string
  docType?: string
}

/** Сбрасывает source к базовому шаблону RQuery v1. */
function resetToDefaultSource(): void {
  source.value = Endge.source.createDefault('query')
}

function parseDomainDragPayload(event: DragEvent): DomainDragPayloadItem[] {
  let raw: string | null = null
  if (event.dataTransfer?.types.includes(DOMAIN_ENTITY_MIME)) {
    raw = event.dataTransfer.getData(DOMAIN_ENTITY_MIME)
  }
  if (!raw) {
    raw = event.dataTransfer?.getData('text/plain') ?? null
  }
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  }
  catch {
    return []
  }
}

function resolveAuthProfileIdentity(item: DomainDragPayloadItem): string {
  const identity = String(item.identity ?? '').trim()
  if (identity) {
    return identity
  }

  const id = String(item.id ?? '').trim()
  if (!id) {
    return ''
  }

  const profile = Endge.domain.getAuthProfiles()
    .find(profile => String(profile.id) === id || profile.identity === id)
  return profile?.identity ?? ''
}

function toSourceStringLiteral(value: string): string {
  return `'${value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, '\\u0027')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')}'`
}

function getDropPosition(event: DragEvent): Monaco.Position | null {
  const target = editor?.getTargetAtClientPoint(event.clientX, event.clientY)
  return target?.position ?? editor?.getPosition() ?? null
}

function insertAtPosition(value: string, position: Monaco.Position): void {
  if (!editor) {
    return
  }

  const range = new monaco.Range(
    position.lineNumber,
    position.column,
    position.lineNumber,
    position.column,
  )

  editor.executeEdits('endge-auth-profile-drop', [{ range, text: value, forceMoveMarkers: true }])
  editor.setPosition({
    lineNumber: position.lineNumber,
    column: position.column + value.length,
  })
  editor.focus()
}

function readDraggedAuthProfileIdentity(event: DragEvent): string {
  const payload = parseDomainDragPayload(event)
  const authProfile = payload.find(item =>
    item.sectionType === DomainSectionType.AuthProfile
    || item.docType === 'auth-profile',
  )

  return authProfile ? resolveAuthProfileIdentity(authProfile) : ''
}

function onEditorDragOver(event: DragEvent): void {
  if (!readDraggedAuthProfileIdentity(event)) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

function onEditorDrop(event: DragEvent): void {
  const identity = readDraggedAuthProfileIdentity(event)
  if (!identity) {
    return
  }

  const position = getDropPosition(event)
  if (!position) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  insertAtPosition(toSourceStringLiteral(identity), position)
}

/** Обновляет Monaco markers по diagnostics source language strategy. */
function updateMarkers(): void {
  const model = editor?.getModel()
  if (!model) {
    return
  }

  const diagnostics = readDiagnostics(model.getValue())
  diagnosticsCount.value = diagnostics.length

  monaco.editor.setModelMarkers(
    model,
    'endge-query-source',
    diagnostics.map(diagnostic => toEditorMarker(model, diagnostic)),
  )
}

function readDiagnostics(source: string): Array<{
  severity?: string
  message?: string
  code?: string
  start?: number
  end?: number
}> {
  try {
    const validation = Endge.source.validate('query', source)
    return validation.diagnostics as Array<{
      severity?: string
      message?: string
      code?: string
      start?: number
      end?: number
    }>
  }
  catch (error) {
    return [{
      severity: 'error',
      code: 'query-source-validation-error',
      message: error instanceof Error ? error.message : String(error),
    }]
  }
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
  if (!container.value) {
    return
  }

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
    padding: {
      bottom: 10,
    },
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

  container.value.addEventListener('dragover', onEditorDragOver, true)
  container.value.addEventListener('drop', onEditorDrop, true)

  updateMarkers()
})

watch(
  () => props.modelValue,
  (value) => {
    if (editor && editor.getValue() !== value) {
      editor.setValue(value)
      updateMarkers()
    }
  },
)

onBeforeUnmount(() => {
  container.value?.removeEventListener('dragover', onEditorDragOver, true)
  container.value?.removeEventListener('drop', onEditorDrop, true)

  const model = editor?.getModel()
  if (model) {
    monaco.editor.setModelMarkers(model, 'endge-query-source', [])
  }

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
  flex: 1 1 auto;
  min-height: 280px;
  height: 100%;
  width: 100%;
  border-top: 1px solid hsl(var(--border));
  background: #1e1e1e;
}
</style>
