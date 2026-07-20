<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text, style/max-statements-per-line */
import type { VisualSchemaDiagnostic, VisualSchemaTypeOption } from '@/features/endge-ide/model/visual-schema-editor.types'
import type {
  TypeSourceDefinition,
  TypeSourceDocument,
  TypeSourceExpression,
  TypeSourceField,
} from '@endge/core'
import type { CSSProperties } from 'vue'

import {
  AlertCircle,
  Braces,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  CircleDot,
  Copy,
  EllipsisVertical,
  ExternalLink,
  GripVertical,
  Plus,
  Trash2,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  cloneTypeSourceDocument,
  createDefaultTypeSourceField,
  parseTypeVisualSource,
} from '@/features/endge-ide/model/type-visual-editor'

interface TypeVisualRow {
  id: string
  depth: number
  field: TypeSourceField
  fieldPath: number[] | null
  local: boolean
  ownerIdentity: string
  hasChildren: boolean
  cycle: boolean
}

interface ObjectDragState {
  parentPath: number[]
  index: number
}

type TypeVisualPanel = 'schema' | 'preview' | 'example'

const props = defineProps<{
  document: TypeSourceDocument | null
  diagnostics?: VisualSchemaDiagnostic[]
  valid?: boolean
  readonly?: boolean
  allowFieldDescriptions?: boolean
  defaultTypeIdentity?: string
  identity: string
  types: VisualSchemaTypeOption[]
  showPreview: boolean
  showExample: boolean
  panelSizes: number[]
}>()

const emit = defineEmits<{
  (event: 'update:document', value: TypeSourceDocument): void
  (event: 'update:panelSizes', value: number[]): void
  (event: 'open:type', identity: string): void
}>()

const INLINE_OBJECT_VALUE = '__endge_inline_object__'
const MIN_PANEL_RATIO = 0.12
const SPLIT_KEYBOARD_STEP = 0.02

const definition = computed(() => props.document?.definition ?? null)
const definitionItemCount = computed(() => {
  const current = definition.value
  if (!current) { return 0 }
  if (current.kind === 'object') { return current.fields.length }
  if (current.kind === 'enum') { return current.values.length }
  if (current.kind === 'union') { return current.variants.length }
  return 1
})
const typeMap = computed(() => new Map(props.types.map(type => [type.identity, type])))
const referenceTypeSelectOptions = computed(() => props.types.map(type => ({
  value: type.identity,
  label: type.label === type.identity ? type.identity : `${type.identity} — ${type.label}`,
  group: type.category === 'primitive'
    ? 'Primitive types'
    : type.category === 'reference'
      ? 'Entity references'
      : 'User types',
})))
const typeSelectOptions = computed(() => [
  { value: INLINE_OBJECT_VALUE, label: 'Inline object', group: 'Structures' },
  ...referenceTypeSelectOptions.value,
])
const selectedRowId = ref<string | null>(null)
const collapsedIds = ref(new Set<string>())
const draggedObjectField = ref<ObjectDragState | null>(null)
const draggedListIndex = ref<number | null>(null)
const descriptionDialogOpen = ref(false)
const descriptionDialogFieldPath = ref<number[] | null>(null)
const descriptionDialogFieldName = ref('')
const descriptionDraft = ref('')
const showPreview = computed(() => props.showPreview)
const showExample = computed(() => props.showExample)
const activePanels = computed<TypeVisualPanel[]>(() => [
  'schema',
  ...(showPreview.value ? ['preview' as const] : []),
  ...(showExample.value ? ['example' as const] : []),
])
const workspaceRef = ref<HTMLElement | null>(null)
const isSplitResizing = ref(false)
const activeDividerIndex = ref<number | null>(null)
const panelSizesDraft = ref(normalizePanelSizes(props.panelSizes, activePanels.value.length))

watch(
  [() => props.panelSizes, activePanels],
  ([sizes, panels]) => {
    if (!isSplitResizing.value) {
      panelSizesDraft.value = normalizePanelSizes(sizes, panels.length)
    }
  },
  { deep: true },
)

const objectRows = computed<TypeVisualRow[]>(() => {
  if (definition.value?.kind !== 'object') { return [] }

  const rows: TypeVisualRow[] = []
  const cache = new Map<string, TypeSourceDefinition | null>()

  const resolveDefinition = (identity: string): TypeSourceDefinition | null => {
    if (cache.has(identity)) { return cache.get(identity) ?? null }
    const option = typeMap.value.get(identity)
    if (!option?.source?.trim()) {
      cache.set(identity, null)
      return null
    }
    const resolved = parseTypeVisualSource(option.source)
    const next = resolved.valid ? resolved.document?.definition ?? null : null
    cache.set(identity, next)
    return next
  }

  const appendFields = (
    fields: TypeSourceField[],
    depth: number,
    ownerIdentity: string,
    parentPath: string,
    local: boolean,
    localParentPath: number[] | null,
    visited: Set<string>,
  ): void => {
    fields.forEach((field, index) => {
      const id = `${parentPath}/${field.key}:${index}`
      const fieldPath = local && localParentPath ? [...localParentPath, index] : null
      const referenceIdentity = field.type.kind === 'reference' ? field.type.identity : null
      const targetDefinition = field.type.kind === 'object'
        ? field.type
        : referenceIdentity
          ? resolveDefinition(referenceIdentity)
          : null
      const cycle = targetDefinition?.kind === 'object' && referenceIdentity != null && visited.has(referenceIdentity)
      const hasChildren = targetDefinition?.kind === 'object' && targetDefinition.fields.length > 0
      rows.push({ id, depth, field, fieldPath, local, ownerIdentity, hasChildren, cycle })

      const expanded = hasChildren && !cycle && !collapsedIds.value.has(id)
      if (!expanded || targetDefinition?.kind !== 'object') { return }

      const nestedLocal = local && field.type.kind === 'object'
      const nestedOwnerIdentity = referenceIdentity ?? ownerIdentity

      appendFields(
        targetDefinition.fields,
        depth + 1,
        nestedOwnerIdentity,
        id,
        nestedLocal,
        nestedLocal ? fieldPath : null,
        referenceIdentity ? new Set([...visited, referenceIdentity]) : visited,
      )
    })
  }

  appendFields(
    definition.value.fields,
    0,
    props.identity,
    props.identity || 'type',
    true,
    [],
    new Set([props.identity]),
  )
  return rows
})

