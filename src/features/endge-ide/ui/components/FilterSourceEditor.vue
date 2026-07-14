<script setup lang="ts">
import type { FilterProgramPayload } from '@endge/core'

import { Endge, evaluateSourceExpression } from '@endge/core'
import { RotateCcw } from 'lucide-vue-next'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { useEndgeSourceMonaco } from '@/features/endge-ide/tools/source-editor/use-endge-source-monaco'
import SourceJsonTree from '@/features/endge-ide/ui/components/SourceJsonTree.vue'
import SourceJsonTreeControls from '@/features/endge-ide/ui/components/SourceJsonTreeControls.vue'
import SourceOutputPanel from '@/features/endge-ide/ui/components/SourceOutputPanel.vue'

interface SourceJsonTreeHandle {
  expandAll: () => void
  collapseAll: () => void
}

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>()
const container = ref<HTMLDivElement | null>(null)
const source = ref(props.modelValue ?? '')
const inlinePreviewOutput = ref<Record<string, unknown> | null>(null)
const inlinePreviewCollapsed = ref(false)
const inlinePreviewTree = ref<SourceJsonTreeHandle | null>(null)
let previewTimer: ReturnType<typeof setTimeout> | null = null

const monaco = useEndgeSourceMonaco({
  container,
  sourceKind: 'filter',
  value: () => source.value,
  onChange: (value) => {
    source.value = value
    emit('update:modelValue', value)
    scheduleInlinePreview()
  },
})
const diagnosticsCount = monaco.diagnosticsCount

watch(() => props.modelValue, (value) => {
  source.value = value ?? ''
  monaco.setValue(source.value)
  scheduleInlinePreview()
})

onMounted(() => {
  monaco.setValue(source.value)
  scheduleInlinePreview()
})

onBeforeUnmount(() => {
  if (previewTimer) {
    clearTimeout(previewTimer)
  }
})

function reset(): void {
  const value = Endge.source.createDefault('filter')
  source.value = value
  emit('update:modelValue', value)
  monaco.setValue(value)
  scheduleInlinePreview()
}

/** Обновляет preview после паузы ввода, не компилируя Filter на каждый символ. */
function scheduleInlinePreview(): void {
  if (previewTimer) {
    clearTimeout(previewTimer)
  }

  previewTimer = setTimeout(() => {
    updateInlinePreview()
  }, 240)
}

/** Формирует единый JSON всех Filter outputs на state, полученном из defaults. */
function updateInlinePreview(): void {
  const compiled = Endge.source.compile('filter', source.value)
  const artifact = compiled.ok && isFilterArtifact(compiled.artifact)
    ? compiled.artifact
    : null
  if (!artifact) {
    inlinePreviewOutput.value = null
    return
  }

  try {
    const state = Object.fromEntries(artifact.fields.map(field => [
      field.key,
      field.defaultValue
        ? evaluateSourceExpression(field.defaultValue)
        : undefined,
    ]))
    const outputs = Object.fromEntries(artifact.outputs.map((output) => {
      if (output.kind === 'json') {
        const value = evaluateSourceExpression(output.expression, { values: state })
        return [output.key, value ?? null]
      }

      // Predicate зависит от row, которого у preview Filter нет.
      return [output.key, null]
    }))
    inlinePreviewOutput.value = outputs
  }
  catch {
    inlinePreviewOutput.value = null
  }
}

function isFilterArtifact(value: unknown): value is FilterProgramPayload {
  return Boolean(value) && typeof value === 'object' && (value as { type?: unknown }).type === 'filter'
}
</script>

<template>
  <div class="filter-source-editor">
    <div class="filter-source-editor__toolbar">
      <span class="text-sm font-medium">Filter source · {{ diagnosticsCount }} diagnostics</span>
      <Button variant="outline" size="icon" class="h-8 w-8" title="Сбросить source" @click="reset">
        <RotateCcw class="size-4" />
      </Button>
    </div>

    <div class="filter-source-editor__body">
      <div ref="container" class="filter-source-editor__monaco" />

      <SourceOutputPanel
        v-if="inlinePreviewOutput"
        v-model:collapsed="inlinePreviewCollapsed"
        title="outputs.json · defaults"
        collapse-label="Свернуть outputs.json"
        expand-label="Показать outputs.json"
        mode="full-height"
      >
        <template #actions>
          <SourceJsonTreeControls
            :copy-value="inlinePreviewOutput"
            @expand-all="inlinePreviewTree?.expandAll()"
            @collapse-all="inlinePreviewTree?.collapseAll()"
          />
        </template>

        <SourceJsonTree ref="inlinePreviewTree" :data="inlinePreviewOutput" root-path="outputs" />
      </SourceOutputPanel>
    </div>
  </div>
</template>

<style scoped>
.filter-source-editor {
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: hsl(var(--background));
}

.filter-source-editor__toolbar {
  min-height: 44px;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--muted) / 0.45);
}

.filter-source-editor__body {
  position: relative;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: #1e1e1e;
}

.filter-source-editor__monaco {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  width: 100%;
  background: #1e1e1e;
}
</style>
