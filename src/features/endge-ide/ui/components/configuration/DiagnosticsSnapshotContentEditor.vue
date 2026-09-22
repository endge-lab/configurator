<script setup lang="ts">
import type { EndgeDiagnosticsSnapshotContentConfiguration } from '@endge/core'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

const props = defineProps<{
  modelValue: EndgeDiagnosticsSnapshotContentConfiguration
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: EndgeDiagnosticsSnapshotContentConfiguration]
}>()

/** Заменяет один content flag, не передавая mutable ссылку владельцу configuration. */
function setContent(
  key: keyof EndgeDiagnosticsSnapshotContentConfiguration,
  value: boolean | 'indeterminate',
): void {
  emit('update:modelValue', { ...props.modelValue, [key]: value === true })
}

/** Выбирает или очищает все части snapshot одной атомарной заменой model. */
function setAll(value: boolean): void {
  emit('update:modelValue', {
    telemetry: value,
    problems: value,
    configuration: value,
    effectiveConfiguration: value,
    domain: value,
    program: value,
    runtime: value,
    raphData: value,
    raphGraph: value,
  })
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="ghost" :disabled="disabled" @click="setAll(true)">
        {{ $t('diagnostics.snapshot.selectAll') }}
      </Button>
      <Button type="button" size="sm" variant="ghost" :disabled="disabled" @click="setAll(false)">
        {{ $t('diagnostics.snapshot.clearAll') }}
      </Button>
    </div>

    <div class="grid gap-3 xl:grid-cols-2">
      <div class="snapshot-group">
        <div>
          <p class="snapshot-group-title">
            {{ $t('diagnostics.snapshot.groups.diagnostics.title') }}
          </p>
          <p class="settings-hint">
            {{ $t('diagnostics.snapshot.groups.diagnostics.description') }}
          </p>
        </div>
        <label class="snapshot-option"><Checkbox :model-value="modelValue.telemetry" :disabled="disabled" @update:model-value="setContent('telemetry', $event)" />{{ $t('uiText.telemetryc2d0b0e9') }}</label>
        <label class="snapshot-option"><Checkbox :model-value="modelValue.problems" :disabled="disabled" @update:model-value="setContent('problems', $event)" />{{ $t('uiText.issues7c80872c') }}</label>
        <label class="snapshot-option"><Checkbox :model-value="modelValue.configuration" :disabled="disabled" @update:model-value="setContent('configuration', $event)" />{{ $t('diagnostics.snapshot.diagnosticsConfiguration') }}</label>
      </div>

      <div class="snapshot-group">
        <div>
          <p class="snapshot-group-title">
            {{ $t('diagnostics.snapshot.groups.model.title') }}
          </p>
          <p class="settings-hint">
            {{ $t('diagnostics.snapshot.groups.model.description') }}
          </p>
        </div>
        <label class="snapshot-option"><Checkbox :model-value="modelValue.effectiveConfiguration" :disabled="disabled" @update:model-value="setContent('effectiveConfiguration', $event)" />{{ $t('uiText.effectiveConfiguration15051cb3') }}</label>
        <label class="snapshot-option"><Checkbox :model-value="modelValue.domain" :disabled="disabled" @update:model-value="setContent('domain', $event)" />{{ $t('diagnostics.snapshot.domain') }}</label>
        <label class="snapshot-option"><Checkbox :model-value="modelValue.program" :disabled="disabled" @update:model-value="setContent('program', $event)" />{{ $t('diagnostics.snapshot.program') }}</label>
      </div>

      <div class="snapshot-group xl:col-span-2">
        <div>
          <p class="snapshot-group-title">
            {{ $t('diagnostics.snapshot.groups.runtime.title') }}
          </p>
          <p class="settings-hint">
            {{ $t('diagnostics.snapshot.groups.runtime.description') }}
          </p>
        </div>
        <div class="grid gap-3 sm:grid-cols-3">
          <label class="snapshot-option"><Checkbox :model-value="modelValue.runtime" :disabled="disabled" @update:model-value="setContent('runtime', $event)" />{{ $t('diagnostics.snapshot.runtime') }}</label>
          <label class="snapshot-option"><Checkbox :model-value="modelValue.raphData" :disabled="disabled" @update:model-value="setContent('raphData', $event)" />{{ $t('diagnostics.snapshot.raphData') }}</label>
          <label class="snapshot-option"><Checkbox :model-value="modelValue.raphGraph" :disabled="disabled" @update:model-value="setContent('raphGraph', $event)" />{{ $t('diagnostics.snapshot.raphGraph') }}</label>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-hint {
  margin-top: 0.25rem;
  color: var(--muted-foreground);
  font-size: 0.75rem;
  line-height: 1.25rem;
}

.snapshot-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) - 2px);
}

.snapshot-group-title {
  font-size: 0.75rem;
  font-weight: 600;
}

.snapshot-option {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  color: var(--foreground);
  font-size: 0.75rem;
}
</style>
