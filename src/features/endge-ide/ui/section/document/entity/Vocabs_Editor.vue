<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { RVocabsEditor } from '@/features/endge-ide/domain/entities/RVocabsEditor'

import { Endge } from '@endge/core'
import {
  Code2,
  Database,
  FileJson,
  Loader2,
  RotateCcw,
  Save,
  Settings2,
  TriangleAlert,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useSmartTabSelection } from '@/components/ui/smart-tabs'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { createEditorDiagnosticsEntityRef } from '@/features/endge-ide/model/diagnostics/editor-diagnostics-entity-ref'
import { EndgeIDE } from '@/features/endge-ide/model/kernel/endge-ide'
import EntityProblemsPanel from '@/features/endge-ide/ui/components/diagnostics/EntityProblemsPanel.vue'
import DocumentIdentityInput from '@/features/endge-ide/ui/components/source-document-editor/DocumentIdentityInput.vue'
import DocumentIdField from '@/features/endge-ide/ui/components/source-document-editor/DocumentIdField.vue'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'
import SourceFormatButton from '@/features/endge-ide/ui/components/source-document-editor/SourceFormatButton.vue'
import VocabSourceEditor from '@/features/endge-ide/ui/components/VocabSourceEditor.vue'

interface SourceEditorHandle {
  formatDocument: () => Promise<void>
}
type VocabEditorTab = 'general' | 'source' | 'artifact' | 'diagnostics'
const props = defineProps<{ tabContext?: { editor?: RVocabsEditor } }>()

const tabButtons = [
  { id: 'general', label: 'Общее', icon: Settings2 },
  { id: 'source', label: 'Source', icon: Code2 },
  { id: 'artifact', label: 'Артефакт', icon: FileJson },
  { id: 'diagnostics', label: 'Диагностика', icon: TriangleAlert },
] as const

const editor = computed<RVocabsEditor | null>(() => props.tabContext?.editor ?? null)
const activeTab = useSmartTabSelection(
  'editor.active-tab',
  'source',
  ['general', 'source', 'artifact', 'diagnostics'] as const,
)
const sourceEditorRef = ref<SourceEditorHandle | null>(null)
const loading = ref(false)
const activeModel = computed<boolean>({
  get: () => editor.value?.active !== false,
  set: (value) => {
    if (editor.value) {
      editor.value.active = value === true
    }
  },
})
const compiled = computed(() => editor.value ? Endge.source.compile('vocab', editor.value.source) : null)
const artifactJson = computed(() => JSON.stringify(compiled.value?.artifact ?? null, null, 2))
const canLoadVocab = computed(() => Boolean(compiled.value?.ok && compiled.value?.artifact?.provider))
const diagnosticsEntityRef = computed(() => createEditorDiagnosticsEntityRef('vocab', editor.value))

function selectTab(tab: VocabEditorTab): void {
  activeTab.value = tab
}

async function loadVocab(): Promise<void> {
  const current = editor.value
  if (!current || !canLoadVocab.value) {
    return
  }
  const vocab = Endge.domain.getVocab(current.id ?? current.identity)
  if (!vocab) {
    toast.error('Словарь не найден в домене')
    return
  }

  loading.value = true
  try {
    current.updateSource(vocab)
    Endge.compiler.buildVocab(vocab)
    const docs = await Endge.vocabs.loadVocab(vocab.id ?? vocab.identity, {
      dataMode: 'live',
      throwOnError: true,
    })
    EndgeIDE.modals.openVocabJsonPreview({
      title: current.displayName || current.identity || 'Словарь',
      data: docs,
    })
    toast.success('Payload загружен, output pipeline выполнен', {
      description: `items: ${docs.length}`,
    })
  }
  catch (error) {
    toast.error('Не удалось выполнить полную загрузку словаря', {
      description: error instanceof Error ? error.message : String(error),
    })
  }
  finally {
    loading.value = false
  }
}

async function save(): Promise<void> {
  await EndgeIDE.tabs.save()
}
</script>

<template>
  <SourceDocumentEditorShell
    v-if="editor"
    :document-id="editor.id"
    :identity="editor.identity"
    :display-name="editor.displayName"
    document-type="vocabs"
    :dependency-source="editor.source"
    :dependency-draft="editor"
  >
    <template #center>
      <TooltipProvider>
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip v-for="tab in tabButtons" :key="tab.id">
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                :class="activeTab === tab.id ? 'bg-editor-control shadow-sm' : 'text-muted-foreground'"
                :aria-label="tab.label"
                @click="selectTab(tab.id)"
              >
                <component :is="tab.icon" class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ tab.label }}</TooltipContent>
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
                :disabled="!canLoadVocab || loading"
                aria-label="Полная загрузка словаря"
                @click="loadVocab"
              >
                <Loader2 v-if="loading" class="size-4 animate-spin" />
                <Database v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Полная загрузка provider и итогового items</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" class="mx-0.5 h-5" />
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon" class="h-7 w-7" :disabled="EndgeIDE.busy.value" aria-label="Сохранить" @click="save">
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
      <TooltipProvider v-if="activeTab === 'source'">
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <SourceFormatButton @click="sourceEditorRef?.formatDocument()" />
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon" class="h-7 w-7" aria-label="Сбросить source" @click="editor.resetSource()">
                <RotateCcw class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Сбросить source</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </template>

    <div class="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div v-if="activeTab === 'general'" class="h-full overflow-auto p-6">
        <div class="max-w-2xl space-y-5">
          <DocumentIdField :document-id="editor.id" />
          <label class="flex items-center gap-2 text-sm font-medium">
            <Checkbox v-model:checked="activeModel" />
            Активен
          </label>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="vocab-identity">Identity</Label>
              <DocumentIdentityInput id="vocab-identity" v-model="editor.identity" spellcheck="false" />
            </div>
            <div class="space-y-2">
              <Label for="vocab-name">Название</Label>
              <Input id="vocab-name" v-model="editor.displayName" />
            </div>
          </div>
          <div class="space-y-2">
            <Label for="vocab-description">Описание</Label>
            <Textarea id="vocab-description" v-model="editor.description" :rows="3" />
          </div>
          <div class="max-w-xs space-y-2">
            <Label for="vocab-source-version">Source version</Label>
            <Input id="vocab-source-version" :model-value="editor.sourceVersion" type="number" disabled />
          </div>
        </div>
      </div>
      <VocabSourceEditor
        v-else-if="activeTab === 'source'"
        ref="sourceEditorRef"
        :model-value="editor.source"
        @update:model-value="editor.applySourceText"
      />
      <pre v-else-if="activeTab === 'artifact'" class="h-full overflow-auto bg-muted/30 p-4 text-xs">{{ artifactJson }}</pre>
      <EntityProblemsPanel
        v-else-if="diagnosticsEntityRef"
        :entity-ref="diagnosticsEntityRef"
        :authoring-diagnostics="editor.diagnostics"
        class="min-h-0 flex-1"
      />
    </div>
  </SourceDocumentEditorShell>
</template>