const errorDiagnostics = computed(() => (props.diagnostics ?? []).filter(item => item.severity === 'error'))
const warningDiagnostics = computed(() => (props.diagnostics ?? []).filter(item => item.severity === 'warning'))
const exampleJson = computed(() => JSON.stringify(buildRootExample(definition.value, new Set([props.identity])), null, 2))

watch(objectRows, (rows) => {
  if (selectedRowId.value && rows.some(row => row.id === selectedRowId.value)) { return }
  selectedRowId.value = rows.find(row => row.local)?.id ?? rows[0]?.id ?? null
}, { immediate: true })

function emitDocument(document: TypeSourceDocument): void {
  emit('update:document', document)
}

function mutateDocument(mutate: (document: TypeSourceDocument) => void): void {
  if (!props.document || props.readonly) { return }
  const next = cloneTypeSourceDocument(props.document)
  mutate(next)
  emitDocument(next)
}

function getUniqueFieldName(fields: TypeSourceField[], base = 'field'): string {
  let name = base
  let suffix = 0
  while (fields.some(field => field.key === name)) {
    suffix += 1
    name = `${base}${suffix}`
  }
  return name
}

function createDefaultField(key: string): TypeSourceField {
  const field = createDefaultTypeSourceField(key)
  if (props.defaultTypeIdentity) { field.type = { kind: 'reference', identity: props.defaultTypeIdentity } }
  return field
}

function getObjectFields(document: TypeSourceDocument, parentPath: number[]): TypeSourceField[] | null {
  if (document.definition.kind !== 'object') { return null }
  let fields = document.definition.fields
  for (const index of parentPath) {
    const field = fields[index]
    if (field?.type.kind !== 'object') { return null }
    fields = field.type.fields
  }
  return fields
}

function getObjectField(document: TypeSourceDocument, fieldPath: number[]): TypeSourceField | null {
  if (fieldPath.length === 0) { return null }
  const fields = getObjectFields(document, fieldPath.slice(0, -1))
  return fields?.[fieldPath.at(-1)!] ?? null
}

function addObjectField(parentPath: number[] = [], afterIndex?: number): void {
  mutateDocument((document) => {
    const fields = getObjectFields(document, parentPath)
    if (!fields) { return }
    const key = getUniqueFieldName(fields)
    const index = afterIndex == null ? fields.length : afterIndex + 1
    fields.splice(index, 0, createDefaultField(key))
  })
}

function addDefinitionItem(): void {
  if (definition.value?.kind === 'object') { addObjectField() }
  else if (definition.value?.kind === 'enum') { addEnumValue() }
  else if (definition.value?.kind === 'union') { addUnionVariant() }
}

function updateObjectField(fieldPath: number[], patch: Partial<TypeSourceField>): void {
  mutateDocument((document) => {
    const field = getObjectField(document, fieldPath)
    if (!field) { return }
    Object.assign(field, patch)
  })
}

function updateObjectFieldName(row: TypeVisualRow, rawName: string): void {
  const name = rawName.trim()
  if (!name || !row.fieldPath) { return }
  mutateDocument((document) => {
    const siblings = getObjectFields(document, row.fieldPath!.slice(0, -1))
    const index = row.fieldPath!.at(-1)!
    if (!siblings || siblings.some((field, siblingIndex) => siblingIndex !== index && field.key === name)) { return }
    if (siblings[index]) { siblings[index]!.key = name }
  })
}

function duplicateObjectField(fieldPath: number[]): void {
  mutateDocument((document) => {
    const parentPath = fieldPath.slice(0, -1)
    const index = fieldPath.at(-1)!
    const fields = getObjectFields(document, parentPath)
    const field = fields?.[index]
    if (!field) { return }
    const clone = JSON.parse(JSON.stringify(field)) as TypeSourceField
    clone.key = getUniqueFieldName(fields!, `${field.key}Copy`)
    fields!.splice(index + 1, 0, clone)
  })
}

function openDescriptionDialog(row: TypeVisualRow): void {
  if (!row.fieldPath) { return }
  descriptionDialogFieldPath.value = [...row.fieldPath]
  descriptionDialogFieldName.value = row.field.key
  descriptionDraft.value = row.field.description ?? ''
  descriptionDialogOpen.value = true
}

function saveDescription(): void {
  const fieldPath = descriptionDialogFieldPath.value
  if (!fieldPath) { return }
  const description = descriptionDraft.value.trim()
  updateObjectField(fieldPath, { description: description || undefined })
  descriptionDialogOpen.value = false
}

function removeObjectField(fieldPath: number[]): void {
  mutateDocument((document) => {
    const fields = getObjectFields(document, fieldPath.slice(0, -1))
    if (fields) { fields.splice(fieldPath.at(-1)!, 1) }
  })
}

function startObjectDrag(fieldPath: number[], event: DragEvent): void {
  draggedObjectField.value = { parentPath: fieldPath.slice(0, -1), index: fieldPath.at(-1)! }
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', fieldPath.join('.'))
  }
}

function dropObjectField(targetPath: number[]): void {
  const source = draggedObjectField.value
  draggedObjectField.value = null
  const targetParentPath = targetPath.slice(0, -1)
  const targetIndex = targetPath.at(-1)!
  if (!source || source.index === targetIndex || source.parentPath.join('.') !== targetParentPath.join('.')) { return }
  mutateDocument((document) => {
    const fields = getObjectFields(document, source.parentPath)
    if (!fields) { return }
    const [field] = fields.splice(source.index, 1)
    if (!field) { return }
    fields.splice(targetIndex, 0, field)
  })
}

function updateObjectFieldType(fieldPath: number[], value: string): void {
  mutateDocument((document) => {
    const field = getObjectField(document, fieldPath)
    if (!field) { return }
    field.type = value === INLINE_OBJECT_VALUE
      ? { kind: 'object', fields: [createDefaultField('field')] }
      : { kind: 'reference', identity: value }
    if (!(field.type.kind === 'reference' && field.type.identity === 'Number')) {
      delete field.min
      delete field.max
    }
  })
}

function toggleExpanded(row: TypeVisualRow): void {
  if (!row.hasChildren || row.cycle) { return }
  const next = new Set(collapsedIds.value)
  if (next.has(row.id)) {
    next.delete(row.id)
  }
  else { next.add(row.id) }
  collapsedIds.value = next
}

