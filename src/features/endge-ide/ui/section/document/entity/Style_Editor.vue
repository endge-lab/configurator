<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { RStyleEditor } from '@/features/endge-ide/domain/entities/RStyleEditor'

import { compileEndgeCSS } from '@endge/core'
import { materializeEndgeCSSForDOM } from '@endge/vue'
import { Code2, Loader2, Save, Settings2 } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide'
import EndgeStyleSourceEditor from '@/features/endge-ide/ui/components/EndgeStyleSourceEditor.vue'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'
import SourceEditorSplitView from '@/features/endge-ide/ui/components/source-document-editor/SourceEditorSplitView.vue'

const props = defineProps<{ tabContext?: { editor?: RStyleEditor } }>()
const editor = computed(() => props.tabContext?.editor ?? null)
const activeTab = ref<'general' | 'source'>('source')
const splitRatio = ref(0.68)
const compilation = computed(() => compileEndgeCSS(editor.value?.source ?? '', {
  identity: editor.value?.identity || 'draft-style',
}))
const generatedCSS = computed(() => compilation.value.artifact
  ? materializeEndgeCSSForDOM([compilation.value.artifact]).css
  : '/* Invalid EndgeCSS is not materialized. */')

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
    toast.error('Стиль не сохранён', { description: current.diagnostics[0] })
    activeTab.value = 'general'
    return
  }
  await EndgeIDE.tabs.save()
}
</script>

<template>
  <SourceDocumentEditorShell v-if="editor" :document-id="editor.id" :identity="editor.identity">
    <template #metadata-after>
      <div v-if="editor.isSystem" class="flex min-w-0 items-center gap-1.5">
        <span class="shrink-0 text-muted-foreground">kind:</span>
        <span class="min-w-0 truncate font-mono text-foreground/80">system</span>
      </div>
    </template>

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
              <Button size="icon" variant="ghost" class="h-7 w-7" :class="activeTab === 'source' ? 'bg-background shadow-sm' : 'text-muted-foreground'" aria-label="Source" @click="activeTab = 'source'">
                <Code2 class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Source</TooltipContent>
          </Tooltip>
        </div>
        <Separator orientation="vertical" class="mx-0.5 h-5" />
        <Tooltip>
          <TooltipTrigger as-child>
            <Button size="icon" variant="ghost" class="h-7 w-7" :disabled="EndgeIDE.busy.value" aria-label="Сохранить стиль" @click="save">
              <Loader2 v-if="EndgeIDE.busy.value" class="size-4 animate-spin" />
              <Save v-else class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Сохранить</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </template>

    <div v-if="activeTab === 'general'" class="min-h-0 flex-1 overflow-auto p-6">
      <div class="max-w-2xl space-y-5">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="style-name">Название</Label>
            <Input id="style-name" v-model="editor.name" :disabled="editor.isSystem" />
          </div>
          <div class="space-y-2">
            <Label for="style-identity">Identity</Label>
            <Input id="style-identity" v-model="editor.identity" :disabled="editor.isSystem" spellcheck="false" />
          </div>
        </div>
        <div class="space-y-2">
          <Label for="style-description">Описание</Label>
          <Textarea id="style-description" v-model="editor.description" :rows="4" />
        </div>
        <div class="max-w-xs space-y-2">
          <Label for="style-source-version">Source version</Label>
          <Input id="style-source-version" v-model.number="editor.sourceVersion" type="number" min="1" />
        </div>
        <p class="text-xs text-muted-foreground">Payload stores only source. AST, semantic artifact and DOM CSS are derived during compilation.</p>
      </div>
    </div>

    <div v-else class="flex min-h-0 flex-1 flex-col">
      <SourceEditorSplitView v-model:ratio="splitRatio" :output-visible="true" separator-label="Изменить ширину EndgeCSS и CSS preview">
        <template #editor>
          <EndgeStyleSourceEditor :model-value="editor.source" @update:model-value="applySourceText" />
        </template>
        <template #output>
          <div class="flex h-full min-h-0 flex-col bg-slate-950 text-slate-200">
            <div class="border-b border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Derived DOM CSS · {{ compilation.diagnostics.length }} diagnostics
            </div>
            <div v-if="compilation.diagnostics.length" class="max-h-36 overflow-auto border-b border-slate-800 p-2">
              <div v-for="diagnostic in compilation.diagnostics" :key="`${diagnostic.code}:${diagnostic.range?.start}`" class="mb-1 rounded bg-slate-900 px-2 py-1 text-xs" :class="diagnostic.severity === 'error' ? 'text-red-300' : 'text-amber-300'">
                {{ diagnostic.code }}: {{ diagnostic.message }}
              </div>
            </div>
            <pre class="min-h-0 flex-1 overflow-auto p-3 text-xs leading-5"><code>{{ generatedCSS }}</code></pre>
          </div>
        </template>
      </SourceEditorSplitView>
    </div>
  </SourceDocumentEditorShell>
</template>
