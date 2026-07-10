<script setup lang="ts">
import type { RCompositionEditor } from '@/features/endge-ide/domain/entities/RCompositionEditor'

import { Endge } from '@endge/core'
import { Code2, FileJson, Loader2, Save, TriangleAlert } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide'
import CompositionSourceEditor from '@/features/endge-ide/ui/components/CompositionSourceEditor.vue'

const editor = computed(() => EndgeIDE.tabs.documentEditorModel.value as RCompositionEditor | null)
const activeTab = ref<'source' | 'artifact' | 'diagnostics'>('source')
const compiled = computed(() => editor.value ? Endge.source.compile('composition', editor.value.source) : null)
const artifactJson = computed(() => JSON.stringify(compiled.value?.artifact ?? null, null, 2))
const diagnosticsJson = computed(() => JSON.stringify(compiled.value?.diagnostics ?? [], null, 2))
function updateSource(value: string): void { editor.value?.applySourceText(value) }
</script>

<template>
  <div v-if="editor" class="flex h-full min-h-0 flex-col">
    <div class="flex shrink-0 items-center gap-2 border-b px-3 py-2">
      <div class="flex flex-1 gap-1">
        <Button size="sm" :variant="activeTab === 'source' ? 'secondary' : 'ghost'" @click="activeTab = 'source'"><Code2 class="mr-2 size-4" />Source</Button>
        <Button size="sm" :variant="activeTab === 'artifact' ? 'secondary' : 'ghost'" @click="activeTab = 'artifact'"><FileJson class="mr-2 size-4" />Artifact</Button>
        <Button size="sm" :variant="activeTab === 'diagnostics' ? 'secondary' : 'ghost'" @click="activeTab = 'diagnostics'"><TriangleAlert class="mr-2 size-4" />Diagnostics</Button>
      </div>
      <Button variant="outline" size="icon" :disabled="EndgeIDE.busy.value" title="Сохранить" @click="EndgeIDE.tabs.save()">
        <Loader2 v-if="EndgeIDE.busy.value" class="size-4 animate-spin" />
        <Save v-else class="size-4" />
      </Button>
    </div>
    <div class="min-h-0 flex-1 overflow-hidden">
      <CompositionSourceEditor v-if="activeTab === 'source'" :model-value="editor.source" @update:model-value="updateSource" />
      <pre v-else-if="activeTab === 'artifact'" class="h-full overflow-auto bg-muted/30 p-4 text-xs">{{ artifactJson }}</pre>
      <pre v-else class="h-full overflow-auto bg-muted/30 p-4 text-xs">{{ diagnosticsJson }}</pre>
    </div>
  </div>
</template>
