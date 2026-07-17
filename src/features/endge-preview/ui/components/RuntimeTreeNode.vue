<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text, style/max-statements-per-line */
import type { PreviewRuntimeTreeNode } from '@/features/endge-preview/domain/types/preview.types'
import type { Component } from 'vue'

import {
  Boxes,
  Braces,
  ChevronRight,
  Component as ComponentIcon,
  Database,
  Filter,
  FolderRoot,
  Layers3,
  Palette,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'

import { endgePreviewSession } from '@/features/endge-preview/model/core/endge-preview-state'
import RuntimeLifecycleStatusIcon from '@/features/endge-preview/ui/components/RuntimeLifecycleStatusIcon.vue'

defineOptions({ name: 'RuntimeTreeNode' })

const props = defineProps<{
  node: PreviewRuntimeTreeNode
  depth?: number
}>()

const expanded = ref(true)
const session = endgePreviewSession
const selected = computed(() => session.selectedNodeId.value === props.node.id)
const state = computed(() => session.lifecycleState(props.node))
const hasChildren = computed(() => props.node.children.length > 0)
const leftPadding = computed(() => `${Math.max(0, props.depth ?? 0) * 14 + 8}px`)

const nodeIcon = computed<Component>(() => {
  if (props.node.kind === 'project') { return FolderRoot }
  if (props.node.kind === 'composition') { return Boxes }
  if (props.node.kind === 'scope') { return Layers3 }
  if (props.node.kind === 'resource') { return Palette }
  if (props.node.entityType === 'component-sfc') { return ComponentIcon }
  if (props.node.entityType === 'filter' || props.node.entityType === 'filter-view') { return Filter }
  if (props.node.entityType === 'store' || props.node.entityType === 'query') { return Database }
  return Braces
})

async function select(): Promise<void> {
  await session.select(props.node.id)
}
</script>

<template>
  <div class="min-w-0">
    <button
      type="button"
      class="group flex h-8 w-full min-w-0 items-center gap-1.5 border-l-2 pr-2 text-left text-xs transition-colors"
      :class="selected
        ? 'border-primary bg-primary/10 text-foreground'
        : 'border-transparent text-muted-foreground hover:bg-muted/65 hover:text-foreground'"
      :style="{ paddingLeft: leftPadding }"
      @click="select"
    >
      <span
        class="inline-flex size-4 shrink-0 items-center justify-center rounded-sm hover:bg-foreground/5"
        @click.stop="hasChildren && (expanded = !expanded)"
      >
        <ChevronRight
          v-if="hasChildren"
          class="size-3 transition-transform"
          :class="expanded && 'rotate-90'"
        />
      </span>
      <component :is="nodeIcon" class="size-3.5 shrink-0 text-muted-foreground" stroke-width="1.8" />
      <span class="min-w-0 flex-1 truncate font-medium" :title="node.subtitle ?? node.title">
        {{ node.title }}
      </span>
      <span
        v-if="node.activationMode === 'manual'"
        class="shrink-0 rounded border px-1 py-px text-[9px] leading-3 text-muted-foreground/80"
      >
        manual
      </span>
      <RuntimeLifecycleStatusIcon :state="state" />
    </button>

    <div v-if="expanded && hasChildren">
      <RuntimeTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :depth="(depth ?? 0) + 1"
      />
    </div>
  </div>
</template>
