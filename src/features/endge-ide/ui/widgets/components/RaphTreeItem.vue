<script setup lang="ts">
import { computed } from 'vue'

/** Рекурсивный узел дерева Raph для вкладки «Узлы». */
interface NodeTree {
  id: string
  type?: string
  children: NodeTree[]
  routes: string[]
}

const props = withDefaults(
  defineProps<{ node: NodeTree; depth?: number }>(),
  { depth: 0 },
)

const pad = computed(() => `${Math.max(0, props.depth) * 12}px`)
const hasChildren = computed(() => (props.node?.children?.length ?? 0) > 0)
const hasRoutes = computed(() => (props.node?.routes?.length ?? 0) > 0)
</script>

<template>
  <details class="border border-border rounded-md bg-muted/30 mt-1">
    <summary
      class="cursor-pointer flex items-center justify-between px-2 py-1 font-semibold text-xs hover:bg-muted transition-colors rounded-t-md"
      :style="{ paddingLeft: `calc(${pad} + 8px)` }"
    >
      <span class="truncate">
        {{ node.id }}
        <span v-if="hasRoutes" class="text-muted"> ({{ node.routes.length }} routes)</span>
      </span>
      <span class="text-xs text-muted-foreground">
        {{ hasChildren ? node.children.length + ' children' : 'leaf' }}
      </span>
    </summary>
    <div v-if="hasChildren" class="pl-3 pb-1">
      <RaphTreeItem
        v-for="c in node.children"
        :key="c.id"
        :node="c"
        :depth="depth + 1"
      />
    </div>
    <div class="py-1 pt-2">
      <ul v-if="hasRoutes" class="pl-6 py-1 text-xs text-destructive list-disc">
        <li v-for="(r, idx) in node.routes" :key="idx" class="break-all">{{ r }}</li>
      </ul>
      <div v-else class="pl-6 text-xs text-muted-foreground">Нет подписок</div>
    </div>
  </details>
</template>
