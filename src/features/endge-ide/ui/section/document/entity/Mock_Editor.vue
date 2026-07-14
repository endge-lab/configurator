<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { RMockEditor } from '@/features/endge-ide/domain/entities/RMockEditor'

import { Endge } from '@endge/core'
import {
  AlignLeft,
  Cable,
  FileText,
  Loader2,
  Save,
  Settings2,
  TriangleAlert,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide'
import ScriptEditor from '@/features/endge-ide/ui/components/ScriptEditor.vue'
import SourceDocumentEditorShell from '@/features/endge-ide/ui/components/source-document-editor/SourceDocumentEditorShell.vue'

interface ScriptEditorHandle {
  formatDocument: () => Promise<void>
}

const props = defineProps<{
  tabContext?: { editor?: RMockEditor }
}>()

const editor = computed(() => props.tabContext?.editor ?? null)
const activeTab = ref<'general' | 'content' | 'diagnostics'>('content')
const sourceEditorRef = ref<ScriptEditorHandle | null>(null)
const monacoLanguage = computed(() =>
  editor.value?.contentType === 'text/plain' ? 'plaintext' : 'json',
)
const bindingConnected = computed(() => {
  const current = editor.value
  if (
    !current
    || current.contentSource !== 'code-provider'
    || !current.codeRef.trim()
  ) {
    return false
  }
  return Endge.mock
    .listProviders()
    .some(provider => provider.ref === current.codeRef.trim())
})

function setContentSource(value: unknown): void {
  if (!editor.value) {
    return
  }
  editor.value.contentSource
    = value === 'code-provider' ? 'code-provider' : 'document'
  editor.value.refreshDiagnostics()
}

function setContentType(value: unknown): void {
  if (!editor.value) {
    return
  }
  editor.value.contentType
    = value === 'text/plain' ? 'text/plain' : 'application/json'
  editor.value.refreshDiagnostics()
}

function updateSource(value: string): void {
  editor.value?.applySourceText(value)
}

async function save(): Promise<void> {
  const current = editor.value
  if (!current) {
    return
  }

  current.identity = current.identity.trim()
  current.name = current.name.trim() || current.identity
  current.codeRef = current.codeRef.trim()
  current.refreshDiagnostics()

  const blocking = current.diagnostics.find(
    message =>
      message.startsWith('Identity')
      || message.startsWith('Для code-provider')
      || message.startsWith('Некорректный JSON'),
  )
  if (blocking) {
    toast.error('Mock не сохранен', { description: blocking })
    activeTab.value = blocking.startsWith('Identity') ? 'general' : 'content'
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
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon"
                variant="ghost"
                class="h-7 w-7"
                :class="
                  activeTab === 'content'
                    ? 'bg-background shadow-sm'
                    : 'text-muted-foreground'
                "
                aria-label="Данные"
                @click="activeTab = 'content'"
              >
                <FileText class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Данные</TooltipContent>
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
                :class="
                  activeTab === 'diagnostics'
                    ? 'bg-background shadow-sm'
                    : 'text-muted-foreground'
                "
                :aria-label="`Диагностика: ${editor.diagnostics.length}`"
                @click="activeTab = 'diagnostics'"
              >
                <TriangleAlert class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Диагностика: {{ editor.diagnostics.length }}
            </TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" class="mx-0.5 h-5" />
        <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon" class="h-7 w-7" :disabled="EndgeIDE.busy.value" aria-label="Сохранить Mock" @click="save">
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
        <template v-if="activeTab === 'content' && editor.contentSource === 'document'">
          <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
            <Select
              :model-value="editor.contentType"
              @update:model-value="setContentType"
            >
              <SelectTrigger class="h-7 w-28 border-0 bg-transparent px-2 text-xs shadow-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="application/json">
                  JSON
                </SelectItem>
                <SelectItem value="text/plain">
                  Plain text
                </SelectItem>
              </SelectContent>
            </Select>

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
        </template>
      </TooltipProvider>
    </template>

    <div
      v-if="activeTab === 'general'"
      class="min-h-0 flex-1 overflow-auto p-6"
    >
      <div class="max-w-2xl space-y-5">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="mock-name">Название</Label>
            <Input
              id="mock-name"
              v-model="editor.name"
              placeholder="Orders response"
            />
          </div>
          <div class="space-y-2">
            <Label for="mock-identity">Identity</Label>
            <Input
              id="mock-identity"
              v-model="editor.identity"
              placeholder="orders-response"
              spellcheck="false"
            />
          </div>
        </div>
        <div class="space-y-2">
          <Label for="mock-description">Описание</Label>
          <Textarea
            id="mock-description"
            v-model="editor.description"
            :rows="4"
            placeholder="Назначение и сценарий mock-данных"
          />
        </div>
        <div class="space-y-2">
          <Label>Источник данных</Label>
          <Select
            :model-value="editor.contentSource"
            @update:model-value="setContentSource"
          >
            <SelectTrigger class="max-w-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="document">
                Документ Payload
              </SelectItem>
              <SelectItem value="code-provider">
                Code provider
              </SelectItem>
            </SelectContent>
          </Select>
          <p class="text-xs text-muted-foreground">
            Code provider supplies only content. Identity, folders and relations
            still belong to this document.
          </p>
        </div>
      </div>
    </div>

    <div
      v-else-if="activeTab === 'content'"
      class="flex min-h-0 flex-1 flex-col"
    >
      <template v-if="editor.contentSource === 'document'">
        <ScriptEditor
          ref="sourceEditorRef"
          :model-value="editor.source"
          :language="monacoLanguage"
          class="min-h-0 flex-1"
          min-height="100%"
          @update:model-value="updateSource"
        />
      </template>

      <div v-else class="flex-1 overflow-auto p-6">
        <div class="max-w-2xl space-y-5">
          <div class="rounded-lg border bg-muted/20 p-4">
            <div class="mb-3 flex items-center gap-2 text-sm font-medium">
              <Cable class="size-4" />Code provider binding
            </div>
            <div class="space-y-2">
              <Label for="mock-code-ref">Provider ref</Label>
              <Input
                id="mock-code-ref"
                v-model="editor.codeRef"
                placeholder="@app:mocks.orders"
                spellcheck="false"
                @blur="editor.refreshDiagnostics()"
              />
              <p
                class="text-xs"
                :class="
                  bindingConnected
                    ? 'text-emerald-600'
                    : 'text-muted-foreground'
                "
              >
                {{
                  bindingConnected
                    ? "Provider connected in current runtime."
                    : "Provider may be connected later by the application bundle."
                }}
              </p>
            </div>
          </div>
          <p class="text-sm text-muted-foreground">
            Provider availability is a runtime check and does not block saving
            the persisted document.
          </p>
        </div>
      </div>
    </div>

    <div v-else class="min-h-0 flex-1 overflow-auto bg-muted/20 p-5">
      <div v-if="editor.diagnostics.length" class="max-w-3xl space-y-2">
        <div
          v-for="message in editor.diagnostics"
          :key="message"
          class="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm"
        >
          {{ message }}
        </div>
      </div>
      <div v-else class="text-sm text-muted-foreground">
        Ошибок нет.
      </div>
    </div>
  </SourceDocumentEditorShell>
</template>