function isExpanded(row: TypeVisualRow): boolean {
  return row.hasChildren && !collapsedIds.value.has(row.id)
}

function collapseAll(): void {
  collapsedIds.value = new Set()
  collapsedIds.value = new Set(
    objectRows.value
      .filter(row => row.hasChildren && !row.cycle)
      .map(row => row.id),
  )
}

function expandAll(): void {
  collapsedIds.value = new Set()
}

function normalizePanelSizes(sizes: readonly number[], panelCount: number): number[] {
  if (sizes.length !== panelCount || sizes.some(size => !Number.isFinite(size) || size <= 0)) {
    return Array.from({ length: panelCount }, () => 1 / panelCount)
  }
  const total = sizes.reduce((sum, size) => sum + size, 0)
  if (total <= 0) {
    return Array.from({ length: panelCount }, () => 1 / panelCount)
  }
  return sizes.map(size => size / total)
}

function panelStyle(index: number): CSSProperties {
  return {
    flexBasis: 0,
    flexGrow: panelSizesDraft.value[index] ?? 1,
    flexShrink: 1,
  }
}

function dividerBoundary(dividerIndex: number): number {
  return panelSizesDraft.value
    .slice(0, dividerIndex + 1)
    .reduce((sum, size) => sum + size, 0)
}

function updatePanelBoundary(clientX: number): void {
  const container = workspaceRef.value
  const dividerIndex = activeDividerIndex.value
  if (!container || dividerIndex == null) { return }
  const rect = container.getBoundingClientRect()
  if (rect.width <= 0) { return }

  const sizes = [...panelSizesDraft.value]
  const before = sizes.slice(0, dividerIndex).reduce((sum, size) => sum + size, 0)
  const adjacentTotal = (sizes[dividerIndex] ?? 0) + (sizes[dividerIndex + 1] ?? 0)
  const minRatio = Math.min(MIN_PANEL_RATIO, adjacentTotal / 3)
  const nextBoundary = Math.min(
    before + adjacentTotal - minRatio,
    Math.max(before + minRatio, (clientX - rect.left) / rect.width),
  )
  sizes[dividerIndex] = nextBoundary - before
  sizes[dividerIndex + 1] = adjacentTotal - sizes[dividerIndex]
  panelSizesDraft.value = normalizePanelSizes(sizes, activePanels.value.length)
}

function onSplitPointerMove(event: PointerEvent): void {
  if (isSplitResizing.value) {
    updatePanelBoundary(event.clientX)
  }
}

function endSplitResize(): void {
  if (!isSplitResizing.value) { return }
  isSplitResizing.value = false
  activeDividerIndex.value = null
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  window.removeEventListener('pointermove', onSplitPointerMove)
  window.removeEventListener('pointerup', endSplitResize)
  window.removeEventListener('pointercancel', endSplitResize)
  emit('update:panelSizes', [...panelSizesDraft.value])
}

function beginSplitResize(dividerIndex: number, event: PointerEvent): void {
  if (event.button !== 0) { return }
  event.preventDefault()
  isSplitResizing.value = true
  activeDividerIndex.value = dividerIndex
  document.body.style.cursor = 'ew-resize'
  document.body.style.userSelect = 'none'
  updatePanelBoundary(event.clientX)
  window.addEventListener('pointermove', onSplitPointerMove)
  window.addEventListener('pointerup', endSplitResize)
  window.addEventListener('pointercancel', endSplitResize)
}

function resizeSplitByKeyboard(dividerIndex: number, event: KeyboardEvent): void {
  const direction = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
  if (direction === 0) { return }
  event.preventDefault()
  const sizes = [...panelSizesDraft.value]
  const adjacentTotal = (sizes[dividerIndex] ?? 0) + (sizes[dividerIndex + 1] ?? 0)
  const minRatio = Math.min(MIN_PANEL_RATIO, adjacentTotal / 3)
  const delta = direction * (event.shiftKey ? SPLIT_KEYBOARD_STEP * 5 : SPLIT_KEYBOARD_STEP)
  const nextLeft = Math.min(adjacentTotal - minRatio, Math.max(minRatio, (sizes[dividerIndex] ?? 0) + delta))
  sizes[dividerIndex] = nextLeft
  sizes[dividerIndex + 1] = adjacentTotal - nextLeft
  panelSizesDraft.value = normalizePanelSizes(sizes, activePanels.value.length)
  emit('update:panelSizes', [...panelSizesDraft.value])
}

onBeforeUnmount(endSplitResize)

function updateEnumValue(index: number, rawValue: string): void {
  mutateDocument((document) => {
    if (document.definition.kind !== 'enum') { return }
    const current = document.definition.values[index]
    if (typeof current === 'number') {
      const value = Number(rawValue)
      if (Number.isFinite(value)) { document.definition.values[index] = value }
      return
    }
    if (typeof current === 'boolean') {
      document.definition.values[index] = rawValue === 'true'
      return
    }
    document.definition.values[index] = rawValue
  })
}

function addEnumValue(): void {
  mutateDocument((document) => {
    if (document.definition.kind !== 'enum') { return }
    const currentKind = typeof document.definition.values[0]
    if (currentKind === 'number') {
      const numbers = document.definition.values.filter((value): value is number => typeof value === 'number')
      document.definition.values.push((Math.max(-1, ...numbers) + 1))
    }
    else if (currentKind === 'boolean') {
      if (!document.definition.values.includes(true)) { document.definition.values.push(true) }
      else if (!document.definition.values.includes(false)) { document.definition.values.push(false) }
    }
    else {
      let value = 'value'
      let suffix = 0
      while (document.definition.values.includes(value)) { value = `value${++suffix}` }
      document.definition.values.push(value)
    }
  })
}

function removeListItem(index: number): void {
  mutateDocument((document) => {
    if (document.definition.kind === 'enum' && document.definition.values.length > 1) { document.definition.values.splice(index, 1) }
    if (document.definition.kind === 'union' && document.definition.variants.length > 2) { document.definition.variants.splice(index, 1) }
  })
}

function addUnionVariant(): void {
  mutateDocument((document) => {
    if (document.definition.kind !== 'union') { return }
    const used = new Set(document.definition.variants.flatMap(variant => variant.kind === 'reference' ? [variant.identity] : []))
    const identity = props.types.find(type => !used.has(type.identity))?.identity
    if (identity) { document.definition.variants.push({ kind: 'reference', identity }) }
  })
}

