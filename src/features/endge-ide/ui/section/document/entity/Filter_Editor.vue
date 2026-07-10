<script setup lang="ts">
import type { RFilterEditor } from '@/features/endge-ide/domain/entities/RFilterEditor'

import { Endge } from '@endge/core'
import { Code2, FileJson, LayoutPanelTop, Loader2, Save, TriangleAlert } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide'
import FilterLegacyFieldsEditor from '@/features/endge-ide/ui/components/FilterLegacyFieldsEditor.vue'
import FilterSourceEditor from '@/features/endge-ide/ui/components/FilterSourceEditor.vue'

const editor = computed(() => EndgeIDE.tabs.documentEditorModel.value as RFilterEditor | null)
const activeTab = ref<'ui' | 'source' | 'artifact' | 'diagnostics'>('ui')
const tabs = [
  { value: 'ui', label: 'UI', icon: LayoutPanelTop },
  { value: 'source', label: 'Source', icon: Code2 },
  { value: 'artifact', label: 'Artifact', icon: FileJson },
  { value: 'diagnostics', label: 'Diagnostics', icon: TriangleAlert },
] as const
const compiled = computed(() => editor.value ? Endge.source.compile('filter', editor.value.source) : null)
const artifactJson = computed(() => JSON.stringify(compiled.value?.artifact ?? null, null, 2))
const diagnosticsJson = computed(() => JSON.stringify(compiled.value?.diagnostics ?? [], null, 2))

function updateSource(value: string): void {
  editor.value?.applySourceText(value)
}
</script>

<template>
  <div v-if="editor" class="flex h-full min-h-0 flex-col">
    <div class="flex shrink-0 items-center gap-2 border-b px-3 py-2">
      <div class="flex flex-1 gap-1">
        <Button v-for="tab in tabs" :key="tab.value" size="sm" :variant="activeTab === tab.value ? 'secondary' : 'ghost'" @click="activeTab = tab.value">
          <component :is="tab.icon" class="mr-2 size-4" />{{ tab.label }}
        </Button>
      </div>
      <Button variant="outline" size="icon" :disabled="EndgeIDE.busy.value" title="Сохранить" @click="EndgeIDE.tabs.save()">
        <Loader2 v-if="EndgeIDE.busy.value" class="size-4 animate-spin" />
        <Save v-else class="size-4" />
      </Button>
    </div>
    <div class="min-h-0 flex-1 overflow-hidden">
      <div v-if="activeTab === 'ui'" class="flex h-full min-h-0 flex-col">
        <div class="shrink-0 border-b bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
          Legacy fields сохраняются отдельно и не используются новым Filter runtime.
        </div>
        <FilterLegacyFieldsEditor class="min-h-0 flex-1" />
      </div>
      <FilterSourceEditor v-else-if="activeTab === 'source'" :model-value="editor.source" @update:model-value="updateSource" />
      <pre v-else-if="activeTab === 'artifact'" class="h-full overflow-auto bg-muted/30 p-4 text-xs">{{ artifactJson }}</pre>
      <pre v-else class="h-full overflow-auto bg-muted/30 p-4 text-xs">{{ diagnosticsJson }}</pre>
    </div>
  </div>
</template>
