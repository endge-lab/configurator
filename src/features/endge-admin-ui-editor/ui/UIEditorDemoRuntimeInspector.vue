<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { UIEditorDemoState } from '@/features/endge-admin-ui-editor/entities/ui-editor-demo-state'
import type { UIEditorNode } from '@/features/endge-admin-ui-editor/types'

import { Code2, LockKeyhole, Trash2, X } from 'lucide-vue-next'
import { computed } from 'vue'

import { Button } from '@/components/ui/button'
import {
  getUIEditorSFCAttributeBindings,
  getUIEditorSFCSourceAttributes,
  getUIEditorSFCSourceDirectives,
  getUIEditorSFCSourceTag,
  hasUIEditorSFCTextBinding,
} from '@/features/endge-admin-ui-editor/entities/ui-editor-sfc-bindings'
import { getUIEditorSFCDefinitionContract } from '@/features/endge-admin-ui-editor/entities/ui-editor-sfc-contract'

interface ManagedProperty {
  key: string
  label: string
  type: 'text' | 'number' | 'boolean' | 'select'
  options?: Array<{ label: string, value: string }>
}

const props = defineProps<{
  state: UIEditorDemoState
}>()

const emit = defineEmits<{
  close: []
}>()

const selectedNode = computed<UIEditorNode | null>(() => props.state.getSelectedNode())
const selectedTag = computed(() => {
  const node = selectedNode.value
  if (!node) {
    return 'Element'
  }
  return getUIEditorSFCSourceTag(node)
    ?? getUIEditorSFCDefinitionContract(node.definitionRef)?.tag
    ?? node.name
})
const sourceAttributes = computed(() => getUIEditorSFCSourceAttributes(selectedNode.value))
const staticAttributes = computed(() => sourceAttributes.value.filter(attribute =>
  !attribute.dynamic && !['colStart', 'colSpan', 'rowStart', 'rowSpan'].includes(attribute.name),
))
const dynamicAttributes = computed(() => getUIEditorSFCAttributeBindings(selectedNode.value))
const sourceDirectives = computed(() => getUIEditorSFCSourceDirectives(selectedNode.value))
const parentNode = computed(() => selectedNode.value ? props.state.getParentNode(selectedNode.value.id) : null)
const hasGridPlacement = computed(() => selectedNode.value?.kind !== 'page'
  && (parentNode.value?.kind === 'grid'
    || (parentNode.value?.kind === 'page' && parentNode.value.props.layoutMode === 'grid')))
const managedProperties = computed<ManagedProperty[]>(() => {
  const node = selectedNode.value
  if (!node) {
    return []
  }
  if (node.kind === 'page') {
    return node.props.layoutMode === 'grid'
      ? [
          { key: 'columns', label: 'Колонки', type: 'number' },
          { key: 'gap', label: 'Отступ', type: 'number' },
          { key: 'padding', label: 'Padding', type: 'number' },
          { key: 'rowHeight', label: 'Высота строки', type: 'number' },
        ]
      : flexProperties(true)
  }
  if (node.kind === 'flex') {
    return flexProperties(false)
  }
  if (node.kind === 'grid') {
    return [
      { key: 'columns', label: 'Колонки', type: 'number' },
      { key: 'gap', label: 'Отступ', type: 'number' },
      { key: 'padding', label: 'Padding', type: 'number' },
      { key: 'rowHeight', label: 'Высота строки', type: 'number' },
    ]
  }
  if (node.kind === 'box') {
    return [{ key: 'padding', label: 'Padding', type: 'number' }]
  }
  return []
})

function flexProperties(includeLayoutMode: boolean): ManagedProperty[] {
  return [
    ...(includeLayoutMode
      ? [{
          key: 'layoutMode',
          label: 'Layout',
          type: 'select' as const,
          options: [
            { label: 'Flex', value: 'flex' },
            { label: 'Grid', value: 'grid' },
          ],
        }]
      : []),
    {
      key: 'direction',
      label: 'Направление',
      type: 'select',
      options: [
        { label: 'Row', value: 'row' },
        { label: 'Column', value: 'column' },
      ],
    },
    { key: 'align', label: 'Align', type: 'text' },
    { key: 'justify', label: 'Justify', type: 'text' },
    { key: 'wrap', label: 'Перенос', type: 'boolean' },
    { key: 'gap', label: 'Отступ', type: 'number' },
    { key: 'padding', label: 'Padding', type: 'number' },
  ]
}

function inputValue(event: Event): string {
  return event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement
    ? event.target.value
    : ''
}

function inputChecked(event: Event): boolean {
  return event.target instanceof HTMLInputElement && event.target.checked
}

function patchManagedProperty(property: ManagedProperty, event: Event): void {
  const node = selectedNode.value
  if (!node) {
    return
  }
  const value = property.type === 'boolean'
    ? inputChecked(event)
    : property.type === 'number'
      ? Number(inputValue(event))
      : inputValue(event) || null
  props.state.patchNodeProps(node.id, { [property.key]: value })
}

function patchTextContent(event: Event): void {
  const node = selectedNode.value
  if (!node || (node.kind !== 'text' && node.kind !== 'button')) {
    return
  }
  props.state.patchNodeProps(node.id, node.kind === 'text'
    ? { text: inputValue(event) }
    : { label: inputValue(event) })
}

function patchStaticAttribute(name: string, event: Event, booleanAttribute: boolean): void {
  const node = selectedNode.value
  if (!node) {
    return
  }
  props.state.patchNodeSourceAttribute(
    node.id,
    name,
    booleanAttribute ? inputChecked(event) : inputValue(event),
  )
}

