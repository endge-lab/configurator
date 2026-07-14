<script setup lang="ts">
import type { RQueryEditor } from '@/features/endge-ide/domain/entities/RQueryEditor'
import type { DomainDocumentType } from '@endge/core'

import { Endge, QueryType } from '@endge/core'
import { Code2, Loader2, Play, Radio, RotateCcw, Save } from 'lucide-vue-next'
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
import BehaviorBindingEditor from '@/features/endge-ide/ui/components/BehaviorBindingEditor.vue'
import QuerySourceEditor from '@/features/endge-ide/ui/components/QuerySourceEditor.vue'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'

const tabs = EndgeIDE.tabs
const editor = computed<RQueryEditor | null>(
  () => tabs.documentEditorModel.value as RQueryEditor | null,
)
const queryDocumentType = QueryType.REST as DomainDocumentType
const activeTab = ref<'source' | 'events'>('source')
const runQueryLoading = ref(false)
const tabButtons = [
  { value: 'source', icon: Code2, label: 'Source' },
  { value: 'events', icon: Radio, label: 'События' },
] as const

const projectId = computed(() => {
  const raw = (tabs.documentModel.value as { project?: unknown } | null)
    ?.project
  if (raw == null) { return null }
  const id = Number(raw)
  return Number.isFinite(id) ? id : null
})

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
          <Tooltip v-for="item in tabButtons" :key="item.value">
            <TooltipTrigger as-child>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                :class="
                  activeTab === item.value
                    ? 'bg-background shadow-sm'
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

        <Separator orientation="vertical" class="mx-0.5 h-5" />
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
      <div
        v-if="activeTab === 'source'"
        class="flex h-full min-h-0 flex-1 flex-col overflow-hidden p-0"
      >
        <QuerySourceEditor
          :model-value="editor.source"
          class="min-h-0 flex-1"
          @update:model-value="(value) => editor?.applySourceText(value)"
        />
      </div>

      <div v-else class="h-full min-h-0 flex-1 overflow-hidden p-0">
        <div class="h-full overflow-auto p-4">
          <BehaviorBindingEditor
            :editor-model="editor"
            owner-type="query"
            :owner-id="editor.id ?? null"
            target-type="query"
            :target-id="editor.id ?? null"
            :project-id="projectId"
            :document-type="queryDocumentType"
          />
        </div>
      </div>
    </div>
  </SourceDocumentEditorShell>
</template>
