<script setup lang="ts">
import type { RCompositionEditor } from '@/features/endge-ide/domain/entities/RCompositionEditor'

import { Endge } from '@endge/core'
import {
  Bug,
  Code2,
  FileJson,
  Loader2,
  Play,
  RotateCcw,
  Save,
  TriangleAlert,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { createWidgetInstance, getWidgetInstances, showWidget } from '@/components/layouts/grid'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  compositionPreviewError,
  launchCompositionPreview,
} from '@/features/endge-ide/model/composition-preview/composition-preview-state'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide'
import CompositionSourceEditor from '@/features/endge-ide/ui/components/CompositionSourceEditor.vue'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'
import { openEndgeEmbeddedPreview } from '@/features/endge-preview'

const editor = computed(
  () => EndgeIDE.tabs.documentEditorModel.value as RCompositionEditor | null,
)
const activeTab = ref<'source' | 'artifact' | 'diagnostics'>('source')
const launchLoading = ref(false)
const compiled = computed(() =>
  editor.value
    ? Endge.source.compile('composition', editor.value.source)
    : null,
)
const artifactJson = computed(() =>
  JSON.stringify(compiled.value?.artifact ?? null, null, 2),
)
const diagnosticsJson = computed(() =>
  JSON.stringify(compiled.value?.diagnostics ?? [], null, 2),
)
function updateSource(value: string): void {
  editor.value?.applySourceText(value)
}

async function launchPreview(): Promise<void> {
  const current = editor.value
  if (!current) { return }

  launchLoading.value = true
  try {
    current.refreshDiagnostics()
    await launchCompositionPreview({
      id: current.id,
      identity: current.identity,
      name: current.name,
      displayName: current.name,
      source: current.source,
      sourceVersion: current.sourceVersion,
    })
    compositionPreviewError.value = null
    if (getWidgetInstances('composition-preview').length) {
      showWidget('composition-preview')
    }
    else {
      createWidgetInstance('composition-preview', {})
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    compositionPreviewError.value = message
    toast.error('Не удалось запустить демонстрацию композиции', {
      description: message,
    })
  }
  finally {
    launchLoading.value = false
  }
}

function openDebugPreview(): void {
  openEndgeEmbeddedPreview('composition', editor.value?.identity)
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
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                :class="
                  activeTab === 'source'
                    ? 'bg-background shadow-sm'
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
            <TooltipContent>Запустить preview композиции</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                aria-label="Открыть Debug Preview композиции"
                @click="openDebugPreview"
              >
                <Bug class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Открыть Debug Preview сохранённой композиции</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                :class="
                  activeTab === 'artifact'
                    ? 'bg-background shadow-sm'
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
                    ? 'bg-background shadow-sm'
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
              <Button variant="ghost" size="icon" class="h-7 w-7" :disabled="EndgeIDE.busy.value" aria-label="Сохранить" @click="EndgeIDE.tabs.save()">
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
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
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

    <div class="min-h-0 flex-1 overflow-hidden">
      <CompositionSourceEditor
        v-if="activeTab === 'source'"
        :model-value="editor.source"
        @update:model-value="updateSource"
      />
      <pre
        v-else-if="activeTab === 'artifact'"
        class="h-full overflow-auto bg-muted/30 p-4 text-xs"
      >{{ artifactJson }}</pre>
      <pre v-else class="h-full overflow-auto bg-muted/30 p-4 text-xs">{{
        diagnosticsJson
      }}</pre>
    </div>
  </SourceDocumentEditorShell>
</template>
