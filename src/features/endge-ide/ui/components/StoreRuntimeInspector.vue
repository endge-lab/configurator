<script setup lang="ts">
import type { StoreRuntimeHost } from '@endge/core'

import { Raph } from '@endge/raph'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { readStorePreviewFields } from '@/features/endge-ide/model/store-preview/store-preview-inspector'
import SourceOutputPanel from '@/features/endge-ide/ui/components/SourceOutputPanel.vue'

const props = defineProps<{
  runtime: StoreRuntimeHost | null
}>()

const copy = {
  title: 'output.json',
  live: 'live',
  collapse: 'Свернуть output.json',
  expand: 'Показать output.json',
  empty: 'Store runtime не содержит полей.',
  raph: 'Raph',
  fields: 'fields',
  separator: '·',
  flow: '→',
} as const

const collapsed = ref(false)
const revision = ref(0)
let disposeRuntimeWatch: VoidFunction | null = null

watch(
  () => props.runtime,
  (runtime) => {
    disposeRuntimeWatch?.()
    disposeRuntimeWatch = null
    revision.value += 1

    if (!runtime) {
      return
    }

    collapsed.value = false
    const path = runtime.getDataPath()
    disposeRuntimeWatch = Raph.watch([path, `${path}.*`], () => {
      revision.value += 1
    })
  },
  { immediate: true },
)

onBeforeUnmount(() => disposeRuntimeWatch?.())

const fields = computed(() => {
  void revision.value
  return props.runtime ? readStorePreviewFields(props.runtime) : []
})

const rootPath = computed(() => props.runtime?.getDataPath() ?? '')

function formatValue(value: unknown): string {
  if (value === undefined) {
    return 'undefined'
  }

  try {
    return JSON.stringify(value, null, 2) ?? 'undefined'
  }
  catch {
    return String(value)
  }
}
</script>

<template>
  <SourceOutputPanel
    v-if="runtime"
    v-model:collapsed="collapsed"
    :title="copy.title"
    :collapse-label="copy.collapse"
    :expand-label="copy.expand"
    mode="full-height"
  >
    <template #meta>
      <span class="store-runtime-inspector__live-badge">
        <span class="store-runtime-inspector__live-dot" />
        {{ copy.live }}
      </span>
      <span class="text-[10px] font-normal text-slate-400">{{ fields.length }} {{ copy.fields }}</span>
    </template>

    <template #collapsed-meta>
      <span class="store-runtime-inspector__live-dot" />
    </template>

    <template #subtitle>
      <div class="truncate font-mono" :title="rootPath">
        {{ `${copy.raph} ${copy.separator} ${rootPath}` }}
      </div>
    </template>

    <div v-if="!fields.length" class="p-4 text-xs text-slate-400">
      {{ copy.empty }}
    </div>

    <template v-else>
      <article
        v-for="field in fields"
        :key="field.key"
        class="store-runtime-inspector__field"
      >
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-mono text-xs font-semibold text-slate-100">{{ field.key }}</span>
          <span class="store-runtime-inspector__kind" :data-kind="field.kind">{{ field.kind }}</span>
          <span v-if="field.mockIdentity" class="text-[10px] text-amber-300/90">
            {{ `mock:${field.mockIdentity}` }}
          </span>
        </div>

        <div v-if="field.kind === 'derived'" class="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
          <span>{{ field.source }}</span>
          <template v-for="dataView in field.dataViews" :key="dataView">
            <span>{{ copy.flow }}</span>
            <span class="rounded border border-cyan-800/70 bg-cyan-950/40 px-1.5 py-0.5 text-cyan-200">{{ dataView }}</span>
          </template>
        </div>

        <div class="mt-2 truncate font-mono text-[10px] text-slate-500" :title="field.raphPath">
          {{ `${copy.raph} ${copy.separator} ${field.raphPath}` }}
        </div>

        <pre class="store-runtime-inspector__value">{{ formatValue(field.value) }}</pre>
      </article>
    </template>
  </SourceOutputPanel>
</template>

<style scoped>
.store-runtime-inspector__live-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid rgb(16 185 129 / 0.28);
  border-radius: 999px;
  padding: 2px 6px;
  color: #6ee7b7;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.store-runtime-inspector__live-dot {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: #34d399;
  box-shadow: 0 0 0 3px rgb(52 211 153 / 0.12), 0 0 10px rgb(52 211 153 / 0.55);
}

.store-runtime-inspector__field {
  padding: 12px;
  border-bottom: 1px solid rgb(51 65 85 / 0.72);
}

.store-runtime-inspector__field:hover {
  background: rgb(30 41 59 / 0.34);
}

.store-runtime-inspector__kind {
  border: 1px solid rgb(71 85 105 / 0.9);
  border-radius: 999px;
  padding: 1px 6px;
  color: #94a3b8;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.store-runtime-inspector__kind[data-kind='derived'] {
  border-color: rgb(8 145 178 / 0.55);
  background: rgb(8 145 178 / 0.1);
  color: #67e8f9;
}

.store-runtime-inspector__value {
  min-height: 38px;
  max-height: 360px;
  margin: 9px 0 0;
  padding: 9px 10px;
  overflow: auto;
  border: 1px solid rgb(51 65 85 / 0.82);
  border-radius: 6px;
  background: rgb(2 6 23 / 0.62);
  color: #cbd5e1;
  font-size: 11px;
  line-height: 1.5;
  white-space: pre;
}
</style>
