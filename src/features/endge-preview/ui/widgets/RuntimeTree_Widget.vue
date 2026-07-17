<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import { endgePreviewSession } from '@/features/endge-preview/model/core/endge-preview-state'
import RuntimeTreeNode from '@/features/endge-preview/ui/components/RuntimeTreeNode.vue'

const session = endgePreviewSession
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-background">
    <div class="min-h-0 flex-1 overflow-auto py-1.5">
      <RuntimeTreeNode
        v-for="node in session.tree.value"
        :key="node.id"
        :node="node"
        :depth="0"
      />
      <div v-if="!session.tree.value.length" class="px-4 py-8 text-center text-xs text-muted-foreground">
        Runtime tree пока недоступно.
      </div>
    </div>

    <div class="shrink-0 border-t px-3 py-2 text-[10px] leading-4 text-muted-foreground">
      Выбор inactive-узла запускает его. При смене root composition предыдущая ставится на паузу.
    </div>
  </div>
</template>
