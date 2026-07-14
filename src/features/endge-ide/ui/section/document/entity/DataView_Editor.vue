<script setup lang="ts">
import type { RDataViewEditor } from '@/features/endge-ide/domain/entities/RDataViewEditor'

import { Endge } from '@endge/core'
import { Code2, FileJson, Loader2, Play, RotateCcw, Save, Settings2, TriangleAlert } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import DataViewSourceEditor from '@/features/endge-ide/ui/components/DataViewSourceEditor.vue'

const tabs = EndgeIDE.tabs
const editor = computed<RDataViewEditor | null>(() => tabs.documentEditorModel.value as RDataViewEditor | null)
const activeTab = ref<'general' | 'source' | 'preview' | 'artifact' | 'diagnostics'>('general')
const previewInput = ref(`{
  "legs": [
    {
      "id": "leg1",
      "flightCarrier": "SU",
      "flightNumber": "522"
    }
  ],
  "attrs": [
    {
      "legId": "leg1",
      "items": [
        {
          "attrId": "std",
          "value": "2025-12-23T00:00:00Z"
        }
      ]
    }
  ]
}`)
const previewOutput = ref('')
const previewDiagnostics = ref<unknown[]>([])
const runningPreview = ref(false)

const tabGroups = [
  [
    { value: 'general', icon: Settings2, label: 'Основное' },
    { value: 'source', icon: Code2, label: 'Source' },
  ],
  [
    { value: 'preview', icon: Play, label: 'Запуск' },
    { value: 'artifact', icon: FileJson, label: 'Артифакт' },
    { value: 'diagnostics', icon: TriangleAlert, label: 'Диагностика' },
  ],
] as const

const artifactJson = computed(() => {
  const current = editor.value
  if (!current)
    return '{}'

  const result = Endge.source.compile('data-view', current.source)
  return JSON.stringify(result.artifact ?? null, null, 2)
})

const diagnosticsJson = computed(() => {
  const diagnostics = [
    ...(editor.value?.diagnostics ?? []),
    ...previewDiagnostics.value,
  ]
  return JSON.stringify(diagnostics, null, 2)
})

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}

function resetToDefaultSource(): void {
  editor.value?.resetSource()
}

function applySourceText(value: string): void {
  editor.value?.applySourceText(value)
}

async function runPreview(): Promise<void> {
  const current = editor.value
  if (!current)
    return

  runningPreview.value = true
  previewDiagnostics.value = []
  try {
    const input = JSON.parse(previewInput.value || '{}')
    const dataView = Endge.domain.getDataView(current.id ?? current.identity)
    if (!dataView)
      throw new Error('DataView не найден в домене')

    current.updateSource(dataView)
    Endge.compiler.buildDataView(dataView)

    const artifact = Endge.program.getDataViewArtifact(dataView.id ?? dataView.identity)
    previewDiagnostics.value = artifact?.diagnostics ?? []
    if (!artifact || artifact.status === 'error') {
      const message = artifact?.diagnostics[0]?.message ?? 'DataView source содержит ошибки'
      throw new Error(message)
    }

    const output = Endge.runtime.dataView.run(dataView, input)
    previewOutput.value = JSON.stringify(output, null, 2)
    toast.success('Preview выполнен')
  }
  catch (error: any) {
    console.error('[DataView_Editor] Preview error:', error)
    previewOutput.value = ''
    toast.error('Ошибка Preview', { description: error?.message ?? String(error) })
  }
  finally {
    runningPreview.value = false
  }
}
</script>

<template>
  <div v-if="!editor" class="p-4 text-sm text-muted-foreground">
    Нет редактора
  </div>
  <div v-else class="data-view-editor-root flex min-h-0 w-full flex-col overflow-hidden">
    <div class="data-view-editor-root__content flex min-h-0 flex-1 flex-col">
      <div class="flex min-w-0 shrink-0 items-center justify-start border-b px-1.5 py-1">
        <TooltipProvider>
          <div class="flex shrink-0 items-center gap-0">
            <template v-for="(group, groupIndex) in tabGroups" :key="groupIndex">
              <Separator v-if="groupIndex" orientation="vertical" class="mx-0.5 h-5" />

              <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
                <Tooltip v-for="item in group" :key="item.value">
                  <TooltipTrigger as-child>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      class="h-7 w-7"
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
            </template>

            <Separator orientation="vertical" class="mx-0.5 h-5" />

            <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="h-7 w-7"
                    aria-label="Сбросить source"
                    @click="resetToDefaultSource"
                  >
                    <RotateCcw class="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Сбросить source</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="h-7 w-7"
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
            </div>
          </div>
        </TooltipProvider>
      </div>

      <Card class="data-view-editor-card flex min-h-0 flex-1 flex-col gap-0 overflow-hidden rounded-none py-0">
        <div v-if="activeTab === 'general'" class="h-full overflow-auto p-6">
          <div class="max-w-2xl space-y-5">
            <div class="space-y-2">
              <Label for="data-view-id">ID</Label>
              <Input
                id="data-view-id"
                :model-value="String(editor.id ?? '')"
                class="bg-muted/40 font-mono"
                readonly
              />
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-2">
                <Label for="data-view-name">Название</Label>
                <Input id="data-view-name" v-model="editor.name" placeholder="Название DataView" />
              </div>

              <div class="space-y-2">
                <Label for="data-view-identity">Identity</Label>
                <Input
                  id="data-view-identity"
                  v-model="editor.identity"
                  placeholder="Уникальный идентификатор"
                  spellcheck="false"
                />
              </div>
            </div>

            <div class="space-y-2">
              <Label for="data-view-description">Описание</Label>
              <Textarea
                id="data-view-description"
                v-model="editor.description"
                rows="5"
                placeholder="Назначение DataView"
              />
            </div>
          </div>
        </div>

        <div v-else-if="activeTab === 'source'" class="flex h-full min-h-0 flex-1 flex-col overflow-hidden p-0">
          <DataViewSourceEditor
            :model-value="editor.source"
            :preview-input="previewInput"
            class="min-h-0 flex-1"
            @update:model-value="applySourceText"
          />
        </div>

        <div v-else-if="activeTab === 'preview'" class="grid h-full min-h-0 flex-1 grid-cols-2 gap-0 overflow-hidden">
          <section class="relative flex h-full min-h-0 flex-col overflow-hidden border-r">
            <div class="shrink-0 border-b px-3 py-2 text-sm font-medium">Input JSON</div>
            <Textarea
              v-model="previewInput"
              class="h-full min-h-0 flex-1 resize-none overflow-auto rounded-none border-0 font-mono text-xs shadow-none focus-visible:ring-0"
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
            <pre class="min-h-0 flex-1 overflow-auto bg-muted/30 p-3 text-xs">{{ previewOutput || 'null' }}</pre>
          </section>
        </div>

        <pre v-else-if="activeTab === 'artifact'" class="min-h-0 flex-1 overflow-auto bg-muted/30 p-4 text-xs">{{ artifactJson }}</pre>
        <pre v-else class="min-h-0 flex-1 overflow-auto bg-muted/30 p-4 text-xs">{{ diagnosticsJson }}</pre>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.data-view-editor-root {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.data-view-editor-root__content {
  height: 100%;
  min-height: 0;
}

.data-view-editor-card {
  min-height: 0;
}

.data-view-editor-card > * {
  min-height: 0;
}
</style>
