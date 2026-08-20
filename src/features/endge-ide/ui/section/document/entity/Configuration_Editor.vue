<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { ConfigurationSourceValueDefinition, EndgeJSONValue } from '@endge/core'
import type { RConfigurationEditor } from '@/features/endge-ide/domain/entities/RConfigurationEditor'

import { Endge, inferConfigurationDefault } from '@endge/core'
import { Code2, Eye, Loader2, Plus, Save, Settings2, Trash2 } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useSmartTabSelection } from '@/components/ui/smart-tabs'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/model/kernel/endge-ide'
import ConfigurationSourceEditor from '@/features/endge-ide/ui/components/ConfigurationSourceEditor.vue'
import ConfigValueEditor from '@/features/endge-ide/ui/components/configuration/ConfigValueEditor.vue'
import DocumentIdField from '@/features/endge-ide/ui/components/source-document-editor/DocumentIdField.vue'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'
import SourceFormatButton from '@/features/endge-ide/ui/components/source-document-editor/SourceFormatButton.vue'

const props = defineProps<{ tabContext?: { editor?: RConfigurationEditor } }>()
const editor = computed(() => props.tabContext?.editor ?? null)
const activeTab = useSmartTabSelection('editor.configuration.active-tab', 'visual', ['general', 'visual', 'source'] as const)
const sourceEditorRef = ref<{ formatDocument: () => Promise<void> } | null>(null)
const typeOptions = computed(() => [...new Set([
  'String', 'Number', 'Boolean', 'ID', 'Null', 'Time', 'DateTime', 'Object', 'Any', 'TriggerSet', 'JSON',
  ...Endge.configurationSchema.typeCatalog.map(item => item.identity),
])])

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }
function applySource(value: string): void { editor.value?.applySourceText(value) }
function updateValue(value: ConfigurationSourceValueDefinition, patch: Partial<ConfigurationSourceValueDefinition>): void {
  editor.value?.updateValue({ ...clone(value), ...patch, defaultWasInferred: false })
}
function updateDefault(value: ConfigurationSourceValueDefinition, defaultValue: EndgeJSONValue): void { updateValue(value, { defaultValue }) }
function updateType(value: ConfigurationSourceValueDefinition, identity: string): void {
  const type = { kind: 'reference' as const, identity }
  const inferred = inferConfigurationDefault(type, Endge.configurationSchema.typeCatalog)
  updateValue(value, { type, ...(inferred.ok ? { defaultValue: inferred.value } : {}) })
}
function addValue(): void {
  const values = editor.value?.values ?? []
  let index = values.length + 1
  while (values.some(item => item.key === `setting${index}`)) index++
  editor.value?.updateValue({
    key: `setting${index}`,
    type: { kind: 'reference', identity: 'String' },
    defaultValue: '',
    defaultWasInferred: false,
    label: `Настройка ${index}`,
  })
}
async function save(): Promise<void> {
  const current = editor.value
  if (!current) return
  current.identity = current.identity.trim()
  current.name = current.name.trim() || current.identity
  current.refreshDiagnostics()
  if (current.diagnostics.length) {
    toast.error('Configuration не сохранена', { description: current.diagnostics[0] })
    return
  }
  await EndgeIDE.tabs.save()
}
</script>

