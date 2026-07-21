<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { RCompositionEditor } from '@/features/endge-ide/domain/entities/RCompositionEditor'

import { Endge } from '@endge/core'
import {
  Code2,
  FileJson,
  Loader2,
  Play,
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
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide'
import { createEditorDiagnosticsEntityRef } from '@/features/endge-ide/model/diagnostics/editor-diagnostics-entity-ref'
import CompositionSourceEditor from '@/features/endge-ide/ui/components/CompositionSourceEditor.vue'
import EntityProblemsPanel from '@/features/endge-ide/ui/components/diagnostics/EntityProblemsPanel.vue'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'
import SourceFormatButton from '@/features/endge-ide/ui/components/source-document-editor/SourceFormatButton.vue'

interface SourceEditorHandle {
  formatDocument: () => Promise<void>
}

const editor = computed(
  () => EndgeIDE.tabs.documentEditorModel.value as RCompositionEditor | null,
)
const activeTab = useSmartTabSelection('editor.active-tab', 'source', [
  'general',
  'source',
  'artifact',
  'diagnostics',
] as const)
const launchLoading = ref(false)
const sourceEditorRef = ref<SourceEditorHandle | null>(null)
const compiled = computed(() =>
  editor.value
    ? Endge.source.compile('composition', editor.value.source)
    : null,
)
const artifactJson = computed(() =>
  JSON.stringify(compiled.value?.artifact ?? null, null, 2),
)
const diagnosticsEntityRef = computed(() =>
  createEditorDiagnosticsEntityRef('composition', editor.value),
)
function updateSource(value: string): void {
  editor.value?.applySourceText(value)
}

async function launchPreview(): Promise<void> {
  const current = editor.value
  if (!current) {
    return
  }

  launchLoading.value = true
  try {
    current.refreshDiagnostics()
    await EndgeIDE.runtimePreview.launchEditor(current)
  }
  finally {
    launchLoading.value = false
  }
}
</script>

<template>
  <SourceDocumentEditorShell
    v-if="editor"
    :document-id="editor.id"
    :identity="editor.identity"
    :display-name="editor.name"
    document-type="composition"
    :dependency-source="editor.source"
    :dependency-draft="editor"
  >
    <template #center>
      <TooltipProvider>
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
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
        </div>

        <Separator orientation="vertical" class="mx-0.5 h-5" />
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                :disabled="launchLoading"
                aria-label="Запустить preview композиции"
                @click="launchPreview"
              >
                <Loader2 v-if="launchLoading" class="size-4 animate-spin" />
                <Play v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Запустить Runtime Preview (⌘/Ctrl+Enter)
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                :class="
                  activeTab === 'artifact'
                    ? 'bg-editor-control shadow-sm'
                    : 'text-muted-foreground'
                "
                aria-label="Артифакт"
                @click="activeTab = 'artifact'"
              >
                <FileJson class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Артифакт</TooltipContent>
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
                @click="editor.resetSource()"
              >
                <RotateCcw class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Сбросить source</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </template>

    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div v-if="activeTab === 'general'" class="h-full overflow-auto p-6">
        <div class="max-w-2xl space-y-5">
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="composition-name">Display name</Label>
              <Input id="composition-name" v-model="editor.name" />
            </div>
            <div class="space-y-2">
              <Label for="composition-identity">Identity</Label>
              <Input
                id="composition-identity"
                v-model="editor.identity"
                spellcheck="false"
              />
            </div>
          </div>
          <div class="space-y-2">
            <Label for="composition-description">Описание</Label>
            <Textarea
              id="composition-description"
              v-model="editor.description"
              :rows="4"
            />
          </div>
          <div class="max-w-xs space-y-2">
            <Label for="composition-source-version">Source version</Label>
            <Input
              id="composition-source-version"
              v-model.number="editor.sourceVersion"
              type="number"
              min="1"
            />
          </div>
        </div>
      </div>
      <CompositionSourceEditor
        v-else-if="activeTab === 'source'"
        ref="sourceEditorRef"
        :model-value="editor.source"
        @update:model-value="updateSource"
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
