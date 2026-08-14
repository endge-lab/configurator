<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { RComputationEditor } from '@/features/endge-ide/domain/entities/RComputationEditor'

import { Endge } from '@endge/core'
import {
  Code2,
  FileJson,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Save,
  Settings2,
  TriangleAlert,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useSmartTabSelection } from '@/components/ui/smart-tabs'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  runComputationSourcePreview,
  serializeComputationPreviewOutput,
} from '@/features/endge-ide/model/computation-preview/computation-source-preview'
import { EndgeIDE } from '@/features/endge-ide/model/kernel/endge-ide'
import { createEditorDiagnosticsEntityRef } from '@/features/endge-ide/model/diagnostics/editor-diagnostics-entity-ref'
import ComputationSourceEditor from '@/features/endge-ide/ui/components/ComputationSourceEditor.vue'
import EntityProblemsPanel from '@/features/endge-ide/ui/components/diagnostics/EntityProblemsPanel.vue'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'
import SourceFormatButton from '@/features/endge-ide/ui/components/source-document-editor/SourceFormatButton.vue'
import SourceJsonTreeControls from '@/features/endge-ide/ui/components/SourceJsonTreeControls.vue'

interface ComputationSourceEditorHandle {
  formatDocument: () => Promise<void>
  expandOutput: () => void
  collapseOutput: () => void
  toggleOutput: () => void
}

interface ComputationOutputState {
  available: boolean
  collapsed: boolean
  data: unknown
}

const props = defineProps<{ tabContext?: { editor?: RComputationEditor } }>()
const editor = computed(() => props.tabContext?.editor ?? null)
const activeTab = useSmartTabSelection(
  'editor.active-tab',
  'implementation',
  ['general', 'implementation', 'preview', 'artifact', 'diagnostics'] as const,
)
const diagnosticsEntityRef = computed(() => createEditorDiagnosticsEntityRef('computation', editor.value))
const sourceEditorRef = ref<ComputationSourceEditorHandle | null>(null)
const previewInput = ref('{}')
const previewOutput = ref('')
const runningPreview = ref(false)
const outputState = ref<ComputationOutputState>({
  available: false,
  collapsed: false,
  data: null,
})

const tabGroups = [
  [
    { value: 'general', icon: Settings2, label: 'Основное' },
    { value: 'implementation', icon: Code2, label: 'Реализация' },
  ],
  [
    { value: 'preview', icon: Play, label: 'Запуск' },
    { value: 'artifact', icon: FileJson, label: 'Артифакт' },
    { value: 'diagnostics', icon: TriangleAlert, label: 'Диагностика' },
  ],
] as const

const artifactJson = computed(() => {
  const current = editor.value
  if (!current) {
    return '{}'
  }

  const result = Endge.source.compile('computation', current.source)
  return JSON.stringify(result.artifact ?? null, null, 2)
})

function applySourceText(value: string): void {
  editor.value?.applySourceText(value)
}

function updateOutputState(value: ComputationOutputState): void {
  outputState.value = value
}

async function runPreview(): Promise<void> {
  const current = editor.value
  if (!current) {
    return
  }

  runningPreview.value = true
  try {
    const output = await runComputationSourcePreview(
      current.source,
      previewInput.value,
      current.identity.trim() || 'computation-editor-preview',
    )
    previewOutput.value = serializeComputationPreviewOutput(output)
    toast.success('Preview выполнен')
  }
  catch (error: any) {
    console.error(`[Computation_Editor] Preview error: ${error instanceof Error ? error.message : String(error)}`)
    previewOutput.value = ''
    toast.error('Ошибка Preview', {
      description: error?.message ?? String(error),
    })
  }
  finally {
    runningPreview.value = false
  }
}

async function save(): Promise<void> {
  const current = editor.value
  if (!current) {
    return
  }
  current.identity = current.identity.trim()
  current.name = current.name.trim() || current.identity
  current.refreshDiagnostics()
  if (current.diagnostics.length) {
    toast.error('Computation не сохранен', { description: current.diagnostics[0] })
    activeTab.value = current.diagnostics[0]?.startsWith('Identity') ? 'general' : 'implementation'
    return
  }
  await EndgeIDE.tabs.save()
}
</script>