function updateUnionVariant(index: number, identity: string): void {
  mutateDocument((document) => {
    if (document.definition.kind === 'union' && document.definition.variants[index]) {
      document.definition.variants[index] = { kind: 'reference', identity }
    }
  })
}

function moveListItem(targetIndex: number): void {
  const sourceIndex = draggedListIndex.value
  draggedListIndex.value = null
  if (sourceIndex == null || sourceIndex === targetIndex) { return }
  mutateDocument((document) => {
    const list = document.definition.kind === 'enum'
      ? document.definition.values
      : document.definition.kind === 'union'
        ? document.definition.variants
        : null
    if (!list) { return }
    const [item] = list.splice(sourceIndex, 1) as [any]
    list.splice(targetIndex, 0, item)
  })
}

function typeTone(identity: string): string {
  if (identity === 'String' || identity === 'string' || identity === 'ID' || identity === 'DateTime' || identity === 'Time') { return 'type-visual-editor__type--string' }
  if (identity === 'Number' || identity === 'number') { return 'type-visual-editor__type--number' }
  if (identity === 'Boolean' || identity === 'boolean') { return 'type-visual-editor__type--boolean' }
  if (identity === 'Null' || identity === 'null' || identity === 'Any' || identity === 'any' || identity === 'unknown') { return 'type-visual-editor__type--neutral' }
  return 'type-visual-editor__type--reference'
}

function expressionLabel(expression: TypeSourceExpression): string {
  if (expression.kind === 'reference') { return expression.identity }
  if (expression.kind === 'object') { return 'object' }
  if (expression.kind === 'enum') { return 'enum' }
  if (expression.kind === 'union') { return 'union' }
  return `array[${expressionLabel(expression.items)}]`
}

function expressionTone(expression: TypeSourceExpression): string {
  return expression.kind === 'reference' ? typeTone(expression.identity) : 'type-visual-editor__type--inline'
}

function canOpenReferencedType(expression: TypeSourceExpression): boolean {
  if (expression.kind !== 'reference') { return false }
  const option = typeMap.value.get(expression.identity)
  return option != null && option.category !== 'primitive'
}

