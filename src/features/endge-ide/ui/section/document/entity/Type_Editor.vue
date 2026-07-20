<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { RFieldEditor } from '@/features/endge-ide/domain/entities/RFieldEditor'
import type { RTypeEditor } from '@/features/endge-ide/domain/entities/RTypeEditor'
import type { DomainDocumentType } from '@endge/core'

import { Endge } from '@endge/core'
import { useDomainStore } from '@endge/ui-vue'
import { Code2, ExternalLink, Eye, FileJson2, FilePenLine, ListTree, Loader2, Plus, RotateCcw, Save, Settings2 } from 'lucide-vue-next'
import { computed, reactive, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useSmartTabSelection, useSmartTabSharedViewState } from '@/components/ui/smart-tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { RFieldEditor as RFieldEditorClass } from '@/features/endge-ide/domain/entities/RFieldEditor'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'
import TypeSourceEditor from '@/features/endge-ide/ui/components/TypeSourceEditor.vue'
import TypeVisualEditor from '@/features/endge-ide/ui/components/TypeVisualEditor.vue'

type TypeVisualLayoutKey = 'schema' | 'schema-preview' | 'schema-example' | 'schema-preview-example'

interface TypeVisualWorkspaceState {
  showPreview: boolean
  showExample: boolean
  layouts: Record<TypeVisualLayoutKey, number[]>
}

const TYPE_VISUAL_DEFAULT_LAYOUTS: TypeVisualWorkspaceState['layouts'] = {
  'schema': [1],
  'schema-preview': [0.48, 0.52],
  'schema-example': [0.58, 0.42],
  'schema-preview-example': [0.42, 0.36, 0.22],
}

function createTypeVisualWorkspaceState(): TypeVisualWorkspaceState {
  return {
    showPreview: true,
    showExample: true,
    layouts: Object.fromEntries(
      Object.entries(TYPE_VISUAL_DEFAULT_LAYOUTS).map(([key, sizes]) => [key, [...sizes]]),
    ) as TypeVisualWorkspaceState['layouts'],
  }
}

function isTypeVisualWorkspaceState(value: unknown): value is TypeVisualWorkspaceState {
  if (!value || typeof value !== 'object') {
    return false
  }
  const state = value as Partial<TypeVisualWorkspaceState>
  if (typeof state.showPreview !== 'boolean' || typeof state.showExample !== 'boolean' || !state.layouts) {
    return false
  }
  return Object.entries(TYPE_VISUAL_DEFAULT_LAYOUTS).every(([key, fallback]) => {
    const sizes = state.layouts?.[key as TypeVisualLayoutKey]
    return Array.isArray(sizes)
      && sizes.length === fallback.length
      && sizes.every(size => Number.isFinite(size) && size > 0)
  })
}

const editor = computed(() => EndgeIDE.tabs.documentEditorModel.value as RTypeEditor | null)
const domainStore = useDomainStore()
const activeTab = useSmartTabSelection(
  'editor.active-tab',
  'source',
  ['general', 'legacy', 'visual', 'source'] as const,
)
const tabs = [
  { value: 'general', label: 'Основное', icon: Settings2 },
  { value: 'legacy', label: 'Legacy Form', icon: FilePenLine },
  { value: 'visual', label: 'Visual', icon: ListTree },
  { value: 'source', label: 'Source', icon: Code2 },
] as const

const availableTypes = computed(() => {
  return domainStore.typeCatalog
    .map(type => ({ value: type.identity, label: type.displayName || type.identity }))
    .sort((left, right) => left.label.localeCompare(right.label))
})
const visualTypes = computed(() => domainStore.typeCatalog
  .map(type => ({
    identity: type.identity,
    label: type.displayName || type.identity,
    category: type.category,
    source: String(Endge.domain.getType(type.identity)?.source ?? ''),
  }))
  .filter(type => type.identity !== '')
  .sort((left, right) => {
    const order = { primitive: 0, reference: 1, user: 2 }
    return order[left.category] - order[right.category] || left.label.localeCompare(right.label)
  }))
const fieldRows = computed(() => editor.value?.fields ?? [])
const selectedIndices = ref<Set<number>>(new Set())
const visualWorkspaceState = useSmartTabSharedViewState<TypeVisualWorkspaceState>(
  'type-editor.visual-workspace',
  {
    version: 1,
    defaultValue: createTypeVisualWorkspaceState,
    validate: isTypeVisualWorkspaceState,
  },
)
const visualShowPreview = computed({
  get: () => visualWorkspaceState.value.showPreview,
  set: (value) => {
    visualWorkspaceState.value.showPreview = value
  },
})
const visualShowExample = computed({
  get: () => visualWorkspaceState.value.showExample,
  set: (value) => {
    visualWorkspaceState.value.showExample = value
  },
})
const visualLayoutKey = computed<TypeVisualLayoutKey>(() => {
  if (visualShowPreview.value && visualShowExample.value) {
    return 'schema-preview-example'
  }
  if (visualShowPreview.value) {
    return 'schema-preview'
  }
  if (visualShowExample.value) {
    return 'schema-example'
  }
  return 'schema'
})
const visualPanelSizes = computed(() => visualWorkspaceState.value.layouts[visualLayoutKey.value])
const allSelected = computed<boolean>({
  get: () => fieldRows.value.length > 0 && selectedIndices.value.size === fieldRows.value.length,
  set: (value) => {
    selectedIndices.value = value
      ? new Set(fieldRows.value.map((_, index) => index))
      : new Set()
  },
})