<template>
  <SourceDocumentEditorShell
    v-if="editor"
    :document-id="editor.id"
    :identity="editor.identity"
    :display-name="editor.name"
    document-type="computation"
    :dependency-source="editor.source"
    :dependency-draft="editor"
  >
    <template #center>
      <TooltipProvider>
        <div class="flex shrink-0 items-center gap-0">
          <template v-for="(group, groupIndex) in tabGroups" :key="groupIndex">
            <Separator
              v-if="groupIndex"
              orientation="vertical"
              class="mx-0.5 h-5"
            />

            <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
              <Tooltip v-for="item in group" :key="item.value">
                <TooltipTrigger as-child>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    class="h-7 w-7"
                    :class="
                      activeTab === item.value
                        ? 'bg-editor-control shadow-sm'
                        : 'text-muted-foreground'
                    "
                    :aria-label="item.label"
                    @click="activeTab = item.value"
                  >
                    <component :is="item.icon" class="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{{ item.label }}</TooltipContent>
              </Tooltip>
            </div>
          </template>
        </div>

        <Separator orientation="vertical" class="mx-0.5 h-5" />
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button size="icon" variant="ghost" class="h-7 w-7" :disabled="EndgeIDE.busy.value" aria-label="Сохранить Computation" @click="save">
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
        <div class="flex shrink-0 items-center gap-0">
          <div v-if="activeTab === 'implementation'" class="flex items-center rounded-md border bg-muted/40 p-0.5">
            <SourceFormatButton @click="sourceEditorRef?.formatDocument()" />
          </div>

          <template v-if="activeTab === 'implementation' && outputState.available">
            <Separator orientation="vertical" class="mx-0.5 h-5" />

            <div class="computation-output-actions flex items-center rounded-md border bg-muted/40 p-0.5">
              <SourceJsonTreeControls
                v-if="!outputState.collapsed"
                :copy-value="outputState.data"
                @expand-all="sourceEditorRef?.expandOutput()"
                @collapse-all="sourceEditorRef?.collapseOutput()"
              />

              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="h-7 w-7"
                    :aria-label="outputState.collapsed ? 'Показать output' : 'Скрыть output'"
                    @click="sourceEditorRef?.toggleOutput()"
                  >
                    <PanelRightOpen v-if="outputState.collapsed" class="size-4" />
                    <PanelRightClose v-else class="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {{ outputState.collapsed ? "Показать output" : "Скрыть output" }}
                </TooltipContent>
              </Tooltip>
            </div>
          </template>
        </div>
      </TooltipProvider>
    </template>

    <div v-if="activeTab === 'general'" class="min-h-0 flex-1 overflow-auto p-6">
      <div class="max-w-2xl space-y-5">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="computation-name">Название</Label><Input id="computation-name" v-model="editor.name" />
          </div>
          <div class="space-y-2">
            <Label for="computation-identity">Identity</Label><Input id="computation-identity" v-model="editor.identity" spellcheck="false" />
          </div>
        </div>
        <div class="space-y-2">
          <Label for="computation-description">Описание</Label><Textarea id="computation-description" v-model="editor.description" :rows="4" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="computation-source-version">Source version</Label><Input id="computation-source-version" v-model.number="editor.sourceVersion" type="number" min="1" />
          </div>
          <div class="space-y-2">
            <Label for="computation-contract-version">Contract version</Label><Input id="computation-contract-version" v-model.number="editor.contractVersion" type="number" min="1" />
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="activeTab === 'implementation'" class="flex min-h-0 flex-1 flex-col">
      <ComputationSourceEditor
        ref="sourceEditorRef"
        :model-value="editor.source"
        :preview-input="previewInput"
        :preview-identity="editor.identity"
        @update:model-value="applySourceText"
        @output-state="updateOutputState"
      />
    </div>

    <div
      v-else-if="activeTab === 'preview'"
      class="grid h-full min-h-0 flex-1 grid-cols-2 gap-0 overflow-hidden"
    >
      <section class="relative flex h-full min-h-0 flex-col overflow-hidden border-r">
        <div class="shrink-0 border-b px-3 py-2 text-sm font-medium">
          Input JSON
        </div>
        <Textarea
          v-model="previewInput"
          class="h-full min-h-0 flex-1 resize-none overflow-auto rounded-none border-0 font-mono text-xs shadow-none focus-visible:ring-0"
          spellcheck="false"
        />
      </section>

      <section class="flex h-full min-h-0 flex-col">
        <div class="flex shrink-0 items-center justify-between border-b px-3 py-2">
          <span class="text-sm font-medium">Output JSON</span>
          <Button size="sm" :disabled="runningPreview" @click="runPreview">
            <Loader2 v-if="runningPreview" class="mr-2 size-4 animate-spin" />
            <Play v-else class="mr-2 size-4" />
            Run preview
          </Button>
        </div>
        <pre class="min-h-0 flex-1 overflow-auto bg-muted/30 p-3 text-xs">{{
          previewOutput || "null"
        }}</pre>
      </section>
    </div>

    <pre
      v-else-if="activeTab === 'artifact'"
      class="min-h-0 flex-1 overflow-auto bg-muted/30 p-4 text-xs"
    >{{ artifactJson }}</pre>

    <EntityProblemsPanel
      v-else-if="diagnosticsEntityRef"
      :entity-ref="diagnosticsEntityRef"
      class="min-h-0 flex-1"
    />
  </SourceDocumentEditorShell>
</template>

<style scoped>
.computation-output-actions :deep(.source-json-tree-controls__action) {
  color: hsl(var(--muted-foreground));
}

.computation-output-actions :deep(.source-json-tree-controls__action:hover) {
  background: hsl(var(--accent));
  color: hsl(var(--accent-foreground));
}
</style>
