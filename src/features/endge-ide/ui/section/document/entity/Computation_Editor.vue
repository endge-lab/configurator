<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { RComputationEditor } from '@/features/endge-ide/domain/entities/RComputationEditor'

import { AlignLeft, Cable, Code2, FileText, Loader2, Save, Settings2, TriangleAlert } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide'
import ScriptEditor from '@/features/endge-ide/ui/components/ScriptEditor.vue'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'

interface ScriptEditorHandle {
  formatDocument: () => Promise<void>
}

const props = defineProps<{ tabContext?: { editor?: RComputationEditor } }>()
const editor = computed(() => props.tabContext?.editor ?? null)
const activeTab = ref<'general' | 'implementation' | 'diagnostics'>('implementation')
const sourceEditorRef = ref<ScriptEditorHandle | null>(null)

function setImplementationKind(value: unknown): void {
  if (!editor.value) {
    return
  }
  editor.value.implementationKind = value === 'provider' ? 'provider' : 'source'
  editor.value.refreshDiagnostics()
}

function setSourceLanguage(value: unknown): void {
  if (!editor.value) {
    return
  }
  editor.value.sourceLanguage = value === 'endge' ? 'endge' : 'typescript'
}

async function save(): Promise<void> {
  const current = editor.value
  if (!current) {
    return
  }
  current.identity = current.identity.trim()
  current.name = current.name.trim() || current.identity
  current.providerRef = current.providerRef.trim()
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
  <SourceDocumentEditorShell v-if="editor" :document-id="editor.id" :identity="editor.identity">
    <template #center>
      <TooltipProvider>
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button size="icon" variant="ghost" class="h-7 w-7" :class="activeTab === 'general' ? 'bg-background shadow-sm' : 'text-muted-foreground'" aria-label="Основное" @click="activeTab = 'general'">
                <Settings2 class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Основное</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button size="icon" variant="ghost" class="h-7 w-7" :class="activeTab === 'implementation' ? 'bg-background shadow-sm' : 'text-muted-foreground'" aria-label="Реализация" @click="activeTab = 'implementation'">
                <Code2 class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Реализация</TooltipContent>
          </Tooltip>
        </div>
        <Separator orientation="vertical" class="mx-0.5 h-5" />
        <Button size="icon" variant="ghost" class="h-7 w-7" :class="activeTab === 'diagnostics' ? 'bg-background shadow-sm' : 'text-muted-foreground'" aria-label="Диагностика" @click="activeTab = 'diagnostics'">
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
      <div v-if="activeTab === 'implementation' && editor.implementationKind === 'source'" class="flex items-center rounded-md border bg-muted/40 p-0.5">
        <Select :model-value="editor.sourceLanguage" @update:model-value="setSourceLanguage">
          <SelectTrigger class="h-7 w-28 border-0 bg-transparent px-2 text-xs shadow-none focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="typescript">
              TypeScript
            </SelectItem>
            <SelectItem value="endge">
              Endge
            </SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" class="h-7 w-7" aria-label="Форматировать" @click="sourceEditorRef?.formatDocument()">
          <AlignLeft class="size-4" />
        </Button>
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
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-3 rounded-lg border p-3">
              <Label for="computation-input-type">Input type identity</Label>
              <Input id="computation-input-type" v-model="editor.inputType" placeholder="app.ground-handling.input" spellcheck="false" />
              <div class="flex items-center gap-4">
                <label class="flex items-center gap-2 text-sm"><Checkbox v-model:checked="editor.inputIsArray" />Массив</label>
                <label class="flex items-center gap-2 text-sm"><Checkbox v-model:checked="editor.inputOptional" />Опционально</label>
              </div>
            </div>
            <div class="space-y-3 rounded-lg border p-3">
              <Label for="computation-output-type">Output type identity</Label>
              <Input id="computation-output-type" v-model="editor.outputType" placeholder="app.ground-handling.cell-state" spellcheck="false" />
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
      <div class="flex items-center gap-3 border-b px-4 py-2">
        <FileText v-if="editor.implementationKind === 'source'" class="size-4 text-muted-foreground" />
        <Cable v-else class="size-4 text-muted-foreground" />
        <Select :model-value="editor.implementationKind" @update:model-value="setImplementationKind">
          <SelectTrigger class="h-8 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="source">
              Source
            </SelectItem>
            <SelectItem value="provider">
              Code provider
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <ScriptEditor v-if="editor.implementationKind === 'source'" ref="sourceEditorRef" :model-value="editor.source" :language="editor.sourceLanguage === 'typescript' ? 'typescript' : 'plaintext'" class="min-h-0 flex-1" min-height="100%" @update:model-value="editor.applySourceText" />
      <div v-else class="flex-1 overflow-auto p-6">
        <div class="max-w-2xl space-y-3 rounded-lg border bg-muted/20 p-4">
          <Label for="computation-provider-ref">Provider ref</Label>
          <Input id="computation-provider-ref" v-model="editor.providerRef" placeholder="@app:ground-handling.cell-state" spellcheck="false" @blur="editor.refreshDiagnostics()" />
          <p class="text-xs text-muted-foreground">
            The application bundle registers this stable ref and owns the executable code.
          </p>
        </div>
      </div>
    </div>

    <div v-else class="min-h-0 flex-1 overflow-auto bg-muted/20 p-5">
      <div v-if="editor.diagnostics.length" class="max-w-3xl space-y-2">
        <div v-for="message in editor.diagnostics" :key="message" class="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
          {{ message }}
        </div>
      </div>
      <div v-else class="text-sm text-muted-foreground">
        Ошибок нет.
      </div>
    </div>
  </SourceDocumentEditorShell>
</template>