function openTypeFromModifiedClick(expression: TypeSourceExpression, event: MouseEvent): void {
  if (!(event.metaKey || event.ctrlKey) || !canOpenReferencedType(expression) || expression.kind !== 'reference') {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  emit('open:type', expression.identity)
}

function fieldTypeSelectionValue(field: TypeSourceField): string {
  return field.type.kind === 'reference' ? field.type.identity : INLINE_OBJECT_VALUE
}

function canSelectFieldType(field: TypeSourceField): boolean {
  return field.type.kind === 'reference' || field.type.kind === 'object'
}

function buildRootExample(current: TypeSourceDefinition | null, visited: Set<string>): unknown {
  return current ? sampleForExpression(current, visited) : null
}

function sampleForExpression(expression: TypeSourceExpression, visited: Set<string>): unknown {
  if (expression.kind === 'object') {
    return Object.fromEntries(expression.fields.map(field => [field.key, field.examples[0] ?? (field.array
      ? [sampleForExpression(field.type, visited)]
      : sampleForExpression(field.type, visited))]))
  }
  if (expression.kind === 'enum') { return expression.values[0] ?? null }
  if (expression.kind === 'union') { return expression.variants[0] ? sampleForExpression(expression.variants[0], visited) : null }
  if (expression.kind === 'array') { return [sampleForExpression(expression.items, visited)] }

  const identity = expression.identity
  if (identity === 'String' || identity === 'string' || identity === 'ID') { return 'string' }
  if (identity === 'Number' || identity === 'number') { return 0 }
  if (identity === 'Boolean' || identity === 'boolean') { return false }
  if (identity === 'Null' || identity === 'null' || identity === 'Any' || identity === 'any' || identity === 'unknown') { return null }
  if (identity === 'DateTime') { return '2026-01-01T00:00:00Z' }
  if (identity === 'Time') { return '00:00:00' }
  if (visited.has(identity)) { return null }
  const option = typeMap.value.get(identity)
  if (!option?.source) { return null }
  const target = parseTypeVisualSource(option.source)
  return buildRootExample(target.document?.definition ?? null, new Set([...visited, identity]))
}
</script>

<template>
  <div class="type-visual-editor">
    <div v-if="props.valid === false || !definition" class="type-visual-editor__invalid">
      <div class="type-visual-editor__invalid-icon">
        <AlertCircle class="size-5" />
      </div>
      <div>
        <div class="text-sm font-semibold">
          Visual schema is unavailable
        </div>
        <p class="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
          Исправьте Source, чтобы visual editor снова мог построить semantic document.
        </p>
        <div class="mt-4 space-y-2">
          <div
            v-for="(diagnostic, index) in errorDiagnostics"
            :key="`${diagnostic.code}-${index}`"
            class="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive"
          >
            <span class="font-mono font-semibold">{{ diagnostic.code }}</span>
            <span class="ml-2">{{ diagnostic.message }}</span>
          </div>
        </div>
      </div>
    </div>

    <template v-else>
      <div
        ref="workspaceRef"
        class="type-visual-editor__workspace"
        :class="{
          'has-no-auxiliary-pane': !showPreview && !showExample,
          'has-single-auxiliary-pane': showPreview !== showExample,
          'has-preview-and-example': showPreview && showExample,
        }"
      >
        <section class="type-visual-editor__schema-pane" :style="panelStyle(0)">
          <div class="type-visual-editor__schema-scroll">
            <div class="type-visual-editor__schema-card">
              <div class="type-visual-editor__root-row">
                <span class="type-visual-editor__root-kind">Тип</span>
                <span class="type-visual-editor__root-count">({{ definitionItemCount }})</span>
                <div class="flex-1" />
                <button
                  v-if="definition.kind === 'object'"
                  type="button"
                  class="type-visual-editor__tiny-action"
                  aria-label="Свернуть все блоки"
                  title="Свернуть все блоки"
                  @click="collapseAll"
                >
                  <ChevronsDownUp class="size-3.5" />
                </button>
                <button
                  v-if="definition.kind === 'object'"
                  type="button"
                  class="type-visual-editor__tiny-action"
                  aria-label="Развернуть все блоки"
                  title="Развернуть все блоки"
                  @click="expandAll"
                >
                  <ChevronsUpDown class="size-3.5" />
                </button>
                <button
                  v-if="definition.kind !== 'array' && !props.readonly"
                  type="button"
                  class="type-visual-editor__tiny-action"
                  aria-label="Add schema item"
                  @click="addDefinitionItem"
                >
                  <Plus class="size-3.5" />
                </button>
              </div>

              <div v-if="definition.kind === 'object'" class="type-visual-editor__tree">
                <div
                  v-for="row in objectRows"
                  :key="row.id"
                  class="type-visual-editor__tree-row"
                  :class="{
                    'is-selected': selectedRowId === row.id,
                    'is-resolved': !row.local,
                  }"
                  :draggable="!props.readonly && row.local && row.fieldPath != null"
                  @click="selectedRowId = row.id"
                  @dragstart="row.fieldPath && startObjectDrag(row.fieldPath, $event)"
                  @dragover.prevent
                  @drop.prevent="row.fieldPath && dropObjectField(row.fieldPath)"
                >
                  <div class="type-visual-editor__tree-main" :style="{ paddingLeft: `${18 + row.depth * 22}px` }">
                    <GripVertical v-if="row.local && !props.readonly" class="type-visual-editor__drag size-3.5" />
                    <span v-else class="w-3.5 shrink-0" />
                    <button
                      type="button"
                      class="type-visual-editor__chevron"
                      :class="!row.hasChildren ? 'invisible' : ''"
                      @click.stop="toggleExpanded(row)"
                    >
                      <ChevronDown v-if="isExpanded(row)" class="size-3.5" />
                      <ChevronRight v-else class="size-3.5" />
                    </button>
                    <Input
                      v-if="row.local && !props.readonly"
                      :model-value="row.field.key"
                      class="type-visual-editor__name-input"
                      @click.stop
                      @change="updateObjectFieldName(row, ($event.target as HTMLInputElement).value)"
                    />
                    <button
                      v-else
                      type="button"
                      class="type-visual-editor__resolved-name"
                      @click.stop="selectedRowId = row.id"
                    >
                      {{ row.field.key }}
                    </button>
                    <span class="type-visual-editor__colon">:</span>
                    <div
                      v-if="row.local && !props.readonly && row.fieldPath && canSelectFieldType(row.field)"
                      class="contents"
                      @click.capture="openTypeFromModifiedClick(row.field.type, $event)"
                    >
                      <SearchableSelect
                        :model-value="fieldTypeSelectionValue(row.field)"
                        :options="typeSelectOptions"
                        :trigger-class="['type-visual-editor__type-select', 'text-[11px]', expressionTone(row.field.type)]"
                        content-max-height="min(420px, 62vh)"
                        size="compact"
                        @update:model-value="value => updateObjectFieldType(row.fieldPath!, String(value))"
                      />
                    </div>
                    <span
                      v-else-if="row.local"
                      class="type-visual-editor__type-link"
                      :class="expressionTone(row.field.type)"
                    >
                      {{ expressionLabel(row.field.type) }}
                    </span>
                    <button
                      v-else-if="row.field.type.kind === 'reference'"
                      type="button"
                      class="type-visual-editor__type-link"
                      :class="expressionTone(row.field.type)"
                      @click.stop="emit('open:type', row.field.type.identity)"
                    >
                      {{ row.field.type.identity }}
                    </button>
                    <span v-else class="type-visual-editor__type-link" :class="expressionTone(row.field.type)">
                      {{ expressionLabel(row.field.type) }}
                    </span>
                    <span v-if="row.field.array" class="type-visual-editor__modifier">[]</span>
                    <span v-if="row.field.optional" class="type-visual-editor__modifier">optional</span>
                    <span v-if="row.cycle" class="type-visual-editor__modifier">recursive</span>
                    <div class="flex-1" />
                    <div class="type-visual-editor__row-actions">
                      <template v-if="row.local && !props.readonly">
                        <DropdownMenu>
                          <DropdownMenuTrigger as-child>
                            <button
                              type="button"
                              aria-label="Настройки поля"
                              title="Настройки поля"
                              @click.stop
                            >
                              <EllipsisVertical class="size-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" class="w-52">
                            <DropdownMenuCheckboxItem
                              :model-value="row.field.array"
                              @update:model-value="value => row.fieldPath && updateObjectField(row.fieldPath, { array: value === true })"
                            >
                              Массив
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem
                              :model-value="row.field.optional"
                              @update:model-value="value => row.fieldPath && updateObjectField(row.fieldPath, { optional: value === true })"
                            >
                              Опциональное
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuSeparator v-if="props.allowFieldDescriptions" />
                            <DropdownMenuItem v-if="props.allowFieldDescriptions" @select="openDescriptionDialog(row)">
                              Добавить описание
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <button
                          v-if="row.field.type.kind === 'object' && row.fieldPath"
                          type="button"
                          aria-label="Add nested field"
                          title="Add nested field"
                          @click.stop="addObjectField(row.fieldPath)"
                        >
                          <Plus class="size-3.5" />
                        </button>
                        <button type="button" aria-label="Duplicate field" @click.stop="row.fieldPath && duplicateObjectField(row.fieldPath)">
                          <Copy class="size-3.5" />
                        </button>
                        <button type="button" aria-label="Delete field" @click.stop="row.fieldPath && removeObjectField(row.fieldPath)">
                          <Trash2 class="size-3.5" />
                        </button>
                      </template>
                      <button v-else-if="!row.local" type="button" aria-label="Open referenced type" @click.stop="emit('open:type', row.ownerIdentity)">
                        <ExternalLink class="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <button v-if="!objectRows.length && !props.readonly" type="button" class="type-visual-editor__empty-row" @click="addObjectField()">
                  <Plus class="size-4" />
                  Create the first property
                </button>
              </div>

              <div v-else-if="definition.kind === 'enum'" class="type-visual-editor__list">
                <div
                  v-for="(value, index) in definition.values"
                  :key="`${typeof value}:${String(value)}:${index}`"
                  class="type-visual-editor__list-row"
                  draggable="true"
                  @dragstart="draggedListIndex = index"
                  @dragover.prevent
                  @drop.prevent="moveListItem(index)"
                >
                  <GripVertical class="size-3.5 text-muted-foreground/50" />
                  <CircleDot class="size-3.5 text-emerald-500" />
                  <Input
                    v-if="typeof value !== 'boolean'"
                    :model-value="String(value)"
                    class="h-7 flex-1 border-transparent font-mono text-xs shadow-none"
                    @change="updateEnumValue(index, ($event.target as HTMLInputElement).value)"
                  />
                  <Select v-else :model-value="String(value)" @update:model-value="next => updateEnumValue(index, String(next))">
                    <SelectTrigger class="h-7 flex-1 border-transparent shadow-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">
                        true
                      </SelectItem>
                      <SelectItem value="false">
                        false
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <span class="type-visual-editor__value-kind">{{ typeof value }}</span>
                  <Button variant="ghost" size="icon" class="size-7" :disabled="definition.values.length <= 1" @click="removeListItem(index)">
                    <Trash2 class="size-3.5" />
                  </Button>
                </div>
              </div>

              <div v-else-if="definition.kind === 'union'" class="type-visual-editor__list">
                <div
                  v-for="(variant, index) in definition.variants"
                  :key="`${expressionLabel(variant)}:${index}`"
                  class="type-visual-editor__list-row"
                  draggable="true"
                  @dragstart="draggedListIndex = index"
                  @dragover.prevent
                  @drop.prevent="moveListItem(index)"
                >
                  <GripVertical class="size-3.5 text-muted-foreground/50" />
                  <Braces class="size-3.5 text-violet-500" />
                  <SearchableSelect
                    v-if="variant.kind === 'reference'"
                    :model-value="variant.identity"
                    :options="referenceTypeSelectOptions"
                    trigger-class="h-7 flex-1 border-transparent shadow-none"
                    content-max-height="min(420px, 62vh)"
                    size="compact"
                    @update:model-value="value => updateUnionVariant(index, String(value))"
                  />
                  <span v-else class="type-visual-editor__inline-expression">
                    {{ expressionLabel(variant) }}
                  </span>
                  <Button v-if="variant.kind === 'reference'" variant="ghost" size="icon" class="size-7" @click="emit('open:type', variant.identity)">
                    <ExternalLink class="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" class="size-7" :disabled="definition.variants.length <= 2" @click="removeListItem(index)">
                    <Trash2 class="size-3.5" />
                  </Button>
                </div>
              </div>

              <div v-else class="type-visual-editor__array-row">
                <span class="type-visual-editor__array-bracket">[ ]</span>
                <span>items:</span>
                <SearchableSelect
                  v-if="definition.items.kind === 'reference'"
                  :model-value="definition.items.identity"
                  :options="referenceTypeSelectOptions"
                  trigger-class="h-7 w-56 border-transparent shadow-none"
                  content-max-height="min(420px, 62vh)"
                  size="compact"
                  @update:model-value="value => mutateDocument(document => {
                    if (document.definition.kind === 'array') document.definition.items = { kind: 'reference', identity: String(value) }
                  })"
                />
                <span v-else class="type-visual-editor__inline-expression">
                  {{ expressionLabel(definition.items) }}
                </span>
              </div>
            </div>
          </div>
        </section>

        <div
          v-if="showPreview || showExample"
          class="type-visual-editor__splitter"
          :data-resizing="isSplitResizing && activeDividerIndex === 0"
          role="separator"
          aria-label="Изменить ширину панели схемы"
          aria-orientation="vertical"
          :aria-valuenow="Math.round(dividerBoundary(0) * 100)"
          aria-valuemin="12"
          aria-valuemax="88"
          tabindex="0"
          @pointerdown="beginSplitResize(0, $event)"
          @keydown.stop="resizeSplitByKeyboard(0, $event)"
        >
          <span />
        </div>

        <section v-if="showPreview" class="type-visual-editor__docs-pane" :style="panelStyle(1)">
          <div class="type-visual-editor__docs-scroll">
            <div class="type-visual-editor__docs-layout">
              <main class="type-visual-editor__property-docs">
                <template v-if="definition.kind === 'object'">
                  <article
                    v-for="row in objectRows"
                    :key="`docs:${row.id}`"
                    class="type-visual-editor__property-doc"
                    :class="{ 'is-nested': row.depth > 0, 'is-active': selectedRowId === row.id }"
                    :style="{ marginLeft: `${row.depth * 10}px` }"
                    @click="selectedRowId = row.id"
                  >
                    <div class="type-visual-editor__property-title">
                      <strong>{{ row.field.key }}</strong>
                      <button
                        type="button"
                        class="type-visual-editor__preview-type"
                        :class="[expressionTone(row.field.type), { 'is-openable': canOpenReferencedType(row.field.type) }]"
                        :title="canOpenReferencedType(row.field.type) ? 'Cmd/Ctrl + click: открыть тип' : undefined"
                        @click="openTypeFromModifiedClick(row.field.type, $event)"
                      >
                        {{ row.field.array ? `array[${expressionLabel(row.field.type)}]` : expressionLabel(row.field.type) }}
                      </button>
                      <em v-if="!row.field.optional">required</em>
                    </div>
                    <p v-if="row.field.description">
                      {{ row.field.description }}
                    </p>
                    <p v-else class="is-placeholder">
                      No description
                    </p>
                    <div v-if="row.field.min != null || row.field.max != null || row.field.examples.length" class="type-visual-editor__doc-meta">
                      <span v-if="row.field.min != null">≥ {{ row.field.min }}</span>
                      <span v-if="row.field.max != null">≤ {{ row.field.max }}</span>
                      <template v-for="(example, index) in row.field.examples" :key="index">
                        <span>Example: {{ JSON.stringify(example) }}</span>
                      </template>
                    </div>
                  </article>
                </template>

                <article v-else-if="definition.kind === 'enum'" class="type-visual-editor__definition-doc">
                  <strong>Allowed values</strong>
                  <div class="type-visual-editor__doc-values">
                    <code v-for="(value, index) in definition.values" :key="index">{{ JSON.stringify(value) }}</code>
                  </div>
                </article>

                <article v-else-if="definition.kind === 'union'" class="type-visual-editor__definition-doc">
                  <strong>Union variants</strong>
                  <div class="type-visual-editor__doc-values">
                    <button
                      v-for="(variant, index) in definition.variants"
                      :key="index"
                      type="button"
                      :class="{ 'is-openable': canOpenReferencedType(variant) }"
                      :title="canOpenReferencedType(variant) ? 'Cmd/Ctrl + click: открыть тип' : undefined"
                      @click="openTypeFromModifiedClick(variant, $event)"
                    >
                      <code>{{ expressionLabel(variant) }}</code>
                    </button>
                  </div>
                </article>

                <article v-else class="type-visual-editor__definition-doc">
                  <strong>Array item type</strong>
                  <div class="type-visual-editor__doc-values">
                    <button
                      type="button"
                      :class="{ 'is-openable': canOpenReferencedType(definition.items) }"
                      :title="canOpenReferencedType(definition.items) ? 'Cmd/Ctrl + click: открыть тип' : undefined"
                      @click="openTypeFromModifiedClick(definition.items, $event)"
                    >
                      <code>{{ expressionLabel(definition.items) }}</code>
                    </button>
                  </div>
                </article>
              </main>
            </div>

            <div v-if="warningDiagnostics.length" class="type-visual-editor__warnings">
              <AlertCircle class="mt-0.5 size-3.5 shrink-0" />
              <div class="space-y-1">
                <div v-for="warning in warningDiagnostics" :key="warning.code" class="text-[11px] leading-4">
                  {{ warning.message }}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div
          v-if="showPreview && showExample"
          class="type-visual-editor__splitter"
          :data-resizing="isSplitResizing && activeDividerIndex === 1"
          role="separator"
          aria-label="Изменить ширину панелей Preview и Example"
          aria-orientation="vertical"
          :aria-valuenow="Math.round(dividerBoundary(1) * 100)"
          aria-valuemin="12"
          aria-valuemax="88"
          tabindex="0"
          @pointerdown="beginSplitResize(1, $event)"
          @keydown.stop="resizeSplitByKeyboard(1, $event)"
        >
          <span />
        </div>

        <section v-if="showExample" class="type-visual-editor__example-pane" :style="panelStyle(showPreview ? 2 : 1)">
          <div class="type-visual-editor__example-card">
            <div class="type-visual-editor__example-head">
              <span>Example</span>
              <span>JSON</span>
            </div>
            <pre>{{ exampleJson }}</pre>
          </div>
        </section>
      </div>
    </template>

    <Dialog v-model:open="descriptionDialogOpen">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Описание поля {{ descriptionDialogFieldName }}</DialogTitle>
          <DialogDescription>
            Текст будет отображаться под полем в Preview и сохранится в Type Source.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          v-model="descriptionDraft"
          class="min-h-32 resize-y text-sm leading-6"
          placeholder="Введите описание поля…"
        />
        <DialogFooter class="gap-2">
          <Button variant="outline" @click="descriptionDialogOpen = false">
            Отмена
          </Button>
          <Button @click="saveDescription">
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
.type-visual-editor {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  background: var(--editor-surface, var(--background));
}

