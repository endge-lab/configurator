<script setup lang="ts">
import type { FilterProgramPayload } from '@endge/core'

import { Endge, evaluateSourceExpression } from '@endge/core'
import { ChevronDown, ChevronUp, FileJson, RotateCcw } from 'lucide-vue-next'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { useEndgeSourceMonaco } from '@/features/endge-ide/tools/source-editor/use-endge-source-monaco'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>()
const container = ref<HTMLDivElement | null>(null)
const source = ref(props.modelValue ?? '')
const inlinePreviewOutput = ref<string | null>(null)
const inlinePreviewCollapsed = ref(false)
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
  if (previewTimer)
    clearTimeout(previewTimer)
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
  if (previewTimer)
    clearTimeout(previewTimer)

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
      if (output.kind === 'controls') {
        return [output.key, Object.fromEntries(output.fields.map(key => [
          key,
          state[key] ?? null,
        ]))]
      }

      // Predicate зависит от row, которого у preview Filter нет.
      return [output.key, null]
    }))
    inlinePreviewOutput.value = JSON.stringify(outputs, null, 2)
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

      <Button
        v-if="inlinePreviewOutput && inlinePreviewCollapsed"
        type="button"
        variant="outline"
        size="sm"
        class="filter-source-editor__preview-collapsed"
        title="Показать outputs.json"
        @click="inlinePreviewCollapsed = false"
      >
        <FileJson class="size-4" />
        outputs.json
        <ChevronDown class="size-4" />
      </Button>

      <div
        v-else-if="inlinePreviewOutput"
        class="filter-source-editor__preview-popover"
      >
        <div class="filter-source-editor__preview-title">
          <span>outputs.json · defaults</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            class="filter-source-editor__preview-toggle"
            aria-label="Свернуть outputs.json"
            title="Свернуть outputs.json"
            @click="inlinePreviewCollapsed = true"
          >
            <ChevronUp class="size-4" />
          </Button>
        </div>
        <pre class="filter-source-editor__preview-content">{{ inlinePreviewOutput }}</pre>
      </div>
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

.filter-source-editor__preview-popover {
  position: absolute;
  top: 12px;
  right: 18px;
  z-index: 5;
  width: min(420px, calc(100% - 36px));
  max-height: min(52%, 420px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgb(71 85 105 / 0.75);
  border-radius: 8px;
  background: rgb(15 23 42 / 0.94);
  color: #e5e7eb;
  box-shadow: 0 18px 40px rgb(0 0 0 / 0.38);
}

.filter-source-editor__preview-collapsed {
  position: absolute;
  top: 12px;
  right: 18px;
  z-index: 5;
  gap: 7px;
  border-color: rgb(71 85 105 / 0.75);
  background: rgb(15 23 42 / 0.94);
  color: #bfdbfe;
  box-shadow: 0 12px 28px rgb(0 0 0 / 0.28);
}

.filter-source-editor__preview-collapsed:hover {
  background: rgb(30 41 59 / 0.96);
  color: #dbeafe;
}

.filter-source-editor__preview-title {
  flex: 0 0 auto;
  min-height: 37px;
  padding: 5px 6px 5px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-bottom: 1px solid rgb(71 85 105 / 0.75);
  color: #93c5fd;
  font-size: 12px;
  font-weight: 600;
}

.filter-source-editor__preview-toggle {
  width: 26px;
  height: 26px;
  color: #bfdbfe;
}

.filter-source-editor__preview-toggle:hover {
  background: rgb(51 65 85 / 0.8);
  color: #dbeafe;
}

.filter-source-editor__preview-content {
  min-height: 0;
  margin: 0;
  padding: 10px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.45;
  white-space: pre;
}
</style>
