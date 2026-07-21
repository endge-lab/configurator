<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { TableCellComponentOption } from '@/features/endge-ide/model/component-sfc-editor/table-cell-binding.types'
import type { VisualSchemaTypeOption } from '@/features/endge-ide/model/visual-schema-editor.types'
import type { RComponentSFC } from '@endge/core'

import { compileComponentSFC, Endge, inspectComponentSFCVisual } from '@endge/core'
import { useDomainStore } from '@endge/ui-vue'
import { AlignLeft, Code2, Loader2, Play, Save, Settings2, Table2, TriangleAlert } from 'lucide-vue-next'
import { computed, nextTick, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useSmartTabSelection } from '@/components/ui/smart-tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import { createEditorDiagnosticsEntityRef } from '@/features/endge-ide/model/diagnostics/editor-diagnostics-entity-ref'
import { resolveEndgeTypeDefinition } from '@/features/endge-ide/model/types/type-definition-resolver'
import { createSFCStyleEndgeCSSContribution } from '@/features/endge-ide/source-editor/contributions/component-sfc/endgecss.contribution'
import { createExtractComponentContribution } from '@/features/endge-ide/source-editor/contributions/component-sfc/extract-component'
import { createExtractTypeContribution } from '@/features/endge-ide/source-editor/contributions/types/extract-type'
import { createTypeRegistryContribution } from '@/features/endge-ide/source-editor/contributions/types/type-registry.contribution'
import EntityProblemsPanel from '@/features/endge-ide/ui/components/diagnostics/EntityProblemsPanel.vue'
import ScriptEditor from '@/features/endge-ide/ui/components/ScriptEditor.vue'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'
import ComponentSFCTableVisualEditor from '@/features/endge-ide/ui/section/document/entity/component-sfc/ComponentSFCTableVisualEditor.vue'

interface ScriptEditorHandle {
  focusOffset: (offset: number) => void
  formatDocument: () => Promise<void>
}

const tabs = EndgeIDE.tabs
const domainStore = useDomainStore()
const editor = computed<any>(() => tabs.documentEditorModel.value ?? null)
const documentModel = computed<any>(() => tabs.documentModel.value ?? null)
const launchLoading = ref(false)
const activeTab = useSmartTabSelection(
  'editor.active-tab',
  'source',
  ['general', 'visual', 'source', 'diagnostics'] as const,
)
const diagnosticsEntityRef = computed(() => createEditorDiagnosticsEntityRef('component-sfc', editor.value))
const sourceEditorRef = ref<ScriptEditorHandle | null>(null)
const visualInspection = computed(() => {
  const current = editor.value
  return current
    ? inspectComponentSFCVisual(current.source ?? '', {
        resolveComponentTag: tag => Endge.program.resolveComponentTag(tag),
        resolveTypeDefinition: resolveEndgeTypeDefinition,
      })
    : null
})
const tableVisualProjection = computed(() => visualInspection.value?.projection ?? null)
const hasTableVisual = computed(() => visualInspection.value?.support.kind === 'table' && tableVisualProjection.value != null)
const tableComponentOptions = computed<TableCellComponentOption[]>(() => Endge.domain.getComponentSFCs()
  .filter((component: RComponentSFC) => component.id !== editor.value?.id && Boolean(component.identity?.trim()))
  .map((component: RComponentSFC) => ({
    value: component.identity,
    label: component.displayName || component.name || component.identity,
    inputs: compileComponentSFC(component.source ?? '', {
      resolveTypeDefinition: resolveEndgeTypeDefinition,
    }).contract.inputs,
  })))
