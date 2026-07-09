<script setup lang="ts">
import type { DomainDocumentType } from '@endge/core'
import type { RQueryEditor } from '@/features/endge-ide/domain/entities/RQueryEditor'

import { Endge, QueryType } from '@endge/core'
import { Code2, Loader2, Play, Radio, Save } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import BehaviorBindingEditor from '@/features/endge-ide/ui/components/BehaviorBindingEditor.vue'
import QuerySourceEditor from '@/features/endge-ide/ui/components/QuerySourceEditor.vue'

const tabs = EndgeIDE.tabs
const editor = computed<RQueryEditor | null>(() => tabs.documentEditorModel.value as RQueryEditor | null)
const queryDocumentType = QueryType.REST as DomainDocumentType
const activeTab = ref<'source' | 'events'>('source')
const runQueryLoading = ref(false)
const tabButtons = [
  { value: 'source', icon: Code2, label: 'Source' },
  { value: 'events', icon: Radio, label: 'События' },
] as const

const projectId = computed(() => {
  const raw = (tabs.documentModel.value as { project?: unknown } | null)?.project
  if (raw == null)
    return null
  const id = Number(raw)
  return Number.isFinite(id) ? id : null
})

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
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

    const result = await Endge.query.run(query, {})
    console.log('[Query_Editor] Результат запроса:', result)
    toast.success('Запрос выполнен', { description: 'Результат выведен в консоль' })
  }
  catch (error: any) {
    console.error('[Query_Editor] Ошибка выполнения запроса:', error)
    toast.error('Ошибка выполнения запроса', { description: error?.message ?? String(error) })
  }
  finally {
    runQueryLoading.value = false
  }
}

async function buildQueryArtifact(idOrIdentity: string | number): Promise<void> {
  const query = Endge.domain.getQuery(idOrIdentity)
  if (!query)
    throw new Error(`Query not found: "${idOrIdentity}".`)

  Endge.compiler.buildQuery(query)

  const artifact = Endge.program.getQueryArtifact(idOrIdentity)
  if (!artifact)
    throw new Error(`Query artifact is missing for "${idOrIdentity}". Compile domain before running query.`)
  if (artifact.status === 'error') {
    const message = artifact.diagnostics[0]?.message ?? `Query artifact has compile errors for "${idOrIdentity}".`
    throw new Error(message)
  }
}
</script>

<template>
  <div v-if="!editor" class="p-4 text-sm text-muted-foreground">
    Нет редактора
  </div>
  <div v-else class="query-editor-root flex h-full min-h-0 w-full flex-col overflow-hidden">
    <div class="flex min-h-0 flex-1 flex-col gap-4 p-5">
      <div class="flex shrink-0 items-center gap-3 min-w-0">
        <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
          <i class="ti ti-api text-2xl text-orange-500" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="truncate text-lg font-semibold">
            {{ editor.name ?? 'Запрос' }}
          </div>
          <div class="truncate text-xs text-muted-foreground">
            id: {{ editor.id ?? '-' }} · identity: {{ editor.identity ?? '-' }}
          </div>
        </div>
        <TooltipProvider>
          <div class="flex shrink-0 items-center rounded-md border bg-muted/40 p-0.5">
            <Tooltip
              v-for="item in tabButtons"
              :key="item.value"
            >
              <TooltipTrigger as-child>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  class="h-8 w-8"
                  :class="activeTab === item.value ? 'bg-background shadow-sm' : 'text-muted-foreground'"
                  :aria-label="item.label"
                  @click="activeTab = item.value"
                >
                  <component :is="item.icon" class="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{{ item.label }}</TooltipContent>
            </Tooltip>
          </div>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                type="button"
                variant="outline"
                size="icon"
                class="h-9 w-9 shrink-0"
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

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                class="h-9 w-9 shrink-0"
                aria-label="Сохранить"
                :disabled="EndgeIDE.busy.value"
                @click="save"
              >
                <Loader2 v-if="EndgeIDE.busy.value" class="size-4 animate-spin" />
                <Save v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Сохранить</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Card class="flex h-full min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0">
        <div v-if="activeTab === 'source'" class="flex h-full min-h-0 flex-1 flex-col overflow-hidden p-0">
          <QuerySourceEditor
            :model-value="editor.source"
            class="min-h-0 flex-1"
            @update:model-value="value => editor?.applySourceText(value)"
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
      </Card>
    </div>
  </div>
</template>

<style scoped>
.query-editor-root {
  min-height: calc(100dvh - 72px);
}
</style>
