<script setup lang="ts">
import type { StoreRuntimeHost } from '@endge/core'

import { Raph } from '@endge/raph'
import { ChevronDown, ChevronRight } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { readStorePreviewFields } from '@/features/endge-ide/model/store-preview/store-preview-inspector'
import SourceJsonTree from '@/features/endge-ide/ui/components/SourceJsonTree.vue'
import SourceJsonTreeControls from '@/features/endge-ide/ui/components/SourceJsonTreeControls.vue'
import SourceOutputPanel from '@/features/endge-ide/ui/components/SourceOutputPanel.vue'

interface SourceJsonTreeHandle {
  expandAll: () => void
  collapseAll: () => void
}

const props = defineProps<{
  runtime: StoreRuntimeHost | null
}>()

const copy = {
  title: 'output.json',
  collapse: 'Свернуть output.json',
  expand: 'Показать output.json',
  empty: 'Store runtime не содержит полей.',
  flow: '→',
} as const

const collapsed = ref(false)
const expandedFieldKey = ref<string | null>(null)
const expandedFieldTree = ref<SourceJsonTreeHandle | null>(null)
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
const output = computed(() => Object.fromEntries(
  fields.value.map(field => [field.key, field.value]),
))

watch(
  fields,
  (nextFields) => {
    if (!nextFields.some(field => field.key === expandedFieldKey.value)) {
      expandedFieldKey.value = nextFields[0]?.key ?? null
    }
  },
  { immediate: true },
)

function toggleField(key: string): void {
  if (expandedFieldKey.value === key) {
    expandedFieldKey.value = null
    return
  }

  expandedFieldKey.value = key
}

function setExpandedFieldTree(instance: unknown): void {
  expandedFieldTree.value = instance as SourceJsonTreeHandle | null
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
    <template #actions>
      <SourceJsonTreeControls
        :copy-value="output"
        @expand-all="expandedFieldTree?.expandAll()"
        @collapse-all="expandedFieldTree?.collapseAll()"
      />
    </template>

    <div v-if="!fields.length" class="p-4 text-xs text-slate-400">
      {{ copy.empty }}
    </div>

    <div v-else class="store-runtime-inspector__fields">
      <section
        v-for="field in fields"
        :key="field.key"
        class="store-runtime-inspector__field"
        :data-expanded="expandedFieldKey === field.key"
      >
        <button
          type="button"
          class="store-runtime-inspector__field-header"
          :aria-expanded="expandedFieldKey === field.key"
          @click="toggleField(field.key)"
        >
          <ChevronDown v-if="expandedFieldKey === field.key" class="mt-0.5 size-4 shrink-0 text-sky-300" />
          <ChevronRight v-else class="mt-0.5 size-4 shrink-0 text-slate-500" />

          <span class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <span class="font-mono text-xs font-semibold text-slate-100">{{ field.key }}</span>
            <span class="store-runtime-inspector__kind" :data-kind="field.kind">{{ field.kind }}</span>
          </span>
        </button>

        <div v-if="expandedFieldKey === field.key" class="store-runtime-inspector__field-body">
          <div v-if="field.kind === 'derived'" class="store-runtime-inspector__data-views">
            <span>{{ field.source }}</span>
            <template v-for="dataView in field.dataViews" :key="dataView">
              <span>{{ copy.flow }}</span>
              <span class="rounded border border-cyan-800/70 bg-cyan-950/40 px-1.5 py-0.5 text-cyan-200">{{ dataView }}</span>
            </template>
          </div>

          <SourceJsonTree
            :ref="setExpandedFieldTree"
            :data="field.value"
            :root-path="field.key"
          />
        </div>
      </section>
    </div>
  </SourceOutputPanel>
</template>

<style scoped>
.store-runtime-inspector__fields {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.store-runtime-inspector__field {
  min-height: 0;
  flex: 0 0 auto;
  border-bottom: 1px solid rgb(51 65 85 / 0.72);
}

.store-runtime-inspector__field[data-expanded='true'] {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.store-runtime-inspector__field-header {
  width: 100%;
  flex: 0 0 auto;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 7px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.store-runtime-inspector__field-header:hover {
  background: rgb(30 41 59 / 0.44);
}

.store-runtime-inspector__field-header:focus-visible {
  outline: 1px solid rgb(56 189 248 / 0.7);
  outline-offset: -2px;
}

.store-runtime-inspector__field-body {
  min-height: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-top: 1px solid rgb(51 65 85 / 0.56);
  background: rgb(2 6 23 / 0.34);
}

.store-runtime-inspector__data-views {
  flex: 0 0 auto;
  padding: 7px 12px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  border-bottom: 1px solid rgb(51 65 85 / 0.56);
  color: #94a3b8;
  font-size: 10px;
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
</style>
