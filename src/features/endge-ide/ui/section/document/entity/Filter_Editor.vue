<script setup lang="ts">
import type { RFilterEditor } from '@/features/endge-ide/domain/entities/RFilterEditor'

import { Endge, FilterType } from '@endge/core'
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
import { computed, nextTick, ref } from 'vue'

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
import { createEditorDiagnosticsEntityRef } from '@/features/endge-ide/model/diagnostics/editor-diagnostics-entity-ref'
import { EndgeIDE } from '@/features/endge-ide/model/kernel/endge-ide'
import EntityProblemsPanel from '@/features/endge-ide/ui/components/diagnostics/EntityProblemsPanel.vue'
import FilterSourceEditor from '@/features/endge-ide/ui/components/FilterSourceEditor.vue'
import FilterSourceVisualEditor from '@/features/endge-ide/ui/components/FilterSourceVisualEditor.vue'
import DocumentIdentityInput from '@/features/endge-ide/ui/components/source-document-editor/DocumentIdentityInput.vue'
import DocumentIdField from '@/features/endge-ide/ui/components/source-document-editor/DocumentIdField.vue'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'
import SourceFormatButton from '@/features/endge-ide/ui/components/source-document-editor/SourceFormatButton.vue'
import SourceJsonTreeControls from '@/features/endge-ide/ui/components/SourceJsonTreeControls.vue'

interface FilterSourceEditorHandle {
  formatDocument: () => Promise<void>
  focusOffset: (offset: number) => void
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
  'ui',
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

function updateVisualSource(value: string): void {
  editor.value?.applySourceText(value)
}

async function openSourceAt(offset: number): Promise<void> {
  activeTab.value = 'source'
  await nextTick()
  sourceEditorRef.value?.focusOffset(offset)
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
    :display-name="editor.displayName"
    :document-type="FilterType.DefaultFilter"
    :dependency-source="editor.source"
    :dependency-draft="editor"
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
            <TooltipContent>{{ $t('uiText.save4864057d') }}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </template>

    <template #right>
      <TooltipProvider>
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <SourceFormatButton
            v-if="activeTab === 'source'"
            @click="sourceEditorRef?.formatDocument()"
          />
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
            <TooltipContent>{{ $t('uiText.resetSourceC19e2677') }}</TooltipContent>
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
                  outputState.collapsed ? $t('uiText.showOutputc073c478') : $t('uiText.hideOutput0439b8c3')
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
          <DocumentIdField :document-id="editor.id" />
          <div class="space-y-2">
            <Label for="filter-identity">{{ $t('uiText.identity7e5a975b') }}</Label>
            <DocumentIdentityInput
              id="filter-identity"
              v-model="editor.identity"
              placeholder="schedule-filter"
            />
          </div>
          <div class="space-y-2">
            <Label for="filter-display-name">{{ $t('uiText.name3de49828') }}</Label>
            <Input
              id="filter-display-name"
              v-model="editor.displayName"
              placeholder="Фильтр расписания"
            />
          </div>
        </div>
      </div>
      <FilterSourceVisualEditor
        v-else-if="activeTab === 'ui'"
        :source="editor.source"
        :identity="editor.identity"
        @update:source="updateVisualSource"
        @open-source="openSourceAt"
      />
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
