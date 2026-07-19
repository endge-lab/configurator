<script setup lang="ts">
import { formatDatetime } from '@endge/utils'
import { useDomainStore } from '@endge/ui-vue'
import { computed } from 'vue'

type UiEventItem = {
  ts?: string
  name?: string
  payload?: unknown
}

const domainStore = useDomainStore()

const items = computed<UiEventItem[]>(() => {
  const src: unknown = domainStore.events
  if (!Array.isArray(src)) return []

  return src.map((e: any): UiEventItem => {
    const payload: unknown = e?.payload ?? e?.data ?? e?.message ?? e
    const name: string | undefined =
      e?.type != null
        ? String(e.type)
        : e?.name != null
          ? String(e.name)
          : undefined
    const tsRaw: unknown = e?.ts ?? e?.time ?? e?.createdAt ?? e?.at
    const ts: string | undefined =
      tsRaw != null
        ? formatDatetime(tsRaw instanceof Date ? tsRaw : new Date(String(tsRaw)), 'HH:mm:ss')
        : undefined
    return { ts, name, payload }
  })
})

function pretty(v: unknown): string {
  try {
    return typeof v === 'string' ? v : JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="shrink-0 px-3 py-2 border-b">
      <h3 class="text-sm font-semibold">События</h3>
      <p class="text-xs text-muted-foreground mt-0.5">Кеш событий Endge ({{ items.length }})</p>
    </div>
    <ScrollArea class="flex-1 min-h-0">
      <div class="p-2 space-y-2">
        <details
          v-for="(e, index) in items"
          :key="index"
          class="border border-border rounded-md bg-muted/30"
        >
          <summary
            class="cursor-pointer flex items-center justify-between px-2 py-1.5 font-semibold text-xs hover:bg-muted transition-colors rounded-t-md"
          >
            <span class="truncate">
              {{ e.name || 'UnknownEvent' }}
              <span v-if="e.ts" class="text-muted"> - {{ e.ts }}</span>
            </span>
          </summary>
          <pre
            class="px-2 py-1.5 text-xs text-muted-foreground whitespace-pre-wrap break-all rounded-b-md"
          >{{ pretty(e.payload) }}</pre>
        </details>
        <p v-if="items.length === 0" class="text-xs text-muted-foreground p-4">Пусто</p>
      </div>
    </ScrollArea>
  </div>
</template>
