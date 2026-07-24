<script setup lang="ts">
/* eslint-disable style/max-statements-per-line */
import type {
  CompositionDropDescriptor,
  CompositionDropPayloadItem,
  CompositionDropPlan,
} from '@/features/endge-ide/model/composition-source-drop'
import type {
  CompositionSourceDocument,
  CompositionSourcePatchOperation,
} from '@endge/core'
import type * as Monaco from 'monaco-editor'

import { Endge } from '@endge/core'
import * as monaco from 'monaco-editor'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import {
  buildCompositionDropPlan,
  resolveCompositionDropDescriptor,
} from '@/features/endge-ide/model/composition-source-drop'
import { domainDragState } from '@/features/endge-ide/model/domain/domain-drag-state'
import { createCompositionRuntimePropsContribution } from '@/features/endge-ide/source-editor/contributions/composition/runtime-props/composition-runtime-props.contribution'
import { useEndgeSourceMonaco } from '@/features/endge-ide/tools/source-editor/use-endge-source-monaco'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>()
const DOMAIN_ENTITY_MIME = 'application/x-endge-domain-entity'
const container = ref<HTMLDivElement | null>(null)
const source = ref(props.modelValue ?? '')
const dropOver = ref(false)
let editor: Monaco.editor.IStandaloneCodeEditor | null = null
const monacoAdapter = useEndgeSourceMonaco({
  container,
  sourceKind: 'composition',
  value: () => source.value,
  onChange: (value) => {
    source.value = value
    emit('update:modelValue', value)
  },
  extensions: [createCompositionRuntimePropsContribution()],
  onReady: (instance) => {
    editor = instance
    container.value?.addEventListener('dragover', onEditorDragOver, true)
    container.value?.addEventListener('dragleave', onEditorDragLeave, true)
    container.value?.addEventListener('drop', onEditorDrop, true)
  },
})

const draggedDescriptors = computed(() =>
  domainDragState.value.tree
    .map(item => resolveCompositionDropDescriptor(item))
    .filter((item): item is CompositionDropDescriptor => item != null),
)
const dropTargetLabel = computed(() => {
  const targets = [...new Set(draggedDescriptors.value.map(item => item.target))]
  return `${formatDocumentCount(draggedDescriptors.value.length)} → ${targets.join(' + ')}`
})

function parseDomainDragPayload(event: DragEvent): CompositionDropPayloadItem[] {
  let raw: string | null = null
  if (event.dataTransfer?.types.includes(DOMAIN_ENTITY_MIME)) { raw = event.dataTransfer.getData(DOMAIN_ENTITY_MIME) }
  if (!raw) { raw = event.dataTransfer?.getData('text/plain') ?? null }
  if (!raw) { return [] }

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  }
  catch {
    return []
  }
}

function isDomainEntityDrag(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes(DOMAIN_ENTITY_MIME) === true
}

function onEditorDragOver(event: DragEvent): void {
  if (!isDomainEntityDrag(event)) { return }

  event.preventDefault()
  event.stopPropagation()
  dropOver.value = draggedDescriptors.value.length > 0
  if (event.dataTransfer) { event.dataTransfer.dropEffect = dropOver.value ? 'copy' : 'none' }
}

function onEditorDragLeave(event: DragEvent): void {
  const nextTarget = event.relatedTarget
  if (nextTarget instanceof Node && container.value?.contains(nextTarget)) { return }

  dropOver.value = false
}

function onEditorDrop(event: DragEvent): void {
  if (!isDomainEntityDrag(event)) { return }

  event.preventDefault()
  event.stopPropagation()
  dropOver.value = false

  const items = parseDomainDragPayload(event)
  const model = editor?.getModel()
  if (!model || !items.length) {
    toast.info('В Composition можно добавить только документы из виджета Домен')
    return
  }

  const currentSource = model.getValue()
  const compiled = Endge.source.compile('composition', currentSource)
  const document = compiled.document as CompositionSourceDocument | undefined
  if (!document) {
    toast.error('Не удалось добавить документы', {
      description: 'Сначала исправьте ошибки в Composition source.',
    })
    return
  }

  const plan = buildCompositionDropPlan(items, document)
  if (!plan.operations.length) {
    toast.info('Нечего добавлять в Composition', {
      description: formatSkippedDescription(plan),
    })
    return
  }

  const result = Endge.source.patch<CompositionSourcePatchOperation[], CompositionSourceDocument>(
    'composition',
    currentSource,
    plan.operations,
  )
  if (!result.ok || !result.changed) {
    toast.error('Не удалось добавить документы', {
      description: result.message ?? 'Composition source не был изменён.',
    })
    return
  }

  applySourceEdit(currentSource, result.source)
  toast.success(formatAddedTitle(plan.operations.length), {
    description: formatSkippedDescription(plan),
  })
}