const tablePropTypes = computed<VisualSchemaTypeOption[]>(() => {
  const primitives: VisualSchemaTypeOption[] = [
    { identity: 'string', label: 'string', category: 'primitive' },
    { identity: 'number', label: 'number', category: 'primitive' },
    { identity: 'boolean', label: 'boolean', category: 'primitive' },
    { identity: 'unknown', label: 'unknown', category: 'primitive' },
    { identity: 'any', label: 'any', category: 'primitive' },
    { identity: 'null', label: 'null', category: 'primitive' },
  ]
  const registered = domainStore.typeCatalog
    .filter(type => type.category !== 'primitive' && Boolean(type.identity?.trim()))
    .map(type => ({
      identity: type.identity,
      label: type.displayName || type.identity,
      category: type.category,
      source: String(Endge.domain.getType(type.identity)?.source ?? ''),
    } satisfies VisualSchemaTypeOption))
  return [...primitives, ...registered]
})
const sourceEditorExtensions = [
  createTypeRegistryContribution(),
  createExtractTypeContribution({
    getEditorModel: () => editor.value,
    getPersistedModel: () => tabs.documentModel.value as RComponentSFC | null,
  }),
  createSFCStyleEndgeCSSContribution(),
  createExtractComponentContribution({
    getEditorModel: () => editor.value,
    getPersistedModel: () => tabs.documentModel.value as RComponentSFC | null,
  }),
]

watch(hasTableVisual, (supported) => {
  if (supported && activeTab.value === 'general') {
    activeTab.value = 'visual'
    return
  }
  if (!supported && activeTab.value === 'visual') {
    activeTab.value = 'source'
  }
}, { immediate: true })

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}

function updateVisualSource(source: string): void {
  const current = editor.value
  if (!current) {
    return
  }
  current.source = source
  current.parseSource?.()
}

async function openSourceAt(offset: number): Promise<void> {
  activeTab.value = 'source'
  await nextTick()
  sourceEditorRef.value?.focusOffset(offset)
}

function openTypeDocument(identity: string): void {
  const type = domainStore.typeCatalog.find(item => item.identity === identity)
  if (!type || type.category === 'primitive') {
    return
  }
  EndgeIDE.tabs.openSourceReference({
    target: 'type',
    identity,
    range: { start: 0, end: 0 },
  })
}

async function launchPreview(): Promise<void> {
  const current = editor.value
  if (!current) {
    return
  }

  launchLoading.value = true
  try {
    current.parseSource?.()
    await EndgeIDE.runtimePreview.launchEditor(current)
  }
  finally {
    launchLoading.value = false
  }
}
</script>

