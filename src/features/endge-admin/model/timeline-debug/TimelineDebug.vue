<script setup lang="ts">
import type { LogNode, SpanNode, EventNode } from '@endge/core'

import { Endge } from '@endge/core'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CANVAS_DEBUG_ID,
  useTimelineDebugStore,
} from '@/features/endge-admin/model/timeline-debug/store.ts'

// -------------------- store --------------------
const tlStore = useTimelineDebugStore()
const { timeline, init, destroy, applyCurrentJournal } = tlStore
const { details } = storeToRefs(tlStore)

// -------------------- lifecycle --------------------
onMounted(async () => {
  await init()
  setTimeout(() => {
    timeline.options({ height: 300 })
  }, 300)
})

onBeforeUnmount(() => {
  destroy()
})

// -------------------- helpers --------------------
function fmtMs(ms: number): string {
  if (ms < 1)
    return `${ms.toFixed(2)} ms`
  if (ms < 1000)
    return `${Math.round(ms)} ms`
  const s = ms / 1000
  return `${s.toFixed(s < 10 ? 2 : 1)} s`
}

// -------------------- tree model --------------------
type RowData = {
  name: string
  kind: 'span' | 'event'
  lane?: string
  durationMs?: number | null
  message?: string
}

type TreeNode = {
  key: string
  data: RowData
  children?: TreeNode[]
}

function nodeKey(n: LogNode, idx?: number): string {
  const trace = n.corr?.traceId ?? ''
  const span = n.corr?.spanId ?? ''
  const name = n.name ?? ''
  const suffix = idx != null ? `:${idx}` : ''
  return `${n.kind}:${trace}:${span}:${n.ts}:${name}${suffix}`
}

function toTreeNode(node: LogNode, idx?: number): TreeNode {
  if (node.kind === 'span') {
    const s = node as SpanNode
    const dur =
      typeof s.durMs === 'number'
        ? s.durMs
        : s.endTs
          ? s.endTs - s.ts
          : null

    return {
      key: nodeKey(node, idx),
      data: {
        name: s.name,
        kind: 'span',
        lane: s.lane,
        durationMs: dur,
      },
      children: (s.children ?? []).map((c, i) => toTreeNode(c, i)),
    }
  }

  const e = node as EventNode
  return {
    key: nodeKey(node, idx),
    data: {
      name: e.name ?? 'event',
      kind: 'event',
      lane: e.lane,
      durationMs: null,
      message: e.msg,
    },
  }
}

const treeNodes = computed<TreeNode[]>(() => {
  if (!details.value)
    return []
  return [toTreeNode(details.value)]
})

// -------------------- expand/collapse --------------------
const expandedKeys = ref<Record<string, boolean>>({})

function isExpanded(key: string): boolean {
  return expandedKeys.value[key] === true
}

function setExpanded(key: string, v: boolean): void {
  expandedKeys.value = { ...expandedKeys.value, [key]: v }
}

function toggleNode(key: string): void {
  setExpanded(key, !isExpanded(key))
}

function expandAll(): void {
  const all: Record<string, boolean> = {}
  const walk = (arr: TreeNode[]) => {
    for (const n of arr) {
      all[n.key] = true
      if (n.children?.length)
        walk(n.children)
    }
  }
  walk(treeNodes.value)
  expandedKeys.value = all
}

function collapseAll(): void {
  expandedKeys.value = {}
}

// -------------------- flatten for rendering --------------------
type FlatRow = {
  node: TreeNode
  depth: number
}

function flatten(nodes: TreeNode[], depth: number = 0): FlatRow[] {
  const out: FlatRow[] = []
  for (const n of nodes) {
    out.push({ node: n, depth })
    if (n.children?.length && isExpanded(n.key)) {
      out.push(...flatten(n.children, depth + 1))
    }
  }
  return out
}

const flatRows = computed<FlatRow[]>(() => flatten(treeNodes.value))

// -------------------- actions --------------------
function loadCurrentJournal(): void {
  Endge.domain.compile()
  applyCurrentJournal()
}