function patchLayout(key: 'colStart' | 'rowStart' | 'span' | 'rowSpan', event: Event): void {
  const node = selectedNode.value
  if (!node) {
    return
  }
  props.state.patchNodeLayout(node.id, { [key]: Number(inputValue(event)) })
}

function removeSelected(): void {
  const node = selectedNode.value
  if (!node || node.id === props.state.document.rootId) {
    return
  }
  props.state.removeNode(node.id)
  emit('close')
}
</script>

<template>
  <aside
    v-if="selectedNode"
    class="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-border/80 bg-background/96 text-foreground shadow-[0_24px_70px_rgba(15,23,42,0.24)] backdrop-blur-xl"
    data-ui-editor-control
  >
    <header class="flex shrink-0 items-start gap-3 border-b border-border/70 px-4 py-3">
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-semibold">
          {{ selectedTag }}
        </div>
        <div class="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
          {{ selectedNode.id }}
        </div>
      </div>
      <Button variant="ghost" size="icon" class="-mr-1 size-7" title="Закрыть настройки" @click="emit('close')">
        <X class="size-3.5" />
      </Button>
    </header>

    <div class="min-h-0 flex-1 space-y-5 overflow-auto p-4">
      <section v-if="(selectedNode.kind === 'text' || selectedNode.kind === 'button')">
        <div class="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Содержимое
        </div>
        <div v-if="selectedNode.kind === 'text' && hasUIEditorSFCTextBinding(selectedNode)" class="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
          <LockKeyhole class="mt-0.5 size-3.5 shrink-0" />
          Текст вычисляется выражением и редактируется в Source.
        </div>
        <textarea
          v-else
          class="min-h-20 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15"
          :value="selectedNode.kind === 'text' ? selectedNode.props.text : selectedNode.props.label"
          @change="patchTextContent"
        />
      </section>

      <section v-if="managedProperties.length">
        <div class="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Layout
        </div>
        <div class="grid grid-cols-2 gap-3">
          <label v-for="property in managedProperties" :key="property.key" class="min-w-0 space-y-1.5 text-xs">
            <span class="block truncate text-muted-foreground">{{ property.label }}</span>
            <input
              v-if="property.type === 'boolean'"
              type="checkbox"
              class="size-4 rounded border-input accent-sky-500"
              :checked="Boolean(selectedNode.props[property.key])"
              @change="patchManagedProperty(property, $event)"
            >
            <select
              v-else-if="property.type === 'select'"
              class="h-9 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-sky-500"
              :value="String(selectedNode.props[property.key] ?? '')"
              @change="patchManagedProperty(property, $event)"
            >
              <option v-for="option in property.options" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
            <input
              v-else
              :type="property.type"
              class="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs outline-none focus:border-sky-500"
              :value="selectedNode.props[property.key] ?? ''"
              @change="patchManagedProperty(property, $event)"
            >
          </label>
        </div>
      </section>

      <section v-if="hasGridPlacement && selectedNode.layout">
        <div class="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Grid placement
        </div>
        <div class="grid grid-cols-2 gap-3">
          <label
            v-for="field in [
              { key: 'colStart', label: 'Колонка', value: selectedNode.layout.colStart },
              { key: 'span', label: 'Ширина', value: selectedNode.layout.span },
              { key: 'rowStart', label: 'Строка', value: selectedNode.layout.rowStart },
              { key: 'rowSpan', label: 'Высота', value: selectedNode.layout.rowSpan },
            ]" :key="field.key" class="space-y-1.5 text-xs"
          >
            <span class="block text-muted-foreground">{{ field.label }}</span>
            <input
              type="number"
              min="1"
              class="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs outline-none focus:border-sky-500"
              :value="field.value"
              @change="patchLayout(field.key as 'colStart' | 'rowStart' | 'span' | 'rowSpan', $event)"
            >
          </label>
        </div>
      </section>

      <section v-if="staticAttributes.length || dynamicAttributes.length || sourceDirectives.length">
        <div class="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <Code2 class="size-3" />
          SFC attributes
        </div>
        <div class="space-y-3">
          <label v-for="attribute in staticAttributes" :key="attribute.name" class="block space-y-1.5 text-xs">
            <span class="font-mono text-muted-foreground">{{ attribute.name }}</span>
            <input
              v-if="attribute.value == null"
              type="checkbox"
              class="block size-4 rounded border-input accent-sky-500"
              checked
              @change="patchStaticAttribute(attribute.name, $event, true)"
            >
            <input
              v-else
              type="text"
              class="h-9 w-full rounded-md border border-input bg-background px-2.5 font-mono text-xs outline-none focus:border-sky-500"
              :value="attribute.value"
              @change="patchStaticAttribute(attribute.name, $event, false)"
            >
          </label>

          <div v-for="binding in dynamicAttributes" :key="binding.name" class="rounded-md border border-border/70 bg-muted/25 p-2.5">
            <div class="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
              <LockKeyhole class="size-3" />
              :{{ binding.name }}
            </div>
            <div class="mt-1 break-all font-mono text-[11px] text-foreground/80">
              {{ binding.expression }}
            </div>
          </div>

          <div v-for="directive in sourceDirectives" :key="directive.raw" class="rounded-md border border-border/70 bg-muted/25 px-2.5 py-2 font-mono text-[11px] text-muted-foreground">
            {{ directive.raw }}
          </div>
        </div>
      </section>
    </div>

    <footer v-if="selectedNode.id !== props.state.document.rootId" class="shrink-0 border-t border-border/70 p-3">
      <Button variant="ghost" class="h-8 w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive" @click="removeSelected">
        <Trash2 class="mr-2 size-3.5" />
        Удалить элемент
      </Button>
    </footer>
  </aside>
</template>
