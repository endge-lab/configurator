<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { PreviewRuntimeTreeNode } from '@/features/endge-preview/domain/types/preview.types'
import type { Component } from 'vue'

import { Braces, ChevronRight } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import { getIconComponent } from '@/components/layouts/grid/icons'
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
  return getIconComponent(props.node.presentation?.icon) as Component ?? Braces
})
const badgeIcon = computed<Component | null>(() => getIconComponent(props.node.presentation?.badgeIcon ?? undefined) as Component | null)
const iconColorClass = computed(() => props.node.presentation?.colorClass ?? 'text-muted-foreground')

async function select(): Promise<void> {
  await session.select(props.node.id)
}
</script>

<template>
  <div class="min-w-0">
    <button
      type="button"
      class="group flex w-full min-w-0 items-center gap-1.5 border-l-2 pr-2 text-left text-xs transition-colors"
      :class="[
        selected
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-transparent text-muted-foreground hover:bg-muted/65 hover:text-foreground',
        node.subtitle ? 'min-h-10 py-1' : 'h-8',
      ]"
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
      <span class="relative size-3.5 shrink-0">
        <component :is="nodeIcon" class="size-3.5" :class="iconColorClass" stroke-width="1.8" />
        <component
          :is="badgeIcon"
          v-if="badgeIcon"
          class="absolute -bottom-1 -right-1 size-2 rounded-[2px] bg-background p-px"
          :class="iconColorClass"
        />
      </span>
      <span class="flex min-w-0 flex-1 flex-col" :title="node.subtitle ?? node.title">
        <span class="truncate font-medium text-foreground">{{ node.title }}</span>
        <span v-if="node.subtitle" class="truncate text-[10px] leading-3 text-muted-foreground/75">
          {{ node.subtitle }}
        </span>
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
