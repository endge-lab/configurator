<script setup lang="ts">
import { ChevronsDownUp, ChevronsUpDown, Copy } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const props = defineProps<{
  copyValue: unknown
}>()

const emit = defineEmits<{
  (event: 'expandAll'): void
  (event: 'collapseAll'): void
}>()

const labels = {
  expandAll: 'Развернуть все',
  collapseAll: 'Свернуть все',
  copyAll: 'Скопировать весь output',
} as const

async function copyAll(): Promise<void> {
  try {
    const serialized = JSON.stringify(props.copyValue, null, 2)
    await navigator.clipboard.writeText(serialized ?? String(props.copyValue))
    toast.success('Весь output скопирован', {
      description: 'JSON сохранён в буфер обмена.',
    })
  }
  catch {
    toast.error('Не удалось скопировать output')
  }
}
</script>

<template>
  <div class="source-json-tree-controls">
    <TooltipProvider :delay-duration="200">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            class="source-json-tree-controls__action"
            :aria-label="labels.expandAll"
            @click="emit('expandAll')"
          >
            <ChevronsUpDown class="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ labels.expandAll }}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            class="source-json-tree-controls__action"
            :aria-label="labels.collapseAll"
            @click="emit('collapseAll')"
          >
            <ChevronsDownUp class="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ labels.collapseAll }}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            class="source-json-tree-controls__action"
            :aria-label="labels.copyAll"
            @click="copyAll"
          >
            <Copy class="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ labels.copyAll }}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
</template>

<style scoped>
.source-json-tree-controls {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 2px;
}

.source-json-tree-controls__action {
  width: 26px;
  height: 26px;
  color: #94a3b8;
}

.source-json-tree-controls__action:hover {
  background: rgb(51 65 85 / 0.72);
  color: #dbeafe;
}
</style>
