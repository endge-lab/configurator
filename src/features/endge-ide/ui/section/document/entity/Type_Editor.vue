<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { RTypeEditor } from '@/features/endge-ide/domain/entities/RTypeEditor'
import type { DomainDocumentType } from '@endge/core'

import { Endge } from '@endge/core'
import { useDomainStore } from '@endge/ui-vue'
import { Code2, Eye, FileJson2, ListTree, Loader2, RotateCcw, Save, Settings2 } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useSmartTabSelection, useSmartTabSharedViewState } from '@/components/ui/smart-tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide'
import {
  createVisualSchemaWorkspaceState,
  isVisualSchemaWorkspaceState,
  visualSchemaLayoutKey,
} from '@/features/endge-ide/model/visual-schema-workspace-state'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'
import SourceFormatButton from '@/features/endge-ide/ui/components/source-document-editor/SourceFormatButton.vue'
import TypeSourceEditor from '@/features/endge-ide/ui/components/TypeSourceEditor.vue'
import TypeVisualEditor from '@/features/endge-ide/ui/components/TypeVisualEditor.vue'

interface SourceEditorHandle {
  formatDocument: () => Promise<void>
}

const editor = computed(() => EndgeIDE.tabs.documentEditorModel.value as RTypeEditor | null)
const domainStore = useDomainStore()
const activeTab = useSmartTabSelection(
  'editor.active-tab',
  'visual',
  ['general', 'visual', 'source'] as const,
)
const sourceEditorRef = ref<SourceEditorHandle | null>(null)
const tabs = [
  { value: 'general', label: 'Основное', icon: Settings2 },
  { value: 'visual', label: 'Visual', icon: ListTree },
  { value: 'source', label: 'Source', icon: Code2 },
] as const

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
const visualWorkspaceState = useSmartTabSharedViewState(
  'type-editor.visual-workspace',
  {
    version: 1,
    defaultValue: () => createVisualSchemaWorkspaceState(true, true),
    validate: isVisualSchemaWorkspaceState,
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
const visualLayoutKey = computed(() => visualSchemaLayoutKey(visualShowPreview.value, visualShowExample.value))
const visualPanelSizes = computed(() => visualWorkspaceState.value.layouts[visualLayoutKey.value])
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

async function save(): Promise<void> {
  const current = editor.value
  if (!current) {
    return
  }

  current.identity = current.identity.trim()
  current.name = current.name.trim() || current.identity
  if (!current.identity) {
    toast.error('Identity типа не может быть пустым')
    activeTab.value = 'general'
    return
  }

  await EndgeIDE.tabs.save()
}
</script>

<template>
  <SourceDocumentEditorShell
    v-if="editor"
    :document-id="editor.id"
    :identity="editor.identity || editor.name"
    :display-name="editor.name"
    document-type="type"
    :dependency-source="editor.source"
    :dependency-draft="editor"
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
                @click="save"
              >
                <Loader2 v-if="EndgeIDE.busy.value" class="size-4 animate-spin" />
                <Save v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Сохранить</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </template>

    <template #right>
      <TooltipProvider v-if="activeTab === 'source'">
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <SourceFormatButton @click="sourceEditorRef?.formatDocument()" />
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
            <Label for="type-identity">Identity</Label>
            <Input id="type-identity" v-model="editor.identity" class="font-mono" spellcheck="false" />
          </div>
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
        ref="sourceEditorRef"
        :model-value="editor.source"
        :identity="editor.identity || editor.name"
        @update:model-value="updateTypeSource"
      />
    </div>
  </SourceDocumentEditorShell>
</template>
