<script setup lang="ts">
import { formatDatetime } from '@endge/utils'
import { computed, onMounted, ref, watch } from 'vue'
import { Configurator } from '@/app/Configurator'
import { Button } from '@/components/ui/button'

const journal = Configurator.events
const items = computed(() => journal.items.value.map(event => ({
  ...event,
  time: formatDatetime(new Date(event.at), 'HH:mm:ss.SSS'),
  text: pretty(event.payload),
})))
const list = ref<HTMLElement | null>(null)
const following = ref(true)

function pretty(value: unknown): string {
  try {
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2) ?? String(value)
  }
  catch {
    return String(value)
  }
}

function onScroll(): void {
  const element = list.value
  if (element) {
    following.value = element.scrollHeight - element.scrollTop - element.clientHeight < 32
  }
}

function followLatest(): void {
  if (following.value && list.value) {
    list.value.scrollTop = list.value.scrollHeight
  }
}

onMounted(followLatest)
watch(items, followLatest, { flush: 'post' })
</script>

<template>
  <div class="flex flex-col h-full" data-testid="events-widget">
    <div class="shrink-0 px-3 py-2 border-b flex items-center justify-between gap-2">
      <div>
        <h3 class="text-sm font-semibold">
          {{ $t('uiText.eventsBb9ac875') }}
        </h3>
        <p class="text-xs text-muted-foreground mt-0.5">
          {{ $t('uiText.eventJournalCount', { count: items.length, limit: journal.limit }) }}
        </p>
      </div>
      <Button variant="ghost" size="sm" :disabled="items.length === 0" @click="journal.clear()">
        {{ $t('uiText.clear98b2073e') }}
      </Button>
    </div>
    <div ref="list" class="flex-1 min-h-0 overflow-auto" @scroll="onScroll">
      <div class="p-2 space-y-2">
        <details
          v-for="event in items"
          :key="event.sequence"
          :data-event-name="event.name"
          :data-event-sequence="event.sequence"
          class="border border-border rounded-md bg-muted/30"
        >
          <summary class="cursor-pointer flex items-center justify-between px-2 py-1.5 font-semibold text-xs hover:bg-muted transition-colors rounded-t-md">
            <span class="truncate">{{ event.name }}</span>
            <time class="shrink-0 ml-2 text-muted-foreground">{{ event.time }}</time>
          </summary>
          <pre class="px-2 py-1.5 text-xs text-muted-foreground whitespace-pre-wrap break-all rounded-b-md">{{ event.text }}</pre>
        </details>
        <p v-if="items.length === 0" class="text-xs text-muted-foreground p-4">
          {{ $t('uiText.empty1526c020') }}
        </p>
      </div>
    </div>
  </div>
</template>