function isCustomType(typeName: string): boolean {
  return domainStore.typeCatalog.find(type => type.identity === typeName)?.category === 'user'
}

function toggleRow(index: number): void {
  const next = new Set(selectedIndices.value)
  if (next.has(index)) {
    next.delete(index)
  }
  else {
    next.add(index)
  }
  selectedIndices.value = next
}

function removeSelected(): void {
  if (!editor.value?.fields.length) {
    return
  }
  for (const index of [...selectedIndices.value].sort((left, right) => right - left)) {
    if (index >= 0 && index < editor.value.fields.length) {
      editor.value.fields.splice(index, 1)
    }
  }
  selectedIndices.value = new Set()
}

function getUniqueFieldName(baseName = 'field'): string {
  const fields = editor.value?.fields ?? []
  let name = baseName
  let suffix = 0
  while (fields.some(field => field.name === name)) {
    suffix += 1
    name = `${baseName}${suffix}`
  }
  return name
}

function addField(): void {
  if (!editor.value) {
    return
  }
  const field = reactive(RFieldEditorClass.createDefault()) as RFieldEditor
  field.name = getUniqueFieldName()
  editor.value.fields.push(field)
}

function renameField(row: RFieldEditor, nextRaw: string): void {
  if (!editor.value) {
    return
  }
  const nextName = String(nextRaw ?? '').trim()
  if (!nextName || nextName === row.name) {
    return
  }
  if (editor.value.fields.some(field => field !== row && field.name === nextName)) {
    toast.warning('Имя уже занято', { description: nextName })
    return
  }
  row.name = nextName
}

function changeRowField<K extends keyof RFieldEditor>(row: RFieldEditor, field: K, value: RFieldEditor[K]): void {
  row[field] = value
}

function openTypeDocument(typeId: string): void {
  const id = String(typeId).trim()
  if (!id) {
    toast.warning('Не указан тип')
    return
  }
  const type = Endge.domain.getType(id)
  if (type?.isPrimitive) {
    toast.info('Это примитивный тип')
    return
  }
  EndgeIDE.tabs.openDocument(id, 'type' as DomainDocumentType)
}

function updateTypeSource(value: string): void {
  editor.value?.applySourceText(value)
}

function updateVisualPanelSizes(sizes: number[]): void {
  visualWorkspaceState.value.layouts[visualLayoutKey.value] = [...sizes]
}
</script>

