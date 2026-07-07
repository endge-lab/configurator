<script setup lang="ts">
import type { RDataViewEditor } from '@/features/endge-ide/domain/entities/RDataViewEditor'

import { Endge } from '@endge/core'
import { Braces, Code2, FileJson, Loader2, Play, Save, TriangleAlert } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import DataViewSourceEditor from '@/features/endge-ide/ui/components/DataViewSourceEditor.vue'

const tabs = EndgeIDE.tabs
const editor = computed<RDataViewEditor | null>(() => tabs.documentEditorModel.value as RDataViewEditor | null)
const activeTab = ref<'source' | 'preview' | 'artifact' | 'diagnostics'>('source')
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

const tabButtons = [
  { value: 'source', icon: Code2, label: 'Source' },
  { value: 'preview', icon: Play, label: 'Preview' },
  { value: 'artifact', icon: FileJson, label: 'Artifact' },
  { value: 'diagnostics', icon: TriangleAlert, label: 'Diagnostics' },
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

    const output = Endge.dataView.run(dataView, input)
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
    <div class="data-view-editor-root__content flex min-h-0 flex-1 flex-col gap-4 p-5">
      <div class="flex shrink-0 items-center gap-3 min-w-0">
        <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10">
          <Braces class="size-5 text-cyan-600" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="truncate text-lg font-semibold">
            {{ editor.name ?? 'Data View' }}
          </div>
          <div class="truncate text-xs text-muted-foreground">
            id: {{ editor.id ?? '-' }} · identity: {{ editor.identity ?? '-' }}
          </div>
        </div>

        <TooltipProvider>
          <div class="flex shrink-0 items-center rounded-md border bg-muted/40 p-0.5">
            <Tooltip v-for="item in tabButtons" :key="item.value">
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

      <Card class="data-view-editor-card flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0">
        <div v-if="activeTab === 'source'" class="flex h-full min-h-0 flex-1 flex-col overflow-hidden p-0">
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
