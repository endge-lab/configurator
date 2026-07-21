<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { RComputationEditor } from '@/features/endge-ide/domain/entities/RComputationEditor'

import { Code2, Loader2, Save, Settings2, TriangleAlert } from 'lucide-vue-next'
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
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide'
import { createEditorDiagnosticsEntityRef } from '@/features/endge-ide/model/diagnostics/editor-diagnostics-entity-ref'
import ComputationSourceEditor from '@/features/endge-ide/ui/components/ComputationSourceEditor.vue'
import EntityProblemsPanel from '@/features/endge-ide/ui/components/diagnostics/EntityProblemsPanel.vue'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'
import SourceFormatButton from '@/features/endge-ide/ui/components/source-document-editor/SourceFormatButton.vue'
import TypeRegistrySelect from '@/features/endge-ide/ui/components/TypeRegistrySelect.vue'

interface ScriptEditorHandle {
  formatDocument: () => Promise<void>
}

const props = defineProps<{ tabContext?: { editor?: RComputationEditor } }>()
const editor = computed(() => props.tabContext?.editor ?? null)
const activeTab = useSmartTabSelection(
  'editor.active-tab',
  'implementation',
  ['general', 'implementation', 'diagnostics'] as const,
)
const diagnosticsEntityRef = computed(() => createEditorDiagnosticsEntityRef('computation', editor.value))
const sourceEditorRef = ref<ScriptEditorHandle | null>(null)

function applySourceText(value: string): void {
  editor.value?.applySourceText(value)
}

async function save(): Promise<void> {
  const current = editor.value
  if (!current) {
    return
  }
  current.identity = current.identity.trim()
  current.name = current.name.trim() || current.identity
  current.refreshDiagnostics()
  if (current.diagnostics.length) {
    toast.error('Computation не сохранен', { description: current.diagnostics[0] })
    activeTab.value = current.diagnostics[0]?.startsWith('Identity') ? 'general' : 'implementation'
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
    document-type="computation"
    :dependency-source="editor.source"
    :dependency-draft="editor"
  >
    <template #center>
      <TooltipProvider>
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button size="icon" variant="ghost" class="h-7 w-7" :class="activeTab === 'general' ? 'bg-editor-control shadow-sm' : 'text-muted-foreground'" aria-label="Основное" @click="activeTab = 'general'">
                <Settings2 class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Основное</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button size="icon" variant="ghost" class="h-7 w-7" :class="activeTab === 'implementation' ? 'bg-editor-control shadow-sm' : 'text-muted-foreground'" aria-label="Реализация" @click="activeTab = 'implementation'">
                <Code2 class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Реализация</TooltipContent>
          </Tooltip>
        </div>
        <Separator orientation="vertical" class="mx-0.5 h-5" />
        <Button size="icon" variant="ghost" class="h-7 w-7" :class="activeTab === 'diagnostics' ? 'bg-editor-control shadow-sm' : 'text-muted-foreground'" aria-label="Диагностика" @click="activeTab = 'diagnostics'">
          <TriangleAlert class="size-4" />
        </Button>
        <Separator orientation="vertical" class="mx-0.5 h-5" />
        <Tooltip>
          <TooltipTrigger as-child>
            <Button size="icon" variant="ghost" class="h-7 w-7" :disabled="EndgeIDE.busy.value" aria-label="Сохранить Computation" @click="save">
              <Loader2 v-if="EndgeIDE.busy.value" class="size-4 animate-spin" />
              <Save v-else class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Сохранить</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </template>

    <template #right>
      <div v-if="activeTab === 'implementation'" class="flex items-center rounded-md border bg-muted/40 p-0.5">
        <SourceFormatButton @click="sourceEditorRef?.formatDocument()" />
      </div>
    </template>

    <div v-if="activeTab === 'general'" class="min-h-0 flex-1 overflow-auto p-6">
      <div class="max-w-2xl space-y-5">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="computation-name">Название</Label><Input id="computation-name" v-model="editor.name" />
          </div>
          <div class="space-y-2">
            <Label for="computation-identity">Identity</Label><Input id="computation-identity" v-model="editor.identity" spellcheck="false" />
          </div>
        </div>
        <div class="space-y-2">
          <Label for="computation-description">Описание</Label><Textarea id="computation-description" v-model="editor.description" :rows="4" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="computation-source-version">Source version</Label><Input id="computation-source-version" v-model.number="editor.sourceVersion" type="number" min="1" />
          </div>
          <div class="space-y-2">
            <Label for="computation-contract-version">Contract version</Label><Input id="computation-contract-version" v-model.number="editor.contractVersion" type="number" min="1" />
          </div>
        </div>
        <div class="space-y-3">
          <Label>Контракт</Label>
          <p class="text-xs text-muted-foreground">
            Опционально: ComponentSFC ports v1 не проверяют persisted input/output contract.
          </p>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-3 rounded-lg border p-3">
              <Label for="computation-input-type">Input type identity</Label>
              <TypeRegistrySelect id="computation-input-type" v-model="editor.inputType" placeholder="Выберите входной тип" />
              <div class="flex items-center gap-4">
                <label class="flex items-center gap-2 text-sm"><Checkbox v-model:checked="editor.inputIsArray" />Массив</label>
                <label class="flex items-center gap-2 text-sm"><Checkbox v-model:checked="editor.inputOptional" />Опционально</label>
              </div>
            </div>
            <div class="space-y-3 rounded-lg border p-3">
              <Label for="computation-output-type">Output type identity</Label>
              <TypeRegistrySelect id="computation-output-type" v-model="editor.outputType" placeholder="Выберите выходной тип" />
              <div class="flex items-center gap-4">
                <label class="flex items-center gap-2 text-sm"><Checkbox v-model:checked="editor.outputIsArray" />Массив</label>
                <label class="flex items-center gap-2 text-sm"><Checkbox v-model:checked="editor.outputOptional" />Опционально</label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="activeTab === 'implementation'" class="flex min-h-0 flex-1 flex-col">
      <ComputationSourceEditor ref="sourceEditorRef" :model-value="editor.source" @update:model-value="applySourceText" />
    </div>

    <EntityProblemsPanel
      v-else-if="diagnosticsEntityRef"
      :entity-ref="diagnosticsEntityRef"
      class="min-h-0 flex-1"
    />
  </SourceDocumentEditorShell>
</template>
