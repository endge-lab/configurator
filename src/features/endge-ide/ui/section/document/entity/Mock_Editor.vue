<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { RMockEditor } from '@/features/endge-ide/domain/entities/RMockEditor'

import { Endge } from '@endge/core'
import { Braces, Cable, FileText, Loader2, Save, Settings2, TriangleAlert } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide'
import ScriptEditor from '@/features/endge-ide/ui/components/ScriptEditor.vue'

const props = defineProps<{
  tabContext?: { editor?: RMockEditor }
}>()

const editor = computed(() => props.tabContext?.editor ?? null)
const activeTab = ref<'general' | 'content' | 'diagnostics'>('content')
const monacoLanguage = computed(() => editor.value?.contentType === 'text/plain' ? 'plaintext' : 'json')
const bindingConnected = computed(() => {
  const current = editor.value
  if (!current || current.contentSource !== 'code-provider' || !current.codeRef.trim()) {
    return false
  }
  return Endge.mock.listProviders().some(provider => provider.ref === current.codeRef.trim())
})

function setContentSource(value: unknown): void {
  if (!editor.value) {
    return
  }
  editor.value.contentSource = value === 'code-provider' ? 'code-provider' : 'document'
  editor.value.refreshDiagnostics()
}

function setContentType(value: unknown): void {
  if (!editor.value) {
    return
  }
  editor.value.contentType = value === 'text/plain' ? 'text/plain' : 'application/json'
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

  const blocking = current.diagnostics.find(message =>
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
  <div v-if="editor" class="flex h-full min-h-0 flex-col overflow-hidden">
    <div class="flex shrink-0 items-center gap-3 border-b px-3 py-2">
      <div class="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#8B5A2B]/10 dark:bg-[#C08A52]/10">
        <Braces class="size-5 text-[#8B5A2B] dark:text-[#C08A52]" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-semibold">
          {{ editor.name || 'Mock' }}
        </div>
        <div class="truncate text-xs text-muted-foreground">
          {{ editor.identity || 'new-mock' }}
        </div>
      </div>

      <div class="flex items-center rounded-md border bg-muted/40 p-0.5">
        <Button size="sm" :variant="activeTab === 'general' ? 'secondary' : 'ghost'" @click="activeTab = 'general'">
          <Settings2 class="mr-2 size-4" />Общие
        </Button>
        <Button size="sm" :variant="activeTab === 'content' ? 'secondary' : 'ghost'" @click="activeTab = 'content'">
          <FileText class="mr-2 size-4" />Данные
        </Button>
        <Button size="sm" :variant="activeTab === 'diagnostics' ? 'secondary' : 'ghost'" @click="activeTab = 'diagnostics'">
          <TriangleAlert class="mr-2 size-4" />{{ editor.diagnostics.length }}
        </Button>
      </div>

      <Button variant="outline" size="icon" :disabled="EndgeIDE.busy.value" aria-label="Сохранить Mock" @click="save">
        <Loader2 v-if="EndgeIDE.busy.value" class="size-4 animate-spin" />
        <Save v-else class="size-4" />
      </Button>
    </div>

    <div v-if="activeTab === 'general'" class="min-h-0 flex-1 overflow-auto p-6">
      <div class="max-w-2xl space-y-5">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="mock-name">Название</Label>
            <Input id="mock-name" v-model="editor.name" placeholder="Orders response" />
          </div>
          <div class="space-y-2">
            <Label for="mock-identity">Identity</Label>
            <Input id="mock-identity" v-model="editor.identity" placeholder="orders-response" spellcheck="false" />
          </div>
        </div>
        <div class="space-y-2">
          <Label for="mock-description">Описание</Label>
          <Textarea id="mock-description" v-model="editor.description" rows="4" placeholder="Назначение и сценарий mock-данных" />
        </div>
        <div class="space-y-2">
          <Label>Источник данных</Label>
          <Select :model-value="editor.contentSource" @update:model-value="setContentSource">
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
            Code provider supplies only content. Identity, folders and relations still belong to this document.
          </p>
        </div>
      </div>
    </div>

    <div v-else-if="activeTab === 'content'" class="flex min-h-0 flex-1 flex-col">
      <template v-if="editor.contentSource === 'document'">
        <div class="flex shrink-0 items-center justify-between border-b px-4 py-2">
          <div class="text-xs text-muted-foreground">
            Persisted content
          </div>
          <Select :model-value="editor.contentType" @update:model-value="setContentType">
            <SelectTrigger class="h-8 w-40">
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
        </div>
        <ScriptEditor
          :model-value="editor.source"
          :language="monacoLanguage"
          class="min-h-0 flex-1"
          min-height="100%"
          show-toolbar
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
              <Input id="mock-code-ref" v-model="editor.codeRef" placeholder="@app:mocks.orders" spellcheck="false" @blur="editor.refreshDiagnostics()" />
              <p class="text-xs" :class="bindingConnected ? 'text-emerald-600' : 'text-muted-foreground'">
                {{ bindingConnected ? 'Provider connected in current runtime.' : 'Provider may be connected later by the application bundle.' }}
              </p>
            </div>
          </div>
          <p class="text-sm text-muted-foreground">
            Provider availability is a runtime check and does not block saving the persisted document.
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
  </div>
</template>
