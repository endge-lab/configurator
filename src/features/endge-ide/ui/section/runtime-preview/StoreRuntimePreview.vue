<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { StoreRuntimeHost } from '@endge/core'

import { Raph } from '@endge/raph'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{
  runtime: StoreRuntimeHost
}>()

const revision = ref(0)
let disposeWatch: VoidFunction | null = null

watch(
  () => props.runtime,
  (runtime) => {
    disposeWatch?.()
    revision.value += 1
    const path = runtime.getDataPath()
    disposeWatch = Raph.watch([path, `${path}.*`], () => {
      revision.value += 1
    })
  },
  { immediate: true },
)

onBeforeUnmount(() => disposeWatch?.())

const fields = computed(() => {
  void revision.value
  const snapshot = props.runtime.getDataSnapshot()
  return props.runtime.getFields().map(field => ({
    key: field.key,
    kind: field.kind,
    value: snapshot[field.key],
  }))
})

function format(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? String(value)
}
</script>

<template>
  <div class="overflow-hidden rounded-md border bg-muted/10">
    <div class="grid grid-cols-[minmax(10rem,0.35fr)_minmax(0,1fr)] border-b bg-muted/35 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      <span>Store field</span>
      <span>Live value</span>
    </div>
    <div v-if="fields.length" class="divide-y">
      <section
        v-for="field in fields"
        :key="field.key"
        class="grid grid-cols-[minmax(10rem,0.35fr)_minmax(0,1fr)]"
      >
        <div class="min-w-0 border-r px-3 py-3">
          <div class="truncate font-mono text-xs font-semibold">
            {{ field.key }}
          </div>
          <div class="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            {{ field.kind }}
          </div>
        </div>
        <pre class="min-w-0 overflow-auto p-3 text-xs leading-5">{{ format(field.value) }}</pre>
      </section>
    </div>
    <div v-else class="p-6 text-center text-xs text-muted-foreground">
      Store runtime не содержит полей.
    </div>
  </div>
</template>
