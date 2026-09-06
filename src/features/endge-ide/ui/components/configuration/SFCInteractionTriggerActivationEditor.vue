<script setup lang="ts">
import type {
  ComponentSFCInteractionTrigger,
  ComponentSFCInteractionTriggerActivation,
  ComponentSFCInteractionTriggerModifiers,
  ComponentSFCInteractionTriggerSequenceStep,
} from '@endge/core'

import { ArrowDown, ArrowUp, Check, Keyboard, Plus, Trash2, X } from 'lucide-vue-next'
import { computed, nextTick, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import SFCEditingTriggerListEditor from '@/features/endge-ide/ui/components/configuration/SFCEditingTriggerListEditor.vue'

const props = defineProps<{
  modelValue: ComponentSFCInteractionTriggerActivation
  kind: 'generic' | 'shortcut'
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ComponentSFCInteractionTriggerActivation]
}>()

const recording = ref(false)
const recordedSteps = ref<ComponentSFCInteractionTriggerSequenceStep[]>([])
let recordingSurface: HTMLElement | null = null
let lastRecordedAt: number | null = null

const mode = computed<'set' | 'sequence'>(() => Array.isArray(props.modelValue) ? 'set' : 'sequence')
const triggerSet = computed(() => Array.isArray(props.modelValue)
  ? props.modelValue
  : props.modelValue.steps[0]?.triggerSet ?? [])
const sequenceSteps = computed(() => Array.isArray(props.modelValue) ? [] : props.modelValue.steps)

function selectMode(value: 'set' | 'sequence'): void {
  if (value === mode.value) {
    return
  }
  cancelRecording()
  if (value === 'set') {
    emit('update:modelValue', clone(triggerSet.value))
    return
  }
  const first = triggerSet.value.length ? clone(triggerSet.value) : [createDefaultTrigger()]
  emit('update:modelValue', {
    mode: 'sequence',
    steps: [
      { triggerSet: first },
      { triggerSet: [createDefaultTrigger()], maxIntervalMs: 1_000 },
    ],
  })
}

function updateTriggerSet(value: ComponentSFCInteractionTrigger[]): void {
  emit('update:modelValue', clone(value))
}

function updateStepTriggerSet(index: number, value: ComponentSFCInteractionTrigger[]): void {
  const steps = clone(sequenceSteps.value)
  if (!steps[index]) {
    return
  }
  steps[index]!.triggerSet = clone(value)
  publishSteps(steps)
}

function updateStepInterval(index: number, value: unknown): void {
  const steps = clone(sequenceSteps.value)
  if (!steps[index] || index === 0) {
    return
  }
  steps[index]!.maxIntervalMs = clampInterval(value)
  publishSteps(steps)
}

function addStep(): void {
  publishSteps([
    ...clone(sequenceSteps.value),
    { triggerSet: [createDefaultTrigger()], maxIntervalMs: 1_000 },
  ])
}

function removeStep(index: number): void {
  if (sequenceSteps.value.length <= 2) {
    return
  }
  publishSteps(sequenceSteps.value.filter((_, stepIndex) => stepIndex !== index))
}

function moveStep(index: number, direction: -1 | 1): void {
  const target = index + direction
  if (target < 0 || target >= sequenceSteps.value.length) {
    return
  }
  const steps = clone(sequenceSteps.value)
  const [step] = steps.splice(index, 1)
  steps.splice(target, 0, step!)
  steps[0] = { triggerSet: steps[0]!.triggerSet }
  for (let stepIndex = 1; stepIndex < steps.length; stepIndex++) {
    steps[stepIndex]!.maxIntervalMs = steps[stepIndex]!.maxIntervalMs ?? 1_000
  }
  publishSteps(steps)
}

function publishSteps(steps: ComponentSFCInteractionTriggerSequenceStep[]): void {
  emit('update:modelValue', { mode: 'sequence', steps: clone(steps) })
}

function startRecording(): void {
  if (props.disabled) {
    return
  }
  recordedSteps.value = []
  lastRecordedAt = null
  recording.value = true
  void nextTick(() => recordingSurface?.focus())
}

