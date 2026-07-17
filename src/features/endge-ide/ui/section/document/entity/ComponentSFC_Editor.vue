<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { RComponentSFC } from '@endge/core'

import { Endge, inspectComponentSFCVisual } from '@endge/core'
import { AlignLeft, Bug, Code2, Loader2, Play, Save, Settings2, Table2 } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { createWidgetInstance, getWidgetInstances, showWidget } from '@/components/layouts/grid'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import {
  launchSFCPreview,
  sfcPreviewError,
} from '@/features/endge-ide/model/sfc-preview/sfc-preview-state'
import { createSFCStyleEndgeCSSContribution } from '@/features/endge-ide/source-editor/contributions/component-sfc/endgecss.contribution'
import { createExtractComponentContribution } from '@/features/endge-ide/source-editor/contributions/component-sfc/extract-component'
import ScriptEditor from '@/features/endge-ide/ui/components/ScriptEditor.vue'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'
import ComponentSFCTableVisualEditor from '@/features/endge-ide/ui/section/document/entity/component-sfc/ComponentSFCTableVisualEditor.vue'
import { openEndgeEmbeddedPreview } from '@/features/endge-preview'

interface ScriptEditorHandle {
  formatDocument: () => Promise<void>
}

const tabs = EndgeIDE.tabs
const editor = computed<any>(() => tabs.documentEditorModel.value ?? null)
const launchLoading = ref(false)
const activeTab = ref<'general' | 'visual' | 'source'>('source')
const sourceEditorRef = ref<ScriptEditorHandle | null>(null)
const visualInspection = computed(() => {
  const current = editor.value
  return current ? inspectComponentSFCVisual(current.source ?? '') : null
})
const tableVisualProjection = computed(() => visualInspection.value?.projection ?? null)
const hasTableVisual = computed(() => visualInspection.value?.support.kind === 'table' && tableVisualProjection.value != null)
const tableComponentOptions = computed(() => Endge.domain.getComponentSFCs()
  .filter((component: RComponentSFC) => component.id !== editor.value?.id && Boolean(component.identity?.trim()))
  .map((component: RComponentSFC) => ({
    value: component.identity,
    label: component.displayName || component.name || component.identity,
  })))
const sourceEditorExtensions = [
  createSFCStyleEndgeCSSContribution(),
  createExtractComponentContribution({
    getEditorModel: () => editor.value,
    getPersistedModel: () => tabs.documentModel.value as RComponentSFC | null,
  }),
]

watch(hasTableVisual, (supported) => {
  if (!supported && activeTab.value === 'visual') {
    activeTab.value = 'source'
  }
})

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}

function updateVisualSource(source: string): void {
  const current = editor.value
  if (!current) {
    return
  }
  current.source = source
  current.parseSource?.()
}

async function launchPreview(): Promise<void> {
  const current = editor.value
  if (!current) {
    return
  }

  launchLoading.value = true
  try {
    current.parseSource?.()
    await launchSFCPreview({
      id: current.id,
      identity: current.identity,
      tag: current.tag,
      name: current.name,
      displayName: current.displayName,
      source: current.source,
    })
    sfcPreviewError.value = null
    if (getWidgetInstances('sfc-preview').length) {
      showWidget('sfc-preview')
    }
    else {
      createWidgetInstance('sfc-preview', {})
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    sfcPreviewError.value = message
    if (message === 'Сначала определите превью props') {
      toast.warning('Сначала определите превью props')
    }
    else {
      toast.error('Не удалось запустить демонстрацию', {
        description: message,
      })
    }
  }
  finally {
    launchLoading.value = false
  }
}

function openDebugPreview(): void {
  openEndgeEmbeddedPreview('component-sfc', editor.value?.identity)
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
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                :class="
                  activeTab === 'general'
                    ? 'bg-background shadow-sm'
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
          <Tooltip v-if="hasTableVisual">
            <TooltipTrigger as-child>
              <Button
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                :class="
                  activeTab === 'visual'
                    ? 'bg-background shadow-sm'
                    : 'text-muted-foreground'
                "
                aria-label="Visual Table"
                @click="activeTab = 'visual'"
              >
                <Table2 class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Visual Table</TooltipContent>
          </Tooltip>
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
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                aria-label="Запуск"
                :disabled="launchLoading"
                @click="launchPreview"
              >
                <Loader2 v-if="launchLoading" class="size-4 animate-spin" />
                <Play v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Запустить preview</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                aria-label="Открыть Debug Preview компонента"
                @click="openDebugPreview"
              >
                <Bug class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Открыть Debug Preview сохранённого компонента</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" class="mx-0.5 h-5" />
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button size="icon" variant="ghost" class="h-7 w-7" aria-label="Сохранить" :disabled="EndgeIDE.busy.value" @click="save">
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
        <div v-if="activeTab === 'source'" class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                aria-label="Форматировать"
                @click="sourceEditorRef?.formatDocument()"
              >
                <AlignLeft class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Форматировать</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </template>

    <div v-if="activeTab === 'general'" class="h-full overflow-auto p-6">
      <div class="max-w-2xl space-y-5">
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <Label for="component-sfc-display-name">Название</Label>
            <Input
              id="component-sfc-display-name"
              v-model="editor.displayName"
            />
          </div>
          <div class="space-y-2">
            <Label for="component-sfc-identity">Identity</Label>
            <Input
              id="component-sfc-identity"
              v-model="editor.identity"
              spellcheck="false"
            />
          </div>
        </div>
        <div class="space-y-2">
          <Label for="component-sfc-tag">Tag</Label>
          <Input
            id="component-sfc-tag"
            v-model="editor.tag"
            placeholder="Tail или Module.SomeTag"
            spellcheck="false"
          />
        </div>
        <div class="space-y-2">
          <Label for="component-sfc-description">Описание</Label>
          <Textarea
            id="component-sfc-description"
            v-model="editor.description"
            :rows="5"
          />
        </div>
      </div>
    </div>

    <ComponentSFCTableVisualEditor
      v-else-if="activeTab === 'visual' && tableVisualProjection"
      :source="editor.source"
      :projection="tableVisualProjection"
      :component-options="tableComponentOptions"
      :diagnostics="visualInspection?.diagnostics"
      class="min-h-0 flex-1"
      @update:source="updateVisualSource"
      @open-source="activeTab = 'source'"
    />

    <div v-else class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ScriptEditor
        ref="sourceEditorRef"
        v-model="editor.source"
        :extensions="sourceEditorExtensions"
        language="html"
        format-language="vue"
        class="min-h-0 flex-1"
        min-height="420px"
        @blur="editor.parseSource()"
      />
    </div>
  </SourceDocumentEditorShell>
</template>
