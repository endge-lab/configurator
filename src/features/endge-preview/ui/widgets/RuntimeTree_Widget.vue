<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import { Network } from 'lucide-vue-next'
import { computed } from 'vue'

import { endgePreviewSession } from '@/features/endge-preview/model/core/endge-preview-state'
import RuntimeTreeNode from '@/features/endge-preview/ui/components/RuntimeTreeNode.vue'

const session = endgePreviewSession
const target = computed(() => session.target.value)
const roots = computed(() => session.tree.value)
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-background">
    <div class="shrink-0 border-b px-3 py-2.5">
      <div class="flex min-w-0 items-center gap-2">
        <Network class="size-4 shrink-0 text-primary" />
        <div class="min-w-0">
          <div class="truncate text-xs font-semibold text-foreground">
            {{ target?.identity ?? 'Runtime tree' }}
          </div>
          <div class="truncate text-[10px] text-muted-foreground">
            {{ target?.entityType ?? 'preview session' }}
          </div>
        </div>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-auto py-1.5">
      <RuntimeTreeNode
        v-for="node in roots"
        :key="node.id"
        :node="node"
        :depth="0"
      />
      <div v-if="!roots.length" class="px-4 py-8 text-center text-xs text-muted-foreground">
        Runtime tree пока недоступно.
      </div>
    </div>

    <div class="shrink-0 border-t px-3 py-2 text-[10px] leading-4 text-muted-foreground">
      Выбор inactive-узла запускает его. При смене root composition предыдущая ставится на паузу.
    </div>
  </div>
</template>
