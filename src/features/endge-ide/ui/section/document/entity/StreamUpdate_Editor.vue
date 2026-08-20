<script setup lang="ts">
import type { RStreamEditor } from '@/features/endge-ide/domain/entities/RStreamEditor'
import type { RUpdateEditor } from '@/features/endge-ide/domain/entities/RUpdateEditor'

import { Endge } from '@endge/core'
import { Code2, FileJson, Loader2, RotateCcw, Save, Settings2, TriangleAlert } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSmartTabSelection } from '@/components/ui/smart-tabs'
import { EndgeIDE } from '@/features/endge-ide/model/kernel/endge-ide'
import { createEditorDiagnosticsEntityRef } from '@/features/endge-ide/model/diagnostics/editor-diagnostics-entity-ref'
import EntityProblemsPanel from '@/features/endge-ide/ui/components/diagnostics/EntityProblemsPanel.vue'
import DocumentIdentityInput from '@/features/endge-ide/ui/components/source-document-editor/DocumentIdentityInput.vue'
import DocumentIdField from '@/features/endge-ide/ui/components/source-document-editor/DocumentIdField.vue'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'
import StreamSourceEditor from '@/features/endge-ide/ui/components/StreamSourceEditor.vue'
import UpdateSourceEditor from '@/features/endge-ide/ui/components/UpdateSourceEditor.vue'

const props = defineProps<{
  sourceKind: 'stream' | 'update'
  title: string
}>()
type EditorModel = RStreamEditor | RUpdateEditor
const editor = computed(() => EndgeIDE.tabs.documentEditorModel.value as EditorModel | null)
const activeTab = useSmartTabSelection(
  `editor.${props.sourceKind}.active-tab`,
  'source',
  ['general', 'source', 'artifact', 'diagnostics'] as const,
)
const sourceEditorRef = ref<{ formatDocument: () => Promise<void> } | null>(null)
const compiled = computed(() => editor.value
  ? Endge.source.compile(props.sourceKind, editor.value.source)
  : null)
const artifactJson = computed(() => JSON.stringify(compiled.value?.artifact ?? null, null, 2))
const diagnosticsEntityRef = computed(() => createEditorDiagnosticsEntityRef(props.sourceKind, editor.value))
const sourceEditor = computed(() => props.sourceKind === 'stream' ? StreamSourceEditor : UpdateSourceEditor)
const ownerStore = computed(() =>
  props.sourceKind === 'update'
    ? (editor.value as RUpdateEditor | null)?.storeIdentity ?? ''
    : '',
)

function updateSource(value: string): void {
  editor.value?.applySourceText(value)
}

function resetSource(): void {
  editor.value?.applySourceText(Endge.source.createDefault(props.sourceKind))
}

async function save(): Promise<void> {
  const current = editor.value
  if (!current)
    return
  current.identity = current.identity.trim()
  current.name = current.name.trim() || current.identity
  if (!current.identity) {
    toast.error(`Identity ${props.title} не может быть пустым`)
    activeTab.value = 'general'
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
    :document-type="sourceKind"
    :dependency-source="editor.source"
    :dependency-draft="editor"
  >
    <template #center>
      <div class="flex items-center gap-1">
        <Button size="icon" variant="ghost" class="h-7 w-7" aria-label="Основное" @click="activeTab = 'general'">
          <Settings2 class="size-4" />
        </Button>
        <Button size="icon" variant="ghost" class="h-7 w-7" aria-label="Source" @click="activeTab = 'source'">
          <Code2 class="size-4" />
        </Button>
        <Button size="icon" variant="ghost" class="h-7 w-7" aria-label="Артефакт" @click="activeTab = 'artifact'">
          <FileJson class="size-4" />
        </Button>
        <Button size="icon" variant="ghost" class="h-7 w-7" aria-label="Диагностика" @click="activeTab = 'diagnostics'">
          <TriangleAlert class="size-4" />
        </Button>
        <Button size="icon" variant="ghost" class="h-7 w-7" :disabled="EndgeIDE.busy.value" aria-label="Сохранить" @click="save">
          <Loader2 v-if="EndgeIDE.busy.value" class="size-4 animate-spin" />
          <Save v-else class="size-4" />
        </Button>
      </div>
    </template>
    <template #right>
      <div class="flex items-center gap-1">
        <Button v-if="activeTab === 'source'" size="sm" variant="ghost" class="h-7" @click="sourceEditorRef?.formatDocument()">
          Форматировать
        </Button>
        <Button size="icon" variant="ghost" class="h-7 w-7" aria-label="Сбросить source" @click="resetSource">
          <RotateCcw class="size-4" />
        </Button>
      </div>
    </template>

    <div class="min-h-0 flex-1 overflow-hidden">
      <div v-if="activeTab === 'general'" class="h-full overflow-auto p-6">
        <div class="max-w-xl space-y-5">
          <DocumentIdField :document-id="editor.id" />
          <div class="space-y-2">
            <Label>Название</Label>
            <Input v-model="editor.name" :placeholder="title" />
          </div>
          <div class="space-y-2">
            <Label>Identity</Label>
            <DocumentIdentityInput v-model="editor.identity" spellcheck="false" />
          </div>
          <div v-if="sourceKind === 'update'" class="space-y-2">
            <Label>Store-владелец</Label>
            <Input :model-value="ownerStore" disabled />
            <p class="text-xs text-muted-foreground">
              Владение задаётся при создании и не меняется в редакторе.
            </p>
          </div>
        </div>
      </div>
      <component
        :is="sourceEditor"
        v-else-if="activeTab === 'source'"
        ref="sourceEditorRef"
        :model-value="editor.source"
        @update:model-value="updateSource"
      />
      <pre v-else-if="activeTab === 'artifact'" class="h-full overflow-auto bg-muted/30 p-4 text-xs">{{ artifactJson }}</pre>
      <EntityProblemsPanel
        v-else-if="diagnosticsEntityRef"
        :entity-ref="diagnosticsEntityRef"
        class="h-full"
      />
    </div>
  </SourceDocumentEditorShell>
</template>