.type-visual-editor__value-kind {
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  line-height: 1;
  white-space: nowrap;
}

.type-visual-editor__workspace {
  display: flex;
  min-height: 0;
  flex: 1;
}

.type-visual-editor__schema-pane,
.type-visual-editor__docs-pane,
.type-visual-editor__example-pane {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  background: var(--background);
}

.type-visual-editor__splitter {
  position: relative;
  z-index: 4;
  display: flex;
  width: 7px;
  min-height: 0;
  flex: 0 0 7px;
  align-items: center;
  justify-content: center;
  border-right: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  border-left: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  background: color-mix(in srgb, var(--muted) 30%, transparent);
  cursor: ew-resize;
  outline: none;
}

.type-visual-editor__splitter span {
  width: 2px;
  height: 32px;
  background: color-mix(in srgb, var(--muted-foreground) 34%, transparent);
  transition: height 120ms ease, background-color 120ms ease;
}

.type-visual-editor__splitter:hover span,
.type-visual-editor__splitter:focus-visible span,
.type-visual-editor__splitter[data-resizing='true'] span {
  height: 48px;
  background: #27a8e0;
}

.type-visual-editor__schema-scroll,
.type-visual-editor__docs-scroll { min-height: 0; flex: 1; overflow: auto; }
.type-visual-editor__schema-scroll { padding: 10px; }