<template>
  <div v-if="!editor" class="p-4 text-sm text-muted-foreground">
    Нет редактора
  </div>
  <SourceDocumentEditorShell
    v-else
    :document-id="editor.id"
    :identity="editor.identity"
  >
    <template #center>
      <TooltipProvider>
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip v-if="!hasTableVisual">
            <TooltipTrigger as-child>
              <Button
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                :class="
                  activeTab === 'general'
                    ? 'bg-editor-control shadow-sm'
                    : 'text-muted-foreground'
                "
                aria-label="Основное"
                @click="activeTab = 'general'"
              >
                <Settings2 class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Основное</TooltipContent>
          </Tooltip>
          <Tooltip v-if="hasTableVisual">
            <TooltipTrigger as-child>
              <Button
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                :class="
                  activeTab === 'visual'
                    ? 'bg-editor-control shadow-sm'
                    : 'text-muted-foreground'
                "
                aria-label="Visual Table"
                @click="activeTab = 'visual'"
              >
                <Table2 class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Visual Table</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                :class="
                  activeTab === 'source'
                    ? 'bg-editor-control shadow-sm'
                    : 'text-muted-foreground'
                "
                aria-label="Source"
                @click="activeTab = 'source'"
              >
                <Code2 class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Source</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                :class="
                  activeTab === 'diagnostics'
                    ? 'bg-editor-control shadow-sm'
                    : 'text-muted-foreground'
                "
                aria-label="Диагностика"
                @click="activeTab = 'diagnostics'"
              >
                <TriangleAlert class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Диагностика</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" class="mx-0.5 h-5" />
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                aria-label="Запуск"
                :disabled="launchLoading"
                @click="launchPreview"
              >
                <Loader2 v-if="launchLoading" class="size-4 animate-spin" />
                <Play v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Запустить Runtime Preview (⌘/Ctrl+Enter)</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" class="mx-0.5 h-5" />
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button size="icon" variant="ghost" class="h-7 w-7" aria-label="Сохранить" :disabled="EndgeIDE.busy.value" @click="save">
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
      <TooltipProvider>
        <div v-if="activeTab === 'source'" class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                aria-label="Форматировать"
                @click="sourceEditorRef?.formatDocument()"
              >
                <AlignLeft class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Форматировать</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </template>

    <div v-if="activeTab === 'general'" class="h-full overflow-auto p-6">
      <div class="max-w-2xl space-y-5">
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <Label for="component-sfc-display-name">Название</Label>
            <Input
              id="component-sfc-display-name"
              v-model="editor.displayName"
            />
          </div>
          <div class="space-y-2">
            <Label for="component-sfc-identity">Identity</Label>
            <Input
              id="component-sfc-identity"
              v-model="editor.identity"
              spellcheck="false"
            />
          </div>
        </div>
        <div class="space-y-2">
          <Label for="component-sfc-tag">Tag</Label>
          <Input
            id="component-sfc-tag"
            v-model="editor.tag"
            placeholder="Tail или Module.SomeTag"
            spellcheck="false"
          />
        </div>
        <div class="space-y-2">
          <Label for="component-sfc-description">Описание</Label>
          <Textarea
            id="component-sfc-description"
            v-model="editor.description"
            :rows="5"
          />
        </div>
        <div class="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
          <div>modelVersion: {{ documentModel?.modelVersion ?? 1 }}</div>
          <div>targets: {{ (documentModel?.supportedTargets ?? []).join(', ') || '—' }}</div>
          <div>source: {{ String(editor.source ?? '').length }} chars</div>
        </div>
      </div>
    </div>

    <ComponentSFCTableVisualEditor
      v-else-if="activeTab === 'visual' && tableVisualProjection"
      :source="editor.source"
      :identity="editor.identity"
      :projection="tableVisualProjection"
      :component-options="tableComponentOptions"
      :prop-types="tablePropTypes"
      :diagnostics="visualInspection?.diagnostics"
      class="min-h-0 flex-1"
      @update:source="updateVisualSource"
      @open-source="openSourceAt"
      @open:type="openTypeDocument"
    >
      <template #general>
        <div class="max-w-2xl space-y-5">
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <Label for="component-sfc-display-name-visual">Название</Label>
              <Input
                id="component-sfc-display-name-visual"
                v-model="editor.displayName"
              />
            </div>
            <div class="space-y-2">
              <Label for="component-sfc-identity-visual">Identity</Label>
              <Input
                id="component-sfc-identity-visual"
                v-model="editor.identity"
                spellcheck="false"
              />
            </div>
          </div>
          <div class="space-y-2">
            <Label for="component-sfc-tag-visual">Tag</Label>
            <Input
              id="component-sfc-tag-visual"
              v-model="editor.tag"
              placeholder="Tail или Module.SomeTag"
              spellcheck="false"
            />
          </div>
          <div class="space-y-2">
            <Label for="component-sfc-description-visual">Описание</Label>
            <Textarea
              id="component-sfc-description-visual"
              v-model="editor.description"
              :rows="5"
            />
          </div>
          <div class="space-y-1 rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
            <div>modelVersion: {{ documentModel?.modelVersion ?? 1 }}</div>
            <div>targets: {{ (documentModel?.supportedTargets ?? []).join(', ') || '—' }}</div>
            <div>source: {{ String(editor.source ?? '').length }} chars</div>
          </div>
        </div>
      </template>
    </ComponentSFCTableVisualEditor>

    <div v-else-if="activeTab === 'source'" class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ScriptEditor
        ref="sourceEditorRef"
        v-model="editor.source"
        :extensions="sourceEditorExtensions"
        language="html"
        format-language="vue"
        class="min-h-0 flex-1"
        min-height="420px"
        @blur="editor.parseSource()"
      />
    </div>

    <EntityProblemsPanel
      v-else-if="diagnosticsEntityRef"
      :entity-ref="diagnosticsEntityRef"
      class="min-h-0 flex-1"
    />
  </SourceDocumentEditorShell>
</template>
