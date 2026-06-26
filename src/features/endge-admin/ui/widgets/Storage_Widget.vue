<script setup lang="ts">
import { Raph } from '@endge/raph'
import { computed, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ScrollArea } from '@/components/ui/scroll-area'
import LazyJsonNode from '@/features/endge-admin/ui/widgets/components/LazyJsonNode.vue'

/** Реактивный снимок Raph.data для отображения (обновляется по кнопке). */
const storageSnapshot = ref<Record<string, unknown>>({})

function refresh(): void {
  try {
    storageSnapshot.value = { ...(Raph.data as Record<string, unknown>) }
  } catch {
    storageSnapshot.value = {}
  }
}

const entries = computed(() => Object.entries(storageSnapshot.value))

refresh()
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="shrink-0 flex items-center justify-end gap-1 px-3 py-2 border-b">
      <Button size="icon" variant="outline" class="h-8 w-8" @click="refresh">
        <i class="ti ti-refresh" />
      </Button>
    </div>
    <ScrollArea class="flex-1 min-h-0">
      <div class="p-2 space-y-1">
        <Collapsible
          v-for="[key, value] in entries"
          :key="key"
          class="rounded-md border border-border bg-muted/20"
        >
          <CollapsibleTrigger
            class="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium hover:bg-muted/50 transition-colors rounded-md [&[data-state=open]>svg]:rotate-180"
          >
            <span class="truncate font-mono">{{ key }}</span>
            <i class="ti ti-chevron-down h-4 w-4 shrink-0 transition-transform" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div class="px-3 pb-3 pt-0 overflow-auto max-h-64">
              <LazyJsonNode :data="value" :name="key" :chunk-size="50" />
            </div>
          </CollapsibleContent>
        </Collapsible>
        <p v-if="!entries.length" class="text-sm text-muted-foreground p-4">Пусто</p>
      </div>
    </ScrollArea>
  </div>
</template>
