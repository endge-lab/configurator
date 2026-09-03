<script setup lang="ts">
import type { RActionEditor } from '@/features/endge-ide/domain/entities/RActionEditor'
import { Endge } from '@endge/core'
import { Code2, FileJson, Loader2, Plus, Save, Settings2, Trash2, TriangleAlert } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'
import { createEditorDiagnosticsEntityRef } from '@/features/endge-ide/services/diagnostics/editor-diagnostics-entity-ref'
import ActionSourceEditor from '@/features/endge-ide/ui/components/ActionSourceEditor.vue'
import EntityProblemsPanel from '@/features/endge-ide/ui/components/diagnostics/EntityProblemsPanel.vue'
import DocumentIdentityInput from '@/features/endge-ide/ui/components/source-document-editor/DocumentIdentityInput.vue'
import DocumentIdField from '@/features/endge-ide/ui/components/source-document-editor/DocumentIdField.vue'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'
import SourceFormatButton from '@/features/endge-ide/ui/components/source-document-editor/SourceFormatButton.vue'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Separator } from '@/shared/ui/separator'
import { useSmartTabSelection } from '@/shared/ui/smart-tabs'
import { Textarea } from '@/shared/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const props = defineProps<{ tabContext?: { editor?: RActionEditor } }>()
const editor = computed(() => props.tabContext?.editor ?? null)
const activeTab = useSmartTabSelection('editor.active-tab', 'source', ['general', 'source', 'artifact', 'diagnostics'] as const)
const sourceEditorRef = ref<{ formatDocument: () => Promise<void> } | null>(null)
const diagnosticsEntityRef = computed(() => createEditorDiagnosticsEntityRef('action', editor.value))
const artifactJson = computed(() => JSON.stringify(editor.value ? Endge.source.compile('action', editor.value.source).artifact ?? null : null, null, 2))
const tabGroups = [
  [
    { value: 'general', icon: Settings2, label: 'Основное' },
    { value: 'source', icon: Code2, label: 'Source' },
  ],
  [
    { value: 'artifact', icon: FileJson, label: 'Артефакт' },
    { value: 'diagnostics', icon: TriangleAlert, label: 'Диагностика' },
  ],
] as const

function addTarget(): void {
  if (!editor.value || editor.value.readOnly) {
    return
  }
  editor.value.target = [...(editor.value.target ?? []), { type: '' }]
}
function removeTarget(index: number): void {
  if (!editor.value || editor.value.readOnly) {
    return
  }
  const next = [...(editor.value.target ?? [])]
  next.splice(index, 1)
  editor.value.target = next.length ? next : null
}
async function save(): Promise<void> {
  const current = editor.value
  if (!current || current.readOnly) {
    return
  }
  current.refreshDiagnostics()
  const error = current.diagnostics.find(item => item.severity === 'error')
  if (error) {
    toast.error('Action не сохранён', { description: error.message })
    activeTab.value = 'source'
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
    :display-name="editor.displayName"
    document-type="action"
    :dependency-source="editor.source"
    :dependency-draft="editor"
  >
    <template #center>
      <TooltipProvider>
        <template v-for="(group, groupIndex) in tabGroups" :key="groupIndex">
          <Separator v-if="groupIndex" orientation="vertical" class="mx-0.5 h-5" />
          <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
            <Tooltip v-for="item in group" :key="item.value">
              <TooltipTrigger as-child>
                <Button type="button" size="icon" variant="ghost" class="h-7 w-7" :class="activeTab === item.value ? 'bg-editor-control shadow-sm' : 'text-muted-foreground'" :aria-label="item.label" @click="activeTab = item.value">
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
              <Button type="button" size="icon" variant="ghost" class="h-7 w-7" :disabled="EndgeIDE.busy.value || editor.readOnly" aria-label="Сохранить Action" @click="save">
                <Loader2 v-if="EndgeIDE.busy.value" class="size-4 animate-spin" /><Save v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ editor.readOnly ? $t('uiText.codeOwnedActionIsReadOnlyb0efd855') : $t('uiText.save4864057d') }}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </template>

    <template #right>
      <SourceFormatButton v-if="activeTab === 'source' && !editor.readOnly" @click="sourceEditorRef?.formatDocument()" />
    </template>

    <div v-if="activeTab === 'general'" class="min-h-0 flex-1 overflow-auto p-6">
      <div class="max-w-3xl space-y-5">
        <DocumentIdField :document-id="editor.id" />
        <div v-if="editor.readOnly" class="rounded-md border bg-muted/40 p-3 text-sm">
          {{ $t('uiText.codeOwnedAction3e21f15d') }} {{ editor.origin.kind }} {{ $t('uiText.owner2d6631a2') }} {{ JSON.stringify(editor.owner) }} {{ $t('uiText.provider5f3a1461') }} {{ editor.effectiveProviderKey ?? 'не установлен' }}
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label>{{ $t('uiText.name3de49828') }}</Label><Input v-model="editor.displayName" :disabled="editor.readOnly" />
          </div>
          <div class="space-y-2">
            <Label>{{ $t('uiText.identity7e5a975b') }}</Label><DocumentIdentityInput v-model="editor.identity" :disabled="editor.readOnly" />
          </div>
        </div>
        <div class="space-y-2">
          <Label>{{ $t('uiText.descriptionF5441f6a') }}</Label><Textarea v-model="editor.description" :disabled="editor.readOnly" />
        </div>
        <div class="space-y-2">
          <Label>{{ $t('uiText.sourceVersionb94adbb6') }}</Label><Input v-model.number="editor.sourceVersion" type="number" min="1" :disabled="editor.readOnly" />
        </div>
        <div class="space-y-3 rounded-lg border p-3">
          <div class="flex items-center justify-between">
            <Label>{{ $t('uiText.runtimeTargets69bfee86') }}</Label><Button v-if="!editor.readOnly" size="sm" variant="outline" @click="addTarget">
              <Plus class="mr-1 size-3.5" />{{ $t('uiText.add559a87f7') }}
            </Button>
          </div>
          <div v-for="(target, index) in editor.target ?? []" :key="index" class="grid grid-cols-[1fr_1fr_auto] gap-2">
            <Input v-model="target.type" :disabled="editor.readOnly" placeholder="component.table" />
            <Input v-model="target.identity" :disabled="editor.readOnly" placeholder="optional identity" />
            <Button v-if="!editor.readOnly" size="icon" variant="ghost" @click="removeTarget(index)">
              <Trash2 class="size-4" />
            </Button>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Checkbox :checked="editor.active" :disabled="editor.readOnly" @update:checked="(value: unknown) => editor && (editor.active = value === true)" /><Label>{{ $t('uiText.activeNeuter76ddd792') }}</Label>
        </div>
      </div>
    </div>

    <div v-else-if="activeTab === 'source'" class="flex min-h-0 flex-1 flex-col">
      <ActionSourceEditor ref="sourceEditorRef" :model-value="editor.source" :read-only="editor.readOnly" @update:model-value="editor.applySourceText" />
    </div>
    <pre v-else-if="activeTab === 'artifact'" class="min-h-0 flex-1 overflow-auto bg-muted/30 p-4 text-xs">{{ artifactJson }}</pre>
    <EntityProblemsPanel v-else-if="diagnosticsEntityRef" :entity-ref="diagnosticsEntityRef" class="min-h-0 flex-1" />
  </SourceDocumentEditorShell>
</template>
