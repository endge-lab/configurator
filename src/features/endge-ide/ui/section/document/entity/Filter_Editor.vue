<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { RFilterEditor } from '@/features/endge-ide/domain/entities/RFilterEditor'

import { Endge } from '@endge/core'
import {
  Code2,
  FileJson,
  LayoutPanelTop,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Save,
  Settings2,
  TriangleAlert,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useSmartTabSelection } from '@/components/ui/smart-tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide'
import { createEditorDiagnosticsEntityRef } from '@/features/endge-ide/model/diagnostics/editor-diagnostics-entity-ref'
import EntityProblemsPanel from '@/features/endge-ide/ui/components/diagnostics/EntityProblemsPanel.vue'
import FilterLegacyFieldsEditor from '@/features/endge-ide/ui/components/FilterLegacyFieldsEditor.vue'
import FilterSourceEditor from '@/features/endge-ide/ui/components/FilterSourceEditor.vue'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'
import SourceJsonTreeControls from '@/features/endge-ide/ui/components/SourceJsonTreeControls.vue'

interface FilterSourceEditorHandle {
  expandOutput: () => void
  collapseOutput: () => void
  toggleOutput: () => void
}

interface FilterOutputState {
  available: boolean
  collapsed: boolean
  data: unknown
}

const editor = computed(
  () => EndgeIDE.tabs.documentEditorModel.value as RFilterEditor | null,
)
const activeTab = useSmartTabSelection(
  'editor.active-tab',
  'source',
  ['general', 'ui', 'source', 'artifact', 'diagnostics'] as const,
)
const sourceEditorRef = ref<FilterSourceEditorHandle | null>(null)
const outputState = ref<FilterOutputState>({
  available: false,
  collapsed: false,
  data: null,
})
const tabGroups = [
  [
    { value: 'general', label: 'Основное', icon: Settings2 },
    { value: 'ui', label: 'UI', icon: LayoutPanelTop },
    { value: 'source', label: 'Source', icon: Code2 },
  ],
  [
    { value: 'artifact', label: 'Artifact', icon: FileJson },
    { value: 'diagnostics', label: 'Diagnostics', icon: TriangleAlert },
  ],
] as const
const compiled = computed(() =>
  editor.value ? Endge.source.compile('filter', editor.value.source) : null,
)
const artifactJson = computed(() =>
  JSON.stringify(compiled.value?.artifact ?? null, null, 2),
)
const diagnosticsEntityRef = computed(() =>
  createEditorDiagnosticsEntityRef('filter', editor.value),
)

function updateSource(value: string): void {
  editor.value?.applySourceText(value)
}

function updateOutputState(value: FilterOutputState): void {
  outputState.value = value
}
</script>

<template>
  <SourceDocumentEditorShell
    v-if="editor"
    :document-id="editor.id"
    :identity="editor.identity"
  >
    <template #center>
      <TooltipProvider>
        <template v-for="(group, groupIndex) in tabGroups" :key="groupIndex">
          <Separator
            v-if="groupIndex"
            orientation="vertical"
            class="mx-0.5 h-5"
          />
          <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
            <Tooltip v-for="tab in group" :key="tab.value">
              <TooltipTrigger as-child>
                <Button
                  size="icon"
                  variant="ghost"
                  class="h-7 w-7"
                  :class="
                    activeTab === tab.value
                      ? 'bg-editor-control shadow-sm'
                      : 'text-muted-foreground'
                  "
                  :aria-label="tab.label"
                  @click="activeTab = tab.value"
                >
                  <component :is="tab.icon" class="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{{ tab.label }}</TooltipContent>
            </Tooltip>
          </div>
        </template>

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
                <Loader2
                  v-if="EndgeIDE.busy.value"
                  class="size-4 animate-spin"
                />
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
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                aria-label="Сбросить source"
                @click="editor?.resetSource()"
              >
                <RotateCcw class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Сбросить source</TooltipContent>
          </Tooltip>
        </div>

        <template v-if="activeTab === 'source' && outputState.available">
          <Separator orientation="vertical" class="mx-0.5 h-5" />
          <div
            class="filter-output-actions flex items-center rounded-md border bg-muted/40 p-0.5"
          >
            <SourceJsonTreeControls
              v-if="!outputState.collapsed"
              :copy-value="outputState.data"
              @expand-all="sourceEditorRef?.expandOutput()"
              @collapse-all="sourceEditorRef?.collapseOutput()"
            />
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-7 w-7"
                  :aria-label="
                    outputState.collapsed ? 'Показать output' : 'Скрыть output'
                  "
                  @click="sourceEditorRef?.toggleOutput()"
                >
                  <PanelRightOpen v-if="outputState.collapsed" class="size-4" />
                  <PanelRightClose v-else class="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {{
                  outputState.collapsed ? "Показать output" : "Скрыть output"
                }}
              </TooltipContent>
            </Tooltip>
          </div>
        </template>
      </TooltipProvider>
    </template>

    <div class="min-h-0 flex-1 overflow-hidden">
      <div v-if="activeTab === 'general'" class="h-full overflow-auto p-6">
        <div class="max-w-xl space-y-5">
          <div class="space-y-2">
            <Label for="filter-identity">Identity</Label>
            <Input
              id="filter-identity"
              v-model="editor.identity"
              placeholder="schedule-filter"
            />
          </div>
          <div class="space-y-2">
            <Label for="filter-display-name">Название</Label>
            <Input
              id="filter-display-name"
              v-model="editor.displayName"
              placeholder="Фильтр расписания"
            />
          </div>
        </div>
      </div>
      <div v-else-if="activeTab === 'ui'" class="flex h-full min-h-0 flex-col">
        <div
          class="shrink-0 border-b bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-300"
        >
          Legacy fields сохраняются отдельно и не используются новым Filter
          runtime.
        </div>
        <FilterLegacyFieldsEditor class="min-h-0 flex-1" />
      </div>
      <FilterSourceEditor
        v-else-if="activeTab === 'source'"
        ref="sourceEditorRef"
        :model-value="editor.source"
        @update:model-value="updateSource"
        @output-state="updateOutputState"
      />
      <pre
        v-else-if="activeTab === 'artifact'"
        class="h-full overflow-auto bg-muted/30 p-4 text-xs"
      >{{ artifactJson }}</pre>
      <EntityProblemsPanel
        v-else-if="diagnosticsEntityRef"
        :entity-ref="diagnosticsEntityRef"
        class="h-full"
      />
    </div>
  </SourceDocumentEditorShell>
</template>

<style scoped>
.filter-output-actions :deep(.source-json-tree-controls__action) {
  color: hsl(var(--muted-foreground));
}

.filter-output-actions :deep(.source-json-tree-controls__action:hover) {
  background: hsl(var(--accent));
  color: hsl(var(--accent-foreground));
}
</style>
