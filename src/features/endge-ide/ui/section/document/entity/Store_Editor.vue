<script setup lang="ts">
import type { RStoreEditor } from '@/features/endge-ide/domain/entities/RStoreEditor'

import { Endge } from '@endge/core'
import { Code2, FileJson, Loader2, Save, Settings2, TriangleAlert } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide'
import StoreSourceEditor from '@/features/endge-ide/ui/components/StoreSourceEditor.vue'

const editor = computed(() => EndgeIDE.tabs.documentEditorModel.value as RStoreEditor | null)
const activeTab = ref<'general' | 'source' | 'artifact' | 'diagnostics'>('general')
const compiled = computed(() => editor.value ? Endge.source.compile('store', editor.value.source) : null)
const artifactJson = computed(() => JSON.stringify(compiled.value?.artifact ?? null, null, 2))
const diagnosticsJson = computed(() => JSON.stringify(compiled.value?.diagnostics ?? [], null, 2))
function updateSource(value: string): void { editor.value?.applySourceText(value) }

async function save(): Promise<void> {
  const current = editor.value
  if (!current)
    return

  current.identity = current.identity.trim()
  current.name = current.name.trim()
  if (!current.identity) {
    toast.error('Identity хранилища не может быть пустым')
    activeTab.value = 'general'
    return
  }
  if (!current.name)
    current.name = current.identity

  await EndgeIDE.tabs.save()
}
</script>

<template>
  <div v-if="editor" class="flex h-full min-h-0 flex-col">
    <div class="flex shrink-0 items-center gap-2 border-b px-3 py-2">
      <div class="flex flex-1 gap-1">
        <Button size="sm" :variant="activeTab === 'general' ? 'secondary' : 'ghost'" @click="activeTab = 'general'"><Settings2 class="mr-2 size-4" />Общие</Button>
        <Button size="sm" :variant="activeTab === 'source' ? 'secondary' : 'ghost'" @click="activeTab = 'source'"><Code2 class="mr-2 size-4" />Source</Button>
        <Button size="sm" :variant="activeTab === 'artifact' ? 'secondary' : 'ghost'" @click="activeTab = 'artifact'"><FileJson class="mr-2 size-4" />Artifact</Button>
        <Button size="sm" :variant="activeTab === 'diagnostics' ? 'secondary' : 'ghost'" @click="activeTab = 'diagnostics'"><TriangleAlert class="mr-2 size-4" />Diagnostics</Button>
      </div>
      <Button variant="outline" size="icon" :disabled="EndgeIDE.busy.value" title="Сохранить" @click="save">
        <Loader2 v-if="EndgeIDE.busy.value" class="size-4 animate-spin" />
        <Save v-else class="size-4" />
      </Button>
    </div>
    <div class="min-h-0 flex-1 overflow-hidden">
      <div v-if="activeTab === 'general'" class="h-full overflow-auto p-6">
        <div class="max-w-xl space-y-5">
          <div class="space-y-2">
            <Label for="store-display-name">Название</Label>
            <Input id="store-display-name" v-model="editor.name" placeholder="Название хранилища" />
          </div>
          <div class="space-y-2">
            <Label for="store-identity">Identity</Label>
            <Input id="store-identity" v-model="editor.identity" placeholder="Уникальный идентификатор" spellcheck="false" />
            <p class="text-xs text-muted-foreground">
              Identity используется для ссылок на документ хранилища и должен быть уникальным.
            </p>
          </div>
        </div>
      </div>
      <StoreSourceEditor v-else-if="activeTab === 'source'" :model-value="editor.source" @update:model-value="updateSource" />
      <pre v-else-if="activeTab === 'artifact'" class="h-full overflow-auto bg-muted/30 p-4 text-xs">{{ artifactJson }}</pre>
      <pre v-else class="h-full overflow-auto bg-muted/30 p-4 text-xs">{{ diagnosticsJson }}</pre>
    </div>
  </div>
</template>
