<script setup lang="ts">
import type * as Monaco from 'monaco-editor'

import { DomainSectionType, Endge } from '@endge/core'
import * as monaco from 'monaco-editor'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

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
  onChange: (value) => { source.value = value },
  owner: 'endge-query-source',
  onReady: (instance) => {
    editor = instance
    container.value?.addEventListener('dragover', onEditorDragOver, true)
    container.value?.addEventListener('drop', onEditorDrop, true)
  },
})
const DOMAIN_ENTITY_MIME = 'application/x-endge-domain-entity'

interface DomainDragPayloadItem {
  id?: string | number
  identity?: string
  sectionType?: string
  docType?: string
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

defineExpose({ formatDocument: monacoAdapter.formatDocument })

onBeforeUnmount(() => {
  container.value?.removeEventListener('dragover', onEditorDragOver, true)
  container.value?.removeEventListener('drop', onEditorDrop, true)

  editor = null
})
</script>

<template>
  <div class="query-source-editor">
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
  background: var(--editor-surface);
}

.query-source-editor__monaco {
  flex: 1 1 auto;
  min-height: 280px;
  height: 100%;
  width: 100%;
  background: var(--editor-surface);
}
</style>
