<script setup lang="ts">
import type { RQueryEditor } from '@/features/endge-ide/domain/entities/RQueryEditor'
import { Endge } from '@endge/core'
import { Loader2, Play, RotateCcw, Save } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import QuerySourceEditor from '@/features/endge-ide/ui/components/QuerySourceEditor.vue'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'

const tabs = EndgeIDE.tabs
const editor = computed<RQueryEditor | null>(
  () => tabs.documentEditorModel.value as RQueryEditor | null,
)
const runQueryLoading = ref(false)

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}

function resetSource(): void {
  editor.value?.applySourceText(Endge.source.createDefault('query'))
}

async function runQuery(): Promise<void> {
  const current = editor.value
  if (!current) {
    toast.error('Нет редактора запроса')
    return
  }

  const query = Endge.domain.getQuery(current.id ?? current.identity)
  if (!query) {
    toast.error('Запрос не найден в домене')
    return
  }

  runQueryLoading.value = true
  try {
    current.updateSource(query)
    await buildQueryArtifact(query.id ?? query.identity)

    const outputs = (await Endge.runtime.query.run(query, {})) as Record<
      string,
      unknown
    >
    console.groupCollapsed(`[Query_Editor] Outputs: ${query.identity}`)
    for (const [key, value] of Object.entries(outputs)) { console.log(key, value) }
    console.log('all', outputs)
    console.groupEnd()
    toast.success('Запрос выполнен', {
      description: 'Результат выведен в консоль',
    })
  }
  catch (error: any) {
    console.error('[Query_Editor] Ошибка выполнения запроса:', error)
    toast.error('Ошибка выполнения запроса', {
      description: error?.message ?? String(error),
    })
  }
  finally {
    runQueryLoading.value = false
  }
}

async function buildQueryArtifact(
  idOrIdentity: string | number,
): Promise<void> {
  const query = Endge.domain.getQuery(idOrIdentity)
  if (!query) { throw new Error(`Query not found: "${idOrIdentity}".`) }

  Endge.compiler.buildQuery(query)

  const artifact = Endge.program.getQueryArtifact(idOrIdentity)
  if (!artifact) {
    throw new Error(
      `Query artifact is missing for "${idOrIdentity}". Compile domain before running query.`,
    )
  }
  if (artifact.status === 'error') {
    const message
      = artifact.diagnostics[0]?.message
        ?? `Query artifact has compile errors for "${idOrIdentity}".`
    throw new Error(message)
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
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                aria-label="Выполнить запрос"
                :disabled="runQueryLoading"
                @click="runQuery"
              >
                <Loader2 v-if="runQueryLoading" class="size-4 animate-spin" />
                <Play v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Выполнить запрос</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" class="mx-0.5 h-5" />
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon" class="h-7 w-7" aria-label="Сохранить" :disabled="EndgeIDE.busy.value" @click="save">
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
                @click="resetSource"
              >
                <RotateCcw class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Сбросить source</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </template>

    <div class="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div class="flex h-full min-h-0 flex-1 flex-col overflow-hidden p-0">
        <QuerySourceEditor
          :model-value="editor.source"
          class="min-h-0 flex-1"
          @update:model-value="(value) => editor?.applySourceText(value)"
        />
      </div>

    </div>
  </SourceDocumentEditorShell>
</template>
