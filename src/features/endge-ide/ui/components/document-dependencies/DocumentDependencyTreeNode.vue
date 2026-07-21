<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { DocumentDependencyNode } from '@/features/endge-ide/model/document-dependencies/document-dependency-types'
import type { Component } from 'vue'

import { AlertTriangle, ChevronRight, RotateCcw } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import { getIconComponent } from '@/components/layouts/grid/icons'

defineOptions({ name: 'DocumentDependencyTreeNode' })

const props = withDefaults(
  defineProps<{
    node: DocumentDependencyNode
    depth?: number
    root?: boolean
  }>(),
  {
    depth: 0,
    root: false,
  },
)

const emit = defineEmits<{
  open: [node: DocumentDependencyNode]
}>()

const expanded = ref(props.depth < 2)
const hasChildren = computed(() => props.node.children.length > 0)
const openable = computed(
  () => Boolean(props.node.documentType) && props.node.status !== 'missing',
)
const leftPadding = computed(() => `${Math.max(0, props.depth) * 15 + 8}px`)
const nodeIcon = computed<Component>(
  () => getIconComponent(props.node.icon) as Component,
)
const badgeIcon = computed<Component | null>(
  () => getIconComponent(props.node.badgeIcon ?? undefined) as Component | null,
)
const statusLabel = computed(() => {
  if (props.node.status === 'missing') {
    return 'Документ не найден'
  }
  if (props.node.status === 'compile-error') {
    return 'Ошибки компиляции'
  }
  if (props.node.status === 'cycle') {
    return 'Циклическая зависимость'
  }
  return null
})

function activate(): void {
  if (openable.value) {
    emit('open', props.node)
    return
  }
  if (hasChildren.value) {
    expanded.value = !expanded.value
  }
}
</script>

<template>
  <div class="min-w-0">
    <button
      type="button"
      class="group flex w-full min-w-0 items-center gap-1.5 border-l-2 pr-2 text-left transition-colors"
      :class="[
        root
          ? 'min-h-10 border-sky-500/60 bg-sky-500/[0.045] py-1.5'
          : node.kind === 'group'
            ? 'min-h-8 border-slate-500/35 bg-muted/20 py-1'
            : 'min-h-9 border-transparent py-1',
        openable
          ? 'cursor-pointer hover:border-slate-500/60 hover:bg-muted/55'
          : 'cursor-default',
        node.status === 'missing' ? 'opacity-60' : '',
      ]"
      :style="{ paddingLeft: leftPadding }"
      @click="activate"
    >
      <span
        class="inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-foreground/5"
        @click.stop="hasChildren && (expanded = !expanded)"
      >
        <ChevronRight
          v-if="hasChildren"
          class="size-3 transition-transform duration-150"
          :class="expanded && 'rotate-90'"
        />
      </span>

      <span class="relative size-4 shrink-0">
        <component
          :is="nodeIcon"
          class="size-4"
          :class="node.colorClass"
          stroke-width="1.75"
        />
        <component
          :is="badgeIcon"
          v-if="badgeIcon"
          class="absolute -bottom-1 -right-1 size-2.5 rounded-[2px] bg-background p-px"
          :class="node.colorClass"
        />
      </span>

      <span class="flex min-w-0 flex-1 flex-col">
        <span
          class="truncate text-xs font-medium text-foreground"
          :title="node.title"
        >
          {{ node.title }}
        </span>
        <span
          v-if="node.kind !== 'group'"
          class="truncate text-[10px] leading-3 text-muted-foreground/75"
          :title="node.identity"
        >
          <template v-if="node.alias">{{ node.alias }} · </template>{{ node.identity }}
          <template v-if="node.relationRole"> · {{ node.relationRole }}</template>
        </span>
      </span>

      <span
        v-if="node.activationMode === 'manual'"
        class="shrink-0 rounded border border-border/80 px-1 py-px text-[9px] leading-3 text-muted-foreground/80"
      >
        manual
      </span>
      <span
        v-if="node.status === 'compile-error'"
        class="inline-flex size-5 shrink-0 items-center justify-center text-amber-400"
        :title="`${statusLabel}: ${node.diagnosticCount}`"
      >
        <AlertTriangle class="size-3.5" />
      </span>
      <span
        v-else-if="node.status === 'cycle'"
        class="inline-flex size-5 shrink-0 items-center justify-center text-amber-400"
        :title="statusLabel ?? undefined"
      >
        <RotateCcw class="size-3.5" />
      </span>
      <span
        v-else-if="node.status === 'missing'"
        class="inline-flex size-5 shrink-0 items-center justify-center text-red-400"
        :title="statusLabel ?? undefined"
      >
        <AlertTriangle class="size-3.5" />
      </span>
    </button>

    <div
      v-if="expanded && hasChildren"
      class="border-l border-border/35"
      :style="{ marginLeft: leftPadding }"
    >
      <DocumentDependencyTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        @open="emit('open', $event)"
      />
    </div>
  </div>
</template>