<template>
  <SourceDocumentEditorShell v-if="editor" :document-id="editor.id" :identity="editor.identity" :display-name="editor.name" document-type="configuration" :dependency-source="editor.source" :dependency-draft="editor">
    <template #right><div v-if="activeTab === 'source'" class="flex items-center rounded-md border bg-muted/40 p-0.5"><SourceFormatButton @click="sourceEditorRef?.formatDocument()" /></div></template>
    <template #center>
      <TooltipProvider>
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip><TooltipTrigger as-child><Button size="icon" variant="ghost" class="h-7 w-7" :class="activeTab === 'general' ? 'bg-editor-control shadow-sm' : 'text-muted-foreground'" @click="activeTab = 'general'"><Settings2 class="size-4" /></Button></TooltipTrigger><TooltipContent>Основное</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger as-child><Button size="icon" variant="ghost" class="h-7 w-7" :class="activeTab === 'visual' ? 'bg-editor-control shadow-sm' : 'text-muted-foreground'" @click="activeTab = 'visual'"><Eye class="size-4" /></Button></TooltipTrigger><TooltipContent>Visual</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger as-child><Button size="icon" variant="ghost" class="h-7 w-7" :class="activeTab === 'source' ? 'bg-editor-control shadow-sm' : 'text-muted-foreground'" @click="activeTab = 'source'"><Code2 class="size-4" /></Button></TooltipTrigger><TooltipContent>Source</TooltipContent></Tooltip>
        </div>
        <Separator orientation="vertical" class="mx-0.5 h-5" />
        <Tooltip><TooltipTrigger as-child><Button size="icon" variant="ghost" class="h-7 w-7" :disabled="EndgeIDE.busy.value" @click="save"><Loader2 v-if="EndgeIDE.busy.value" class="size-4 animate-spin" /><Save v-else class="size-4" /></Button></TooltipTrigger><TooltipContent>Сохранить</TooltipContent></Tooltip>
      </TooltipProvider>
    </template>

    <div v-if="activeTab === 'general'" class="min-h-0 flex-1 overflow-auto p-6">
      <div class="max-w-2xl space-y-5">
        <DocumentIdField :document-id="editor.id" />
        <div class="grid grid-cols-2 gap-4"><div class="space-y-2"><Label>Название категории</Label><Input v-model="editor.name" /></div><div class="space-y-2"><Label>Identity</Label><Input v-model="editor.identity" spellcheck="false" /></div></div>
        <div class="space-y-2"><Label>Описание</Label><Textarea v-model="editor.description" :rows="4" /></div>
        <div class="space-y-2"><Label>Source version</Label><Input :model-value="1" disabled /></div>
      </div>
    </div>

    <div v-else-if="activeTab === 'visual'" class="min-h-0 flex-1 overflow-auto p-5">
      <div class="mx-auto max-w-4xl space-y-3">
        <div class="flex items-center justify-between"><div><h3 class="text-sm font-semibold">Значения категории</h3><p class="text-xs text-muted-foreground">Порядок соответствует Source.</p></div><Button size="sm" variant="outline" @click="addValue"><Plus class="mr-1.5 size-4" />Добавить</Button></div>
        <div v-if="!editor.values.length" class="rounded-md border border-dashed p-5 text-sm text-muted-foreground">Значения не объявлены.</div>
        <section v-for="value in editor.values" :key="value.key" class="space-y-4 rounded-lg border p-4">
          <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem_auto]">
            <div class="space-y-1.5"><Label>Key</Label><Input :model-value="value.key" disabled /></div>
            <div class="space-y-1.5"><Label>Тип</Label><Select :model-value="value.type.kind === 'reference' ? value.type.identity : value.type.kind" @update:model-value="updateType(value, String($event))"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem v-for="item in typeOptions" :key="item" :value="item">{{ item }}</SelectItem></SelectContent></Select></div>
            <Button size="icon" variant="ghost" class="mt-6 text-muted-foreground hover:text-destructive" @click="editor.removeValue(value.key)"><Trash2 class="size-4" /></Button>
          </div>
          <div class="grid gap-3 md:grid-cols-2"><div class="space-y-1.5"><Label>Label</Label><Input :model-value="value.label" @update:model-value="updateValue(value, { label: String($event ?? '') })" /></div><div class="space-y-1.5"><Label>Description</Label><Input :model-value="value.description ?? ''" @update:model-value="updateValue(value, { description: String($event ?? '') || undefined })" /></div></div>
          <div class="space-y-1.5"><Label>Default</Label><ConfigValueEditor :model-value="value.defaultValue" :type="value.type" :min="value.min" :max="value.max" :step="value.step" @update:model-value="updateDefault(value, $event)" /></div>
          <div v-if="value.type.kind === 'reference' && value.type.identity === 'Number'" class="grid grid-cols-3 gap-3"><div><Label>Min</Label><Input :model-value="value.min" type="number" @update:model-value="updateValue(value, { min: $event === '' ? undefined : Number($event) })" /></div><div><Label>Max</Label><Input :model-value="value.max" type="number" @update:model-value="updateValue(value, { max: $event === '' ? undefined : Number($event) })" /></div><div><Label>Step</Label><Input :model-value="value.step" type="number" @update:model-value="updateValue(value, { step: $event === '' ? undefined : Number($event) })" /></div></div>
        </section>
      </div>
    </div>

    <div v-else class="min-h-0 flex-1"><ConfigurationSourceEditor ref="sourceEditorRef" :model-value="editor.source" :identity="editor.identity" @update:model-value="applySource" /></div>
  </SourceDocumentEditorShell>
</template>