function finishRecording(): void {
  if (recordedSteps.value.length < 2) {
    return
  }
  publishSteps(recordedSteps.value)
  cancelRecording()
}

function cancelRecording(): void {
  recording.value = false
  recordedSteps.value = []
  lastRecordedAt = null
  recordingSurface = null
}

function setRecordingSurface(value: unknown): void {
  recordingSurface = value instanceof HTMLElement ? value : null
}

function recordKey(event: KeyboardEvent): void {
  if (!recording.value) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  if (event.repeat || isModifierKey(event)) {
    return
  }

  const now = performance.now()
  const interval = lastRecordedAt == null
    ? undefined
    : clampInterval(Math.ceil((now - lastRecordedAt) / 100) * 100 + 250)
  recordedSteps.value.push({
    triggerSet: [{
      event: 'keydown',
      code: [event.code || event.key],
      modifiers: capturePortableModifiers(event),
      repeat: false,
      composing: false,
      prevent: true,
      stop: true,
    }],
    ...(interval != null ? { maxIntervalMs: interval } : {}),
  })
  lastRecordedAt = now
}

function capturePortableModifiers(event: KeyboardEvent): ComponentSFCInteractionTriggerModifiers {
  const modifiers: ComponentSFCInteractionTriggerModifiers = { exact: true }
  if (event.shiftKey) {
    modifiers.shift = true
  }
  if (event.altKey) {
    modifiers.alt = true
  }
  if (event.ctrlKey !== event.metaKey) {
    modifiers.mod = true
  }
  else {
    if (event.ctrlKey) {
      modifiers.ctrl = true
    }
    if (event.metaKey) {
      modifiers.meta = true
    }
  }
  if (event.getModifierState('AltGraph')) {
    modifiers.altGraph = true
  }
  return modifiers
}

function createDefaultTrigger(): ComponentSFCInteractionTrigger {
  return props.kind === 'shortcut'
    ? { event: 'keydown', repeat: false, composing: false, prevent: true, stop: true }
    : { event: 'click' }
}

function clampInterval(value: unknown): number {
  return Math.min(60_000, Math.max(1, Math.round(Number(value) || 1_000)))
}

function isModifierKey(event: KeyboardEvent): boolean {
  return ['Shift', 'Control', 'Alt', 'Meta', 'AltGraph'].includes(event.key)
}

