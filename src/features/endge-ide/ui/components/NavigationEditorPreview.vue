<script setup lang="ts">
import type { NavigationTreeNodeEditor } from '@/features/endge-ide/domain/entities/RNavigationEditor'

import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import NavigationEditorPreviewNode from '@/features/endge-ide/ui/components/NavigationEditorPreviewNode.vue'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  tree?: NavigationTreeNodeEditor[]
}>()

const openedIds = ref<Set<string>>(new Set())

function isVisible(node: NavigationTreeNodeEditor): boolean {
  return !node.hidden
}

const visibleTree = computed(() => {
  const walk = (nodes: NavigationTreeNodeEditor[]): NavigationTreeNodeEditor[] =>
    nodes
      .filter(isVisible)
      .map(node => ({
        ...node,
        children: node.type !== 'link' ? walk(node.children ?? []) : [],
      }))

  return walk(props.tree ?? [])
})

watch(
  visibleTree,
  (nodes) => {
    const next = new Set<string>()
    const walk = (items: NavigationTreeNodeEditor[]): void => {
      for (const node of items) {
        if (node.type !== 'link' && (node.children?.length ?? 0) > 0) {
          next.add(node.id)
          walk(node.children ?? [])
        }
      }
    }
    walk(nodes)
    openedIds.value = next
  },
  { immediate: true, deep: true },
)

function toggle(nodeId: string): void {
  const next = new Set(openedIds.value)
  if (next.has(nodeId))
    next.delete(nodeId)
  else
    next.add(nodeId)
  openedIds.value = next
}

function stats(nodes: NavigationTreeNodeEditor[]): { sections: number; groups: number; links: number } {
  let sections = 0
  let groups = 0
  let links = 0

  const walk = (items: NavigationTreeNodeEditor[]): void => {
    for (const node of items) {
      if (node.type === 'section') {
        sections += 1
        walk(node.children ?? [])
      }
      else if (node.type === 'group') {
        groups += 1
        walk(node.children ?? [])
      }
      else {
        links += 1
      }
    }
  }

  walk(nodes)
  return { sections, groups, links }
}

const previewStats = computed(() => stats(visibleTree.value))
</script>

<template>
  <div class="flex h-full min-h-0 flex-col rounded-2xl border bg-gradient-to-b from-background to-muted/30 p-4">
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <Badge variant="outline">Превью результата</Badge>
      <span class="ml-auto text-xs text-muted-foreground">
        {{ previewStats.sections }} секции · {{ previewStats.groups }} группы · {{ previewStats.links }} ссылки
      </span>
    </div>

    <div class="min-h-0 flex-1 rounded-[28px] border bg-card p-3 shadow-sm">
      <div class="flex h-full min-h-0 flex-col rounded-[22px] border bg-background p-4 text-foreground">
        <ScrollArea class="h-full min-h-0 flex-1 pr-2">
          <div v-if="!visibleTree.length" class="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            Добавьте элементы в tree view, чтобы увидеть визуализацию.
          </div>

          <div v-else class="space-y-2">
            <NavigationEditorPreviewNode
              v-for="node in visibleTree"
              :key="node.id"
              :node="node"
              :opened-ids="openedIds"
              @toggle="toggle"
            />
          </div>
        </ScrollArea>
      </div>
    </div>
  </div>
</template>