<template>
  <SourceDocumentEditorShell
    v-if="editor"
    :document-id="editor.id"
    :identity="editor.identity || editor.name"
  >
    <template #center>
      <TooltipProvider>
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip v-for="tab in tabs" :key="tab.value">
            <TooltipTrigger as-child>
              <Button
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                :class="activeTab === tab.value ? 'bg-editor-control shadow-sm' : 'text-muted-foreground'"
                :aria-label="tab.label"
                @click="activeTab = tab.value"
              >
                <component :is="tab.icon" class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ tab.label }}</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" class="mx-0.5 h-5" />
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                :disabled="EndgeIDE.busy.value"
                aria-label="Сохранить"
                @click="EndgeIDE.tabs.save()"
              >
                <Loader2 v-if="EndgeIDE.busy.value" class="size-4 animate-spin" />
                <Save v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Сохранить оба независимых формата</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </template>

    <template #right>
      <TooltipProvider v-if="activeTab === 'source'">
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                aria-label="Сбросить Type Source"
                @click="editor.resetSource()"
              >
                <RotateCcw class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Заменить source базовым примером</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      <TooltipProvider v-else-if="activeTab === 'visual'">
        <div class="flex items-center justify-end gap-1">
          <div class="flex items-center rounded-md border bg-muted/40 p-0.5" role="group" aria-label="Visual editor display options">
            <Button
              variant="ghost"
              size="sm"
              class="h-7 gap-1.5 px-2 text-[11px]"
              :class="visualShowPreview ? 'bg-editor-control text-sky-700 shadow-sm dark:text-sky-300' : 'text-muted-foreground'"
              :aria-pressed="visualShowPreview"
              @click="visualShowPreview = !visualShowPreview"
            >
              <Eye class="size-3.5" />
              Preview
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-7 gap-1.5 px-2 text-[11px]"
              :class="visualShowExample ? 'bg-editor-control text-sky-700 shadow-sm dark:text-sky-300' : 'text-muted-foreground'"
              :aria-pressed="visualShowExample"
              @click="visualShowExample = !visualShowExample"
            >
              <FileJson2 class="size-3.5" />
              Example
            </Button>
          </div>
        </div>
      </TooltipProvider>
    </template>

    <div class="min-h-0 flex-1 overflow-hidden">
      <div v-if="activeTab === 'general'" class="h-full overflow-auto p-6">
        <div class="max-w-xl space-y-5">
          <div class="space-y-2">
            <Label for="type-name">Название типа</Label>
            <Input id="type-name" v-model="editor.name" />
          </div>
          <div class="space-y-2">
            <Label for="type-source-version">Версия Type Source</Label>
            <Input id="type-source-version" :model-value="String(editor.sourceVersion)" disabled />
          </div>
        </div>
      </div>

      <div v-else-if="activeTab === 'legacy'" class="flex h-full min-h-0 flex-col">
        <div class="shrink-0 border-b bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
          Legacy Form и новый Source сохраняются независимо. Изменения здесь не обновляют Source.
        </div>
        <div class="flex min-h-0 flex-1 flex-col">
          <div class="flex items-center justify-between gap-2 border-b px-3 py-2">
            <button
              v-if="selectedIndices.size > 0"
              type="button"
              class="text-xs text-destructive underline hover:no-underline"
              @click="removeSelected"
            >
              удалить
            </button>
            <span v-else />
            <Button variant="outline" size="icon" class="size-8 shrink-0" @click="addField">
              <Plus class="size-4" />
            </Button>
          </div>

          <ScrollArea class="min-h-0 flex-1">
            <div class="p-4">
              <div class="overflow-hidden rounded-lg border">
                <div class="border-b bg-muted/40">
                  <div class="grid grid-cols-[40px_1fr_1fr_80px_100px_56px] gap-0 text-xs font-medium text-muted-foreground">
                    <div class="flex items-center justify-center px-2 py-2">
                      <Checkbox
                        :model-value="allSelected"
                        :indeterminate="selectedIndices.size > 0 && !allSelected"
                        @update:model-value="value => (allSelected = value === true)"
                      />
                    </div>
                    <div class="px-3 py-2">
                      Название
                    </div>
                    <div class="px-3 py-2">
                      Тип
                    </div>
                    <div class="px-3 py-2">
                      Массив
                    </div>
                    <div class="px-3 py-2">
                      Необязательное
                    </div>
                    <div class="px-3 py-2">
                      Метод
                    </div>
                  </div>
                </div>

                <div class="divide-y">
                  <div
                    v-for="(row, index) in fieldRows"
                    :key="index"
                    class="grid grid-cols-[40px_1fr_1fr_80px_100px_56px] items-center"
                  >
                    <div class="flex items-center justify-center px-2 py-2">
                      <Checkbox
                        :model-value="selectedIndices.has(Number(index))"
                        @update:model-value="() => toggleRow(Number(index))"
                      />
                    </div>
                    <div class="px-3 py-2">
                      <Input
                        :model-value="String(row.name ?? '')"
                        @update:model-value="value => renameField(row, String(value))"
                      />
                    </div>
                    <div class="flex items-center gap-1 px-3 py-2">
                      <Select
                        :model-value="row.type ?? 'Any'"
                        @update:model-value="value => changeRowField(row, 'type', value != null ? String(value) : 'Any')"
                      >
                        <SelectTrigger class="h-8 min-w-0 flex-1">
                          <SelectValue placeholder="Any" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem v-for="option in availableTypes" :key="option.value" :value="option.value">
                            {{ option.label }}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        v-if="isCustomType(String(row.type ?? ''))"
                        variant="ghost"
                        size="icon"
                        class="size-8 shrink-0 text-muted-foreground hover:text-primary"
                        :title="`Открыть тип ${String(row.type)}`"
                        @click="openTypeDocument(String(row.type))"
                      >
                        <ExternalLink class="size-4" />
                      </Button>
                    </div>
                    <div class="flex justify-center px-3 py-2">
                      <Checkbox
                        :model-value="row.isArray"
                        @update:model-value="value => changeRowField(row, 'isArray', value === true)"
                      />
                    </div>
                    <div class="flex justify-center px-3 py-2">
                      <Checkbox
                        :model-value="row.optional"
                        @update:model-value="value => changeRowField(row, 'optional', value === true)"
                      />
                    </div>
                    <div class="flex justify-center px-3 py-2">
                      <i v-if="(row as any).params?.size > 0" class="ti ti-code text-blue-600" />
                      <span v-else class="text-muted-foreground">-</span>
                    </div>
                  </div>
                  <div v-if="fieldRows.length === 0" class="p-6 text-sm text-muted-foreground">
                    Полей пока нет.
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>

      <TypeVisualEditor
        v-else-if="activeTab === 'visual'"
        :model-value="editor.source"
        :identity="editor.identity || editor.name"
        :types="visualTypes"
        :show-preview="visualShowPreview"
        :show-example="visualShowExample"
        :panel-sizes="visualPanelSizes"
        @update:panel-sizes="updateVisualPanelSizes"
        @update:model-value="updateTypeSource"
        @open:type="openTypeDocument"
      />

      <TypeSourceEditor
        v-else
        :model-value="editor.source"
        :identity="editor.identity || editor.name"
        @update:model-value="updateTypeSource"
      />
    </div>
  </SourceDocumentEditorShell>
</template>