function stepLabel(step: ComponentSFCInteractionTriggerSequenceStep): string {
  const trigger = step.triggerSet[0]
  if (!trigger) {
    return '—'
  }
  const modifiers = trigger.modifiers ?? {}
  const parts = [
    modifiers.mod ? 'Mod' : '',
    modifiers.ctrl ? 'Ctrl' : '',
    modifiers.meta ? 'Meta' : '',
    modifiers.alt ? 'Alt' : '',
    modifiers.shift ? 'Shift' : '',
    trigger.code?.[0] ?? trigger.key?.[0] ?? trigger.event,
  ].filter(Boolean)
  return parts.join(' + ')
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
</script>

<template>
  <div class="space-y-4">
    <div class="inline-flex rounded-md border bg-muted/40 p-1">
      <Button
        type="button"
        size="sm"
        :variant="mode === 'set' ? 'secondary' : 'ghost'"
        class="h-7"
        :disabled="disabled"
        @click="selectMode('set')"
      >
        {{ $t('diagnostics.snapshot.activation.set') }}
      </Button>
      <Button
        type="button"
        size="sm"
        :variant="mode === 'sequence' ? 'secondary' : 'ghost'"
        class="h-7"
        :disabled="disabled"
        @click="selectMode('sequence')"
      >
        {{ $t('diagnostics.snapshot.activation.sequence') }}
      </Button>
    </div>

    <SFCEditingTriggerListEditor
      v-if="mode === 'set'"
      :model-value="triggerSet"
      :kind="kind"
      :disabled="disabled"
      @update:model-value="updateTriggerSet"
    />

    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed p-3">
        <p class="max-w-xl text-xs leading-5 text-muted-foreground">
          {{ $t('diagnostics.snapshot.activation.sequenceHint') }}
        </p>
        <Button type="button" size="sm" variant="outline" :disabled="disabled" @click="startRecording">
          <Keyboard class="mr-1.5 size-3.5" />
          {{ $t('diagnostics.snapshot.activation.recordSequence') }}
        </Button>
      </div>

      <div
        v-if="recording"
        :ref="setRecordingSurface"
        data-endge-trigger-recording="true"
        tabindex="0"
        class="rounded-md border border-primary/50 bg-primary/5 p-4 outline-none ring-offset-background focus:ring-2 focus:ring-primary/30"
        @keydown.capture="recordKey"
        @keyup.capture.prevent.stop
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-medium">
              {{ $t('diagnostics.snapshot.activation.recordingTitle') }}
            </p>
            <p class="mt-1 text-xs text-muted-foreground">
              {{ $t('diagnostics.snapshot.activation.recordingHint') }}
            </p>
          </div>
          <div class="flex gap-1">
            <Button type="button" size="sm" variant="ghost" @click="cancelRecording">
              <X class="mr-1 size-3.5" />{{ $t('diagnostics.snapshot.activation.cancel') }}
            </Button>
            <Button type="button" size="sm" :disabled="recordedSteps.length < 2" @click="finishRecording">
              <Check class="mr-1 size-3.5" />{{ $t('diagnostics.snapshot.activation.finish') }}
            </Button>
          </div>
        </div>
        <div class="mt-3 flex min-h-8 flex-wrap items-center gap-2">
          <template v-for="(step, index) in recordedSteps" :key="index">
            <span v-if="index > 0" class="text-[11px] text-muted-foreground">
              {{ $t('diagnostics.snapshot.activation.withinInterval', { value: step.maxIntervalMs }) }}
            </span>
            <span class="rounded border bg-background px-2 py-1 font-mono text-xs">{{ stepLabel(step) }}</span>
          </template>
          <span v-if="!recordedSteps.length" class="text-xs text-muted-foreground">
            {{ $t('diagnostics.snapshot.activation.waiting') }}
          </span>
        </div>
      </div>

      <div class="space-y-3">
        <article
          v-for="(step, index) in sequenceSteps"
          :key="index"
          class="rounded-md border bg-card"
        >
          <div class="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
            <div class="flex items-center gap-3">
              <span class="text-xs font-semibold">{{ $t('diagnostics.snapshot.activation.step') }} {{ index + 1 }}</span>
              <div v-if="index > 0" class="flex items-center gap-2">
                <Label class="whitespace-nowrap text-[11px] text-muted-foreground">
                  {{ $t('diagnostics.snapshot.activation.interval') }}
                </Label>
                <Input
                  :model-value="step.maxIntervalMs ?? 1000"
                  type="number"
                  min="1"
                  max="60000"
                  class="h-7 w-28 text-xs"
                  :disabled="disabled"
                  @update:model-value="updateStepInterval(index, $event)"
                />
                <span class="text-[11px] text-muted-foreground">{{ $t('diagnostics.snapshot.activation.milliseconds') }}</span>
              </div>
            </div>
            <div class="flex gap-0.5">
              <Button type="button" size="icon" variant="ghost" class="size-7" :disabled="disabled || index === 0" @click="moveStep(index, -1)">
                <ArrowUp class="size-3.5" />
              </Button>
              <Button type="button" size="icon" variant="ghost" class="size-7" :disabled="disabled || index === sequenceSteps.length - 1" @click="moveStep(index, 1)">
                <ArrowDown class="size-3.5" />
              </Button>
              <Button type="button" size="icon" variant="ghost" class="size-7 text-muted-foreground hover:text-destructive" :disabled="disabled || sequenceSteps.length <= 2" @click="removeStep(index)">
                <Trash2 class="size-3.5" />
              </Button>
            </div>
          </div>
          <div class="p-3">
            <SFCEditingTriggerListEditor
              :model-value="step.triggerSet"
              :kind="kind"
              :disabled="disabled"
              @update:model-value="updateStepTriggerSet(index, $event)"
            />
          </div>
        </article>
      </div>

      <Button type="button" size="sm" variant="outline" :disabled="disabled" @click="addStep">
        <Plus class="mr-1.5 size-3.5" />{{ $t('diagnostics.snapshot.activation.addStep') }}
      </Button>
    </template>
  </div>
</template>
