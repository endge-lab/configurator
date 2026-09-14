<script setup lang="ts">
import { Endge } from '@endge/core'

import { ChevronRight, FileText, Folder } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'

const expanded = ref(new Set<string>())
const revision = ref(0)
const off = Endge.program.subscribe(() => {
  revision.value++
  expanded.value = new Set()
})
onBeforeUnmount(off)
const search = ref('')
const catalog = computed(() => {
  void revision.value
  return Endge.program.catalog
})
const rows = computed(() => {
  const result: {
    key: string
    label: string
    folder: boolean
    depth: number
    compiled?: boolean
  }[] = []
  const needle = search.value.trim().toLowerCase()
  const folders = Object.values(catalog.value.folders).sort(
    (a, b) => a.position - b.position,
  )
  const documents = Object.entries(catalog.value.documents).sort(
    ([, a], [, b]) => a.position - b.position,
  )
  const visibleFolders = new Set<string>()
  const matches = documents.filter(
    ([, document]) =>
      !needle
      || `${document.displayName} ${document.identity} ${document.entityType}`
        .toLowerCase()
        .includes(needle),
  )
  for (const [, document] of matches) {
    let parent = document.workspaceFolderId ?? document.folderId
    while (parent && !visibleFolders.has(parent)) {
      visibleFolders.add(parent)
      parent = catalog.value.folders[parent]?.parentId ?? null
    }
  }
  function walk(parent: string | null, depth: number): void {
    for (const folder of folders.filter(value => value.parentId === parent)) {
      if (needle && !visibleFolders.has(folder.id)) {
        continue
      }
      result.push({
        key: folder.id,
        label: folder.displayName,
        folder: true,
        depth,
      })
      if (needle || expanded.value.has(folder.id)) {
        walk(folder.id, depth + 1)
      }
    }
    for (const [key, document] of matches.filter(
      ([, value]) => (value.workspaceFolderId ?? value.folderId) === parent,
    )) {
      result.push({
        key,
        label: document.displayName,
        folder: false,
        depth,
        compiled: document.status === 'compiled',
      })
    }
  }
  walk(null, 0)
  return result
})
function toggle(key: string): void {
  const next = new Set(expanded.value)
  if (next.has(key)) {
    next.delete(key)
  }
  else {
    next.add(key)
  }
  expanded.value = next
}
const { t } = useI18n()
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="p-2">
      <Input
        v-model="search"
        placeholder="Найти документ…"
        aria-label="Поиск в структуре сборки"
        class="h-7 text-xs"
      />
    </div>
    <ScrollArea class="min-h-0 flex-1">
      <div role="tree" aria-label="Структура сборки" class="px-1 pb-2">
        <button
          v-for="row in rows"
          :key="`${row.folder}:${row.key}`"
          type="button"
          role="treeitem"
          :aria-level="row.depth + 1"
          :aria-expanded="
            row.folder ? expanded.has(row.key) || !!search : undefined
          "
          class="flex h-7 w-full items-center gap-1.5 rounded pr-2 text-left text-xs hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring"
          :style="{ paddingLeft: `${row.depth * 14 + 4}px` }"
          :title="row.label"
          @click="
            row.folder
              ? toggle(row.key)
              : EndgeIDE.tabs.openCompiledDocument(row.key)
          "
        >
          <ChevronRight
            v-if="row.folder"
            class="size-3 shrink-0"
            :class="{ 'rotate-90': expanded.has(row.key) || search }"
          /><span v-else class="w-3 shrink-0" />
          <Folder
            v-if="row.folder"
            class="size-3.5 shrink-0 text-muted-foreground"
          /><FileText v-else class="size-3.5 shrink-0 text-sky-500" />
          <span class="truncate">{{ row.label }}</span><span
            v-if="!row.folder && !row.compiled"
            class="ml-auto text-muted-foreground"
            title="Документ не имеет артефакта"
          > {{ t('bundleInspection.emptyValue') }} </span>
        </button>
        <p v-if="!rows.length" class="p-3 text-xs text-muted-foreground">
          {{
            Endge.program.programId
              ? t('bundleInspection.noDocuments')
              : t('bundleInspection.loadHint')
          }}
        </p>
      </div>
    </ScrollArea>
  </div>
</template>