// -------------------- ui --------------------
const activeTab = ref<'timeline' | 'details'>('timeline')
</script>

<template>
  <div class="flex flex-col gap-3 h-full min-h-0">
    <!-- header -->
    <div class="flex items-center justify-end gap-2">
      <Button variant="outline" @click="loadCurrentJournal">
        Загрузить текущий журнал
      </Button>
    </div>

    <Tabs v-model="activeTab" class="flex flex-col gap-3 min-h-0">
      <TabsList class="grid grid-cols-2 w-full">
        <TabsTrigger value="timeline">Timeline</TabsTrigger>
        <TabsTrigger value="details">Детализация</TabsTrigger>
      </TabsList>

      <!-- timeline -->
      <TabsContent value="timeline" class="m-0">
        <Card class="p-3">
          <div class="h-[300px] overflow-hidden rounded-md border bg-muted/20">
            <canvas :id="CANVAS_DEBUG_ID" class="w-full h-full"></canvas>
          </div>
        </Card>
      </TabsContent>

      <!-- details -->
      <TabsContent value="details" class="m-0 flex flex-col gap-3 min-h-0">
        <div class="flex items-center justify-end gap-2">
          <Button variant="outline" @click="expandAll">
            Развернуть всё
          </Button>
          <Button variant="secondary" @click="collapseAll">
            Свернуть всё
          </Button>
        </div>

        <Card class="p-0 flex-1 min-h-0">
          <div class="border-b px-4 py-3">
            <div class="text-sm font-medium">Дерево логов</div>
            <div class="text-xs text-muted-foreground">
              Выберите span на таймлайне, чтобы увидеть детали.
            </div>
          </div>

          <ScrollArea class="h-full">
            <div class="px-2 py-2">
              <div
                v-if="flatRows.length === 0"
                class="p-4 text-sm text-muted-foreground"
              >
                Нет данных для отображения.
              </div>

              <div v-else class="divide-y">
                <!-- header row -->
                <div class="grid grid-cols-[1fr_140px] gap-4 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <div>Операция</div>
                  <div class="text-right">Время</div>
                </div>

                <!-- rows -->
                <div
                  v-for="{ node, depth } in flatRows"
                  :key="node.key"
                  class="grid grid-cols-[1fr_140px] gap-4 px-3 py-2 hover:bg-muted/40"
                >
                  <!-- op -->
                  <div class="min-w-0 flex items-center gap-2" :style="{ paddingLeft: `${depth * 14}px` }">
                    <!-- expander -->
                    <button
                      v-if="node.children?.length"
                      class="size-6 inline-flex items-center justify-center rounded hover:bg-muted"
                      @click="toggleNode(node.key)"
                    >
                      <span class="text-muted-foreground text-xs">
                        {{ isExpanded(node.key) ? '▾' : '▸' }}
                      </span>
                    </button>
                    <span v-else class="size-6" />

                    <!-- kind badge -->
                    <span
                      class="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium"
                      :class="node.data.kind === 'span'
                        ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                        : 'bg-sky-500/10 text-sky-700 border-sky-500/20'"
                    >
                      {{ node.data.kind }}
                    </span>

                    <!-- name/lane/msg -->
                    <span class="truncate font-medium text-sm">
                      {{ node.data.name }}
                    </span>

                    <span v-if="node.data.lane" class="text-xs text-muted-foreground truncate">
                      - {{ node.data.lane }}
                    </span>

                    <span
                      v-if="node.data.kind === 'event' && node.data.message"
                      class="text-xs text-muted-foreground truncate"
                    >
                      · {{ node.data.message }}
                    </span>
                  </div>

                  <!-- time -->
                  <div class="text-right text-sm tabular-nums">
                    <span v-if="typeof node.data.durationMs === 'number'">
                      {{ node.data.durationMs !== 0 ? fmtMs(node.data.durationMs) : '-' }}
                    </span>
                    <span v-else>-</span>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </Card>
      </TabsContent>
    </Tabs>
  </div>
</template>