function applySourceEdit(currentSource: string, nextSource: string): void {
  const model = editor?.getModel()
  if (!editor || !model || currentSource === nextSource) { return }

  let start = 0
  const maxPrefix = Math.min(currentSource.length, nextSource.length)
  while (start < maxPrefix && currentSource[start] === nextSource[start]) { start += 1 }

  let currentEnd = currentSource.length
  let nextEnd = nextSource.length
  while (
    currentEnd > start
    && nextEnd > start
    && currentSource[currentEnd - 1] === nextSource[nextEnd - 1]
  ) {
    currentEnd -= 1
    nextEnd -= 1
  }

  const range = monaco.Range.fromPositions(
    model.getPositionAt(start),
    model.getPositionAt(currentEnd),
  )
  const replacement = nextSource.slice(start, nextEnd)
  editor.pushUndoStop()
  editor.executeEdits('endge-composition-domain-drop', [{
    range,
    text: replacement,
    forceMoveMarkers: true,
  }])
  editor.pushUndoStop()

  const position = model.getPositionAt(start + replacement.length)
  editor.setPosition(position)
  editor.revealPositionInCenterIfOutsideViewport(position)
  editor.focus()
}

function formatDocumentCount(count: number): string {
  const mod100 = count % 100
  const mod10 = count % 10
  const noun = mod100 >= 11 && mod100 <= 14
    ? 'документов'
    : mod10 === 1
      ? 'документ'
      : mod10 >= 2 && mod10 <= 4
        ? 'документа'
        : 'документов'
  return `${count} ${noun}`
}

function formatAddedTitle(count: number): string {
  return count === 1
    ? 'Документ добавлен'
    : `${formatDocumentCount(count)} добавлено`
}

function formatSkippedDescription(plan: Pick<CompositionDropPlan, 'duplicateCount' | 'unsupportedCount'>): string | undefined {
  const parts: string[] = []
  if (plan.duplicateCount) { parts.push(`Уже добавлено: ${plan.duplicateCount}`) }
  if (plan.unsupportedCount) { parts.push(`Не поддерживается: ${plan.unsupportedCount}`) }
  return parts.length ? parts.join(' · ') : undefined
}

watch(() => props.modelValue, (value) => {
  source.value = value ?? ''
  monacoAdapter.setValue(source.value)
})
watch(() => domainDragState.value.active, (active) => {
  if (!active) { dropOver.value = false }
})

defineExpose({ formatDocument: monacoAdapter.formatDocument })

onBeforeUnmount(() => {
  container.value?.removeEventListener('dragover', onEditorDragOver, true)
  container.value?.removeEventListener('dragleave', onEditorDragLeave, true)
  container.value?.removeEventListener('drop', onEditorDrop, true)
  editor = null
})
</script>

<template>
  <div class="relative h-full min-h-0 flex-1">
    <div ref="container" class="h-full min-h-0" />
    <div
      v-if="dropOver"
      class="pointer-events-none absolute inset-2 z-10 rounded-md border-2 border-dashed border-primary bg-primary/5"
    >
      <div class="absolute left-1/2 top-3 -translate-x-1/2 rounded-md border bg-popover px-3 py-1.5 text-xs font-medium text-popover-foreground shadow-sm">
        {{ dropTargetLabel }}
      </div>
    </div>
  </div>
</template>

<style scoped>
:deep(.endge-source-inline-action) {
  margin-left: 12px;
  color: #8790a8 !important;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer !important;
  user-select: none;
  transition: color 120ms ease;
}

:deep(.endge-source-inline-action:hover) {
  color: #c792ea !important;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}
</style>