.type-visual-editor__schema-card {
  overflow: hidden;
}

.type-visual-editor__root-row {
  display: flex;
  height: 36px;
  align-items: center;
  gap: 6px;
  border-bottom: 1px solid var(--border);
  padding: 0 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
}

.type-visual-editor__root-kind { color: #e34e79; }
.type-visual-editor__root-count { color: var(--muted-foreground); }
.type-visual-editor__tiny-action { display: inline-flex; height: 24px; width: 24px; align-items: center; justify-content: center; color: var(--muted-foreground); }
.type-visual-editor__tiny-action:hover { background: var(--muted); color: var(--foreground); }

.type-visual-editor__tree-row { position: relative; min-height: 34px; border-bottom: 1px solid color-mix(in srgb, var(--border) 65%, transparent); transition: background-color 100ms ease; }
.type-visual-editor__tree-row:last-child { border-bottom: 0; }
.type-visual-editor__tree-row:hover { background: color-mix(in srgb, #27a8e0 4%, var(--background)); }
.type-visual-editor__tree-row.is-selected { background: color-mix(in srgb, #27a8e0 7%, var(--background)); box-shadow: inset 2px 0 #27a8e0; }
.type-visual-editor__tree-row.is-resolved { background-image: linear-gradient(90deg, color-mix(in srgb, #8b5cf6 5%, transparent), transparent 45%); }

.type-visual-editor__tree-main {
  display: flex;
  min-width: 0;
  min-height: 34px;
  align-items: center;
  gap: 4px;
  padding-right: 7px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10.5px;
}

.type-visual-editor__tree-main::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 13px;
  width: 1px;
  background: color-mix(in srgb, var(--border) 85%, transparent);
  content: '';
}

.type-visual-editor__drag { flex-shrink: 0; cursor: grab; color: color-mix(in srgb, var(--muted-foreground) 48%, transparent); }
.type-visual-editor__drag:active { cursor: grabbing; }
.type-visual-editor__chevron { display: flex; height: 18px; width: 18px; flex-shrink: 0; align-items: center; justify-content: center; color: var(--muted-foreground); }
.type-visual-editor__chevron:hover { background: var(--muted); color: var(--foreground); }
.type-visual-editor__name-input { height: 25px; min-width: 88px; max-width: 180px; flex: 0 1 180px; border-color: transparent; background: transparent; padding: 0 3px; font-family: inherit; font-size: 10.5px; box-shadow: none; }
.type-visual-editor__name-input:hover { border-color: var(--border); }
.type-visual-editor__resolved-name { overflow: hidden; max-width: 180px; color: var(--foreground); text-overflow: ellipsis; white-space: nowrap; }
.type-visual-editor__colon { color: var(--muted-foreground); }
.type-visual-editor__type-select { height: 25px; min-width: 90px; max-width: 160px; border-color: transparent; background: transparent; padding: 0 5px; font-family: inherit; font-size: 11px; font-weight: 500; box-shadow: none; }
.type-visual-editor__type-link { overflow: hidden; max-width: 150px; text-overflow: ellipsis; white-space: nowrap; }
.type-visual-editor__type--string { color: #0b9a6d; }
.type-visual-editor__type--number { color: #dc7625; }
.type-visual-editor__type--boolean { color: #c74b86; }
.type-visual-editor__type--reference { color: #258ac3; }
.type-visual-editor__type--inline { color: #8b5cf6; font-weight: 600; }
.type-visual-editor__type--neutral { color: var(--muted-foreground); }
.type-visual-editor__modifier { border: 1px solid var(--border); padding: 2px 4px; color: var(--muted-foreground); font-size: 9px; line-height: 1; }
.type-visual-editor__row-actions { display: flex; align-items: center; opacity: .4; }
.type-visual-editor__row-actions button { display: inline-flex; height: 25px; width: 25px; align-items: center; justify-content: center; color: var(--muted-foreground); }
.type-visual-editor__row-actions button:hover { background: var(--muted); color: var(--foreground); }
.type-visual-editor__row-actions button:last-child:hover { color: var(--destructive); }
.type-visual-editor__tree-row:hover .type-visual-editor__row-actions,
.type-visual-editor__tree-row.is-selected .type-visual-editor__row-actions { opacity: 1; }

.type-visual-editor__empty-row { display: flex; min-height: 92px; width: 100%; align-items: center; justify-content: center; gap: 8px; color: var(--muted-foreground); font-size: 12px; }
.type-visual-editor__empty-row:hover { background: var(--muted); color: var(--foreground); }

.type-visual-editor__list { padding: 3px 8px; }
.type-visual-editor__list-row { display: flex; align-items: center; gap: 7px; padding: 4px; }
.type-visual-editor__list-row + .type-visual-editor__list-row { border-top: 1px solid color-mix(in srgb, var(--border) 65%, transparent); }
.type-visual-editor__list-row:hover { background: color-mix(in srgb, #0ea5e9 4%, transparent); }
.type-visual-editor__value-kind { background: var(--muted); padding: 4px 7px; color: var(--muted-foreground); font-family: ui-monospace, monospace; }
.type-visual-editor__array-row { display: flex; align-items: center; gap: 8px; padding: 10px 18px; font-family: ui-monospace, monospace; font-size: 11px; }
.type-visual-editor__array-bracket { color: #e34e79; }
.type-visual-editor__inline-expression { flex: 1; color: #8b5cf6; font-family: ui-monospace, monospace; font-size: 11px; font-weight: 600; }

.type-visual-editor__docs-scroll { padding: 10px; }
.type-visual-editor__docs-layout { display: grid; grid-template-columns: minmax(0, 1fr); align-items: start; }

.type-visual-editor__property-docs { min-width: 0; }
.type-visual-editor__property-doc { position: relative; border-left: 1px solid transparent; padding: 8px 0 9px 8px; cursor: pointer; }
.type-visual-editor__property-doc.is-nested { border-left-color: var(--border); }
.type-visual-editor__property-doc.is-active { border-left-color: #27a8e0; }
.type-visual-editor__property-title { display: flex; min-width: 0; align-items: baseline; gap: 7px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10.5px; }
.type-visual-editor__property-title strong { overflow: hidden; color: var(--foreground); font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.type-visual-editor__preview-type { border: 0; background: transparent; padding: 0; font-size: 9.5px; text-align: left; white-space: nowrap; }
.type-visual-editor__property-title em { margin-left: auto; color: #e88735; font-family: inherit; font-size: 9px; font-style: normal; }
.type-visual-editor__property-doc p { margin-top: 5px; color: var(--muted-foreground); font-size: 10px; line-height: 1.5; }
.type-visual-editor__property-doc p.is-placeholder { opacity: .46; }
.type-visual-editor__doc-meta { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.type-visual-editor__doc-meta span,
.type-visual-editor__doc-values code { border: 1px solid var(--border); background: color-mix(in srgb, var(--muted) 38%, var(--background)); padding: 2px 5px; color: var(--muted-foreground); font-family: ui-monospace, monospace; font-size: 8.5px; }

.type-visual-editor__definition-doc { padding-top: 10px; }
.type-visual-editor__definition-doc > strong { font-size: 12px; }
.type-visual-editor__doc-values { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.type-visual-editor__doc-values button { border: 0; background: transparent; padding: 0; }

.type-visual-editor__example-card { display: flex; height: 100%; min-width: 0; min-height: 0; flex-direction: column; overflow: hidden; background: color-mix(in srgb, #dce6f2 48%, var(--background)); }
.type-visual-editor__example-head { display: flex; height: 42px; flex-shrink: 0; align-items: center; justify-content: space-between; border-bottom: 1px solid color-mix(in srgb, #94a3b8 25%, var(--border)); background: color-mix(in srgb, #cbd8e8 58%, var(--background)); padding: 0 14px; color: var(--muted-foreground); font-size: 9px; }
.type-visual-editor__example-head span:first-child { color: var(--foreground); font-weight: 600; }
.type-visual-editor__example-card pre { min-height: 0; flex: 1; overflow: auto; padding: 10px; color: color-mix(in srgb, var(--foreground) 88%, #2563eb); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; line-height: 1.62; tab-size: 2; }
.type-visual-editor__warnings { display: flex; gap: 8px; margin: 18px; border: 1px solid color-mix(in srgb, #f59e0b 24%, var(--border)); border-radius: 7px; background: color-mix(in srgb, #f59e0b 7%, transparent); padding: 10px; color: #d97706; }

.type-visual-editor__invalid { display: flex; flex: 1; align-items: flex-start; justify-content: center; gap: 14px; overflow: auto; padding: 72px 24px; }
.type-visual-editor__invalid-icon { display: flex; height: 38px; width: 38px; flex-shrink: 0; align-items: center; justify-content: center; border-radius: 9px; background: color-mix(in srgb, var(--destructive) 10%, transparent); color: var(--destructive); }
</style>
