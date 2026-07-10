<script setup lang="ts">
import type * as Monaco from 'monaco-editor'

import { DomainSectionType, Endge } from '@endge/core'
import { RotateCcw } from 'lucide-vue-next'
import * as monaco from 'monaco-editor'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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

let editor: Monaco.editor.IStandaloneCodeEditor | null = null
const monacoAdapter = useEndgeSourceMonaco({
  container,
  sourceKind: 'query',
  value: () => source.value,
  onChange: value => { source.value = value },
  owner: 'endge-query-source',
  onReady: (instance) => {
    editor = instance
    container.value?.addEventListener('dragover', onEditorDragOver, true)
    container.value?.addEventListener('drop', onEditorDrop, true)
  },
})
const diagnosticsCount = monacoAdapter.diagnosticsCount
const DOMAIN_ENTITY_MIME = 'application/x-endge-domain-entity'

interface DomainDragPayloadItem {
  id?: string | number
  identity?: string
  sectionType?: string
  docType?: string
}

/** Сбрасывает source к базовому шаблону RQuery v2. */
function resetToDefaultSource(): void {
  const value = Endge.source.createDefault('query')
  source.value = value
  monacoAdapter.setValue(value)
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

watch(
  () => props.modelValue,
  (value) => {
    monacoAdapter.setValue(value)
  },
)

onBeforeUnmount(() => {
  container.value?.removeEventListener('dragover', onEditorDragOver, true)
  container.value?.removeEventListener('drop', onEditorDrop, true)

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
