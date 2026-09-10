<script setup lang="ts">
defineProps<{
  fields: readonly { key: string, kind: string, value: unknown }[]
  valueLabel?: string
}>()

function format(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? String(value)
}
</script>

<template>
  <div class="overflow-hidden rounded-md border bg-muted/10">
    <div class="grid grid-cols-[minmax(10rem,0.35fr)_minmax(0,1fr)] border-b bg-muted/35 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      <span>{{ $t('uiText.storeField751a557b') }}</span>
      <span>{{ valueLabel ?? $t('uiText.liveValue04139a4e') }}</span>
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
      {{ $t('uiText.storeRuntimeContainsNoFieldsc65c05ef') }}
    </div>
  </div>
</template>
