<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type {
  ComponentSFCInteractionKeyboardCondition,
  ComponentSFCInteractionTriggerProjection,
  ComponentSFCIntrinsicEventDefinition,
  ComponentSFCTableCellInteractionModifier,
} from '@endge/core'

import { Check, CircleDot, CircleHelp, RotateCcw, X } from 'lucide-vue-next'
import { nextTick, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

import ComponentSFCKeyboardConditionEditor from './ComponentSFCKeyboardConditionEditor.vue'

const props = defineProps<{
  modelValue: ComponentSFCInteractionTriggerProjection
  events: readonly ComponentSFCIntrinsicEventDefinition[]
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: ComponentSFCInteractionTriggerProjection): void
}>()

type PhysicalModifier = 'shift' | 'ctrl' | 'alt' | 'meta' | 'altGraph'

interface RecordedGesture {
  key: string[]
  code: string[]
  heldKey: string[]
  heldCode: string[]
  modifiers: Partial<Record<ComponentSFCTableCellInteractionModifier, boolean>>
  button: number | null
}

const draft = ref(cloneTrigger(props.modelValue))
const recording = ref(false)
const recordedGesture = ref<RecordedGesture | null>(null)
const recordingHeldCodes = ref<string[]>([])
const recordingModifiers = ref<Partial<Record<PhysicalModifier, boolean>>>({})
const pressedKeys = new Map<string, string>()
let recordingSurface: HTMLElement | null = null

watch(
  () => props.modelValue,
  (value) => {
    cancelRecording()
    draft.value = cloneTrigger(value)
  },
  { deep: true },
)

function cloneTrigger(value: ComponentSFCInteractionTriggerProjection): ComponentSFCInteractionTriggerProjection {
  return {
    ...value,
    key: [...value.key],
    code: [...value.code],
    held: value.held ? { ...value.held, key: [...value.held.key], code: [...value.held.code] } : null,
    modifiers: { ...value.modifiers },
    flags: { ...value.flags },
  }
}

function commit(): void {
  emit('update:modelValue', cloneTrigger(draft.value))
}

function canRecordGesture(): boolean {
  const payloadType = props.events.find(event => event.name === draft.value.event)?.payloadType
  return payloadType === 'ComponentSFCPointerEventPayload'
    || payloadType === 'ComponentSFCKeyboardEventPayload'
}

function isKeyboardGesture(): boolean {
  return props.events.find(event => event.name === draft.value.event)?.payloadType === 'ComponentSFCKeyboardEventPayload'
}

function startRecording(): void {
  cancelRecording()
  recording.value = true
  void nextTick(() => recordingSurface?.focus())
}

function retryRecording(): void {
  recordedGesture.value = null
  clearLiveGesture()
  void nextTick(() => recordingSurface?.focus())
}

function canUsePortableMod(): boolean {
  return recordedGesture.value?.modifiers.ctrl === true
    || recordedGesture.value?.modifiers.meta === true
}

function usePortableMod(): void {
  const gesture = recordedGesture.value
  if (!gesture) {
    return
  }
  gesture.modifiers.ctrl = undefined
  gesture.modifiers.meta = undefined
  gesture.modifiers.mod = true
}

function cancelRecording(): void {
  recording.value = false
  recordedGesture.value = null
  recordingSurface = null
  clearLiveGesture()
}

function clearLiveGesture(): void {
  pressedKeys.clear()
  recordingHeldCodes.value = []
  recordingModifiers.value = {}
}

function setRecordingSurface(element: unknown): void {
  recordingSurface = element instanceof HTMLElement ? element : null
}

function recordingEventListeners(): Record<string, (event: Event) => void> {
  if (!recording.value || recordedGesture.value || isKeyboardGesture()) {
    return {}
  }
  return { [draft.value.event]: event => capturePointerGesture(event) }
}

function handleRecordingKeyDown(event: KeyboardEvent): void {
  if (!recording.value || recordedGesture.value) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  updateRecordingModifiers(event)
  if (!isModifierKey(event)) {
    pressedKeys.set(event.code || event.key, event.key)
  }
  syncRecordingHeldCodes()
  if (draft.value.event === 'keydown' && !isModifierKey(event)) {
    captureKeyboardGesture(event)
  }
}

function handleRecordingKeyUp(event: KeyboardEvent): void {
  if (!recording.value || recordedGesture.value) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  updateRecordingModifiers(event)
  if (draft.value.event === 'keyup' && !isModifierKey(event)) {
    captureKeyboardGesture(event)
    return
  }
  pressedKeys.delete(event.code || event.key)
  syncRecordingHeldCodes()
}

function captureKeyboardGesture(event: KeyboardEvent): void {
  const triggerCode = event.code || event.key
  const held = [...pressedKeys.entries()].filter(([code]) => code !== triggerCode)
  recordedGesture.value = {
    key: [event.key],
    code: [triggerCode],
    heldKey: held.map(([, key]) => key),
    heldCode: held.map(([code]) => code),
    modifiers: capturedModifiers(event),
    button: null,
  }
}

function capturePointerGesture(event: Event): void {
  const target = event.target instanceof Element ? event.target : null
  if (target?.closest('button, input, select, textarea, a')) {
    return
  }
  if (event.cancelable) {
    event.preventDefault()
  }
  event.stopPropagation()
  const pointerEvent = event as MouseEvent
  recordedGesture.value = {
    key: [],
    code: [],
    heldKey: [...pressedKeys.values()],
    heldCode: [...pressedKeys.keys()],
    modifiers: capturedModifiers(pointerEvent),
    button: typeof pointerEvent.button === 'number' ? pointerEvent.button : null,
  }
}

function applyRecordedGesture(): void {
  const gesture = recordedGesture.value
  if (!gesture) {
    return
  }
  draft.value.key = [...gesture.key]
  draft.value.code = [...gesture.code]
  draft.value.held = gesture.heldCode.length || gesture.heldKey.length
    ? {
        key: [...gesture.heldKey],
        code: [...gesture.heldCode],
        match: 'all',
        exact: true,
      }
    : null
  draft.value.modifiers = { ...gesture.modifiers }
  draft.value.button = gesture.button
  cancelRecording()
  commit()
}

function capturedModifiers(event: MouseEvent | KeyboardEvent): ComponentSFCInteractionTriggerProjection['modifiers'] {
  const modifiers: ComponentSFCInteractionTriggerProjection['modifiers'] = { exact: true }
  if (event.shiftKey) {
    modifiers.shift = true
  }
  if (event.ctrlKey) {
    modifiers.ctrl = true
  }
  if (event.altKey) {
    modifiers.alt = true
  }
  if (event.metaKey) {
    modifiers.meta = true
  }
  if (event.getModifierState?.('AltGraph')) {
    modifiers.altGraph = true
  }
  return modifiers
}

function updateRecordingModifiers(event: KeyboardEvent): void {
  recordingModifiers.value = {
    shift: event.shiftKey || undefined,
    ctrl: event.ctrlKey || undefined,
    alt: event.altKey || undefined,
    meta: event.metaKey || undefined,
    altGraph: event.getModifierState('AltGraph') || undefined,
  }
}

function syncRecordingHeldCodes(): void {
  recordingHeldCodes.value = [...pressedKeys.keys()]
}

function isModifierKey(event: KeyboardEvent): boolean {
  return ['Shift', 'Control', 'Alt', 'Meta', 'AltGraph'].includes(event.key)
}

function recordingTokens(): string[] {
  const gesture = recordedGesture.value
  if (gesture) {
    return uniqueTokens([
      ...modifierTokens(gesture.modifiers),
      ...gesture.heldCode.map(displayCode),
      ...gesture.code.map(displayCode),
      ...(gesture.button == null ? [] : [buttonLabel(gesture.button)]),
    ])
  }
  return uniqueTokens([
    ...modifierTokens(recordingModifiers.value),
    ...recordingHeldCodes.value.map(displayCode),
  ])
}

function triggerTokens(): string[] {
  const heldTokens = draft.value.held?.code.length
    ? draft.value.held.code.map(displayCode)
    : draft.value.held?.key ?? []
  const triggerKeys = draft.value.code.length
    ? draft.value.code.map(displayCode)
    : draft.value.key
  return uniqueTokens([
    ...modifierTokens(draft.value.modifiers),
    ...heldTokens,
    ...triggerKeys,
    ...(draft.value.button == null ? [] : [buttonLabel(draft.value.button)]),
  ])
}

function modifierTokens(modifiers: Partial<Record<ComponentSFCTableCellInteractionModifier, boolean>>): string[] {
  const labels: Array<[ComponentSFCTableCellInteractionModifier, string]> = [
    ['mod', 'Ctrl/Cmd'],
    ['ctrl', 'Ctrl'],
    ['shift', 'Shift'],
    ['alt', 'Alt'],
    ['meta', 'Meta'],
    ['altGraph', 'AltGr'],
  ]
  return labels.filter(([name]) => modifiers[name] === true).map(([, label]) => label)
}

function displayCode(code: string): string {
  if (/^Key[A-Z]$/.test(code)) {
    return code.slice(3)
  }
  if (/^Digit\d$/.test(code)) {
    return code.slice(5)
  }
  return code
}

function buttonLabel(button: number): string {
  return ['ЛКМ', 'Колесо', 'ПКМ', 'Назад', 'Вперёд'][button] ?? `Button ${button}`
}

function uniqueTokens(tokens: string[]): string[] {
  return [...new Set(tokens.filter(Boolean))]
}

function updateEvent(value: unknown): void {
  const event = String(value ?? '').trim()
  if (!event) {
    return
  }
  draft.value.event = event
  cancelRecording()
  const definition = props.events.find(candidate => candidate.name === event)
  if (definition?.payloadType !== 'ComponentSFCPointerEventPayload') {
    draft.value.button = null
  }
  commit()
}

function keyboardCondition(): ComponentSFCInteractionKeyboardCondition {
  return {
    ...(Object.keys(draft.value.modifiers).length ? { modifiers: { ...draft.value.modifiers } } : {}),
    ...(draft.value.held
      ? {
          held: {
            ...draft.value.held,
            key: [...draft.value.held.key],
            code: [...draft.value.held.code],
          },
        }
      : {}),
  }
}

function updateKeyboardCondition(value: ComponentSFCInteractionKeyboardCondition | null): void {
  draft.value.modifiers = { ...(value?.modifiers ?? {}) }
  draft.value.held = value?.held
    ? {
        key: [...(value.held.key ?? [])],
        code: [...(value.held.code ?? [])],
        match: value.held.match ?? 'all',
        exact: value.held.exact ?? false,
      }
    : null
  commit()
}

function toggleFlag(flag: keyof ComponentSFCInteractionTriggerProjection['flags']): void {
  if (flag === 'prevent' && draft.value.flags.passive) {
    return
  }
  if (flag === 'passive' && draft.value.flags.prevent) {
    return
  }
  draft.value.flags[flag] = draft.value.flags[flag] === true ? undefined : true
  commit()
}

function updateList(field: 'key' | 'code', raw: string): void {
  draft.value[field] = splitList(raw)
  commit()
}

function updateButton(raw: string): void {
  const value = raw.trim()
  draft.value.button = value === '' ? null : Number(value)
  if (!Number.isFinite(draft.value.button)) {
    draft.value.button = null
  }
  commit()
}

function updateNullableBoolean(field: 'repeat' | 'composing', value: unknown): void {
  draft.value[field] = value === 'true' ? true : value === 'false' ? false : null
  commit()
}

function splitList(value: string): string[] {
  return [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))]
}
</script>

<template>
  <div class="space-y-4">
    <div class="grid min-w-0 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div class="min-w-0 space-y-1.5">
        <Label class="text-xs">Событие</Label>
        <Select :model-value="draft.event" @update:model-value="updateEvent">
          <SelectTrigger class="editor-control w-full min-w-0 overflow-hidden [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="event in events" :key="event.name" :value="event.name">
              {{ event.displayName }} · {{ event.name }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="min-w-0 space-y-1.5">
        <Label class="text-xs">Комбинация</Label>
        <div class="editor-control flex min-h-9 min-w-0 items-center gap-2 rounded-md border border-border/70 p-1 pl-2">
          <div class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            <span v-if="!triggerTokens().length" class="text-xs text-muted-foreground">Без условий</span>
            <code
              v-for="token in triggerTokens()"
              :key="token"
              class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground"
            >
              {{ token }}
            </code>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            class="h-7 shrink-0 gap-1.5 px-2 text-[11px]"
            :disabled="!canRecordGesture()"
            :title="canRecordGesture() ? 'Записать физическую комбинацию' : 'Для этого события условия настраиваются вручную'"
            @click="startRecording"
          >
            <CircleDot class="size-3.5" />
            {{ triggerTokens().length ? 'Перезаписать' : 'Записать' }}
          </Button>
        </div>
      </div>
    </div>

    <div
      v-if="recording"
      :ref="setRecordingSurface"
      v-on="recordingEventListeners()"
      class="rounded-lg border border-primary/45 bg-primary/5 p-3 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      :draggable="draft.event.startsWith('drag')"
      tabindex="0"
      role="application"
      aria-label="Запись комбинации события"
      @keydown.capture="handleRecordingKeyDown"
      @keyup.capture="handleRecordingKeyUp"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2 text-xs font-semibold">
            <span class="relative flex size-2">
              <span v-if="!recordedGesture" class="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-60" />
              <span class="relative inline-flex size-2 rounded-full" :class="recordedGesture ? 'bg-primary' : 'bg-destructive'" />
            </span>
            {{ recordedGesture ? 'Комбинация записана' : 'Идёт запись' }}
            <code class="rounded bg-background/70 px-1.5 py-0.5 text-[10px]">{{ draft.event }}</code>
          </div>
          <p class="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {{ recordedGesture
              ? 'Проверьте комбинацию и примените её к trigger.'
              : `Удерживайте нужные клавиши и выполните ${draft.event} в этой области.` }}
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" class="size-7 text-muted-foreground" aria-label="Отменить запись" @click.stop="cancelRecording">
          <X class="size-3.5" />
        </Button>
      </div>

      <div class="mt-3 flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-border/60 bg-background/45 px-3 py-2">
        <span v-if="!recordingTokens().length" class="text-xs text-muted-foreground">Ожидаю комбинацию…</span>
        <code
          v-for="token in recordingTokens()"
          :key="token"
          class="rounded-md border border-border/60 bg-background px-2 py-1 text-xs font-semibold shadow-xs"
        >
          {{ token }}
        </code>
      </div>

      <div v-if="recordedGesture" class="mt-3 flex justify-end gap-2">
        <Button v-if="canUsePortableMod()" type="button" variant="outline" size="sm" class="mr-auto h-8 font-mono text-[11px]" @click.stop="usePortableMod">
          Использовать Ctrl/Cmd
        </Button>
        <Button type="button" variant="ghost" size="sm" class="h-8 gap-1.5" @click.stop="retryRecording">
          <RotateCcw class="size-3.5" />
          Ещё раз
        </Button>
        <Button type="button" size="sm" class="h-8 gap-1.5" @click.stop="applyRecordedGesture">
          <Check class="size-3.5" />
          Применить
        </Button>
      </div>
    </div>

    <details class="rounded-md border border-border/60 px-3 py-2">
      <summary class="cursor-pointer text-xs font-medium text-muted-foreground">Расширенные условия</summary>
      <div class="mt-3 space-y-3">
        <ComponentSFCKeyboardConditionEditor
          :model-value="keyboardCondition()"
          @update:model-value="updateKeyboardCondition"
        />

        <div class="grid gap-3 lg:grid-cols-3">
          <div class="space-y-1.5">
            <Label class="text-xs">Button</Label>
            <Input class="editor-control font-mono text-xs" type="number" min="0" max="4" :model-value="draft.button ?? ''" placeholder="Любая" @change="updateButton(($event.target as HTMLInputElement).value)" />
          </div>
        </div>

        <TooltipProvider :delay-duration="120">
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="space-y-1.5"><Label class="text-xs">Keyboard key</Label><Input class="editor-control font-mono text-xs" :model-value="draft.key.join(', ')" placeholder="Enter, Escape" @change="updateList('key', ($event.target as HTMLInputElement).value)" /></div>
            <div class="space-y-1.5"><Label class="text-xs">Keyboard code</Label><Input class="editor-control font-mono text-xs" :model-value="draft.code.join(', ')" placeholder="Enter, Space" @change="updateList('code', ($event.target as HTMLInputElement).value)" /></div>
            <div class="space-y-1.5">
              <div class="flex items-center gap-1">
                <Label class="text-xs">Repeat</Label>
                <Tooltip>
                  <TooltipTrigger as-child><button type="button" class="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted" aria-label="О настройке Repeat"><CircleHelp class="size-3.5" /></button></TooltipTrigger>
                  <TooltipContent side="top" class="max-w-80 leading-relaxed">Фильтр по KeyboardEvent.repeat.</TooltipContent>
                </Tooltip>
              </div>
              <Select :model-value="draft.repeat == null ? 'any' : String(draft.repeat)" @update:model-value="updateNullableBoolean('repeat', $event)">
                <SelectTrigger class="editor-control"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="any">Любое</SelectItem><SelectItem value="true">Только repeat</SelectItem><SelectItem value="false">Без repeat</SelectItem></SelectContent>
              </Select>
            </div>
            <div class="space-y-1.5">
              <div class="flex items-center gap-1">
                <Label class="text-xs">Composing</Label>
                <Tooltip>
                  <TooltipTrigger as-child><button type="button" class="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted" aria-label="О настройке Composing"><CircleHelp class="size-3.5" /></button></TooltipTrigger>
                  <TooltipContent side="top" class="max-w-80 leading-relaxed">Фильтр по KeyboardEvent.isComposing.</TooltipContent>
                </Tooltip>
              </div>
              <Select :model-value="draft.composing == null ? 'any' : String(draft.composing)" @update:model-value="updateNullableBoolean('composing', $event)">
                <SelectTrigger class="editor-control"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="any">Любое</SelectItem><SelectItem value="true">IME composing</SelectItem><SelectItem value="false">Не composing</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
        </TooltipProvider>
      </div>
    </details>

    <div class="space-y-1.5">
      <Label class="text-xs">Поведение события</Label>
      <div class="flex flex-wrap gap-1">
        <Button
          v-for="flag in (['stop', 'prevent', 'self', 'once', 'capture', 'passive'] as const)"
          :key="flag"
          type="button"
          variant="outline"
          size="sm"
          class="h-7 px-2 font-mono text-[11px]"
          :class="draft.flags[flag] ? 'border-primary/50 bg-primary/8 text-primary' : 'text-muted-foreground'"
          :disabled="(flag === 'prevent' && draft.flags.passive) || (flag === 'passive' && draft.flags.prevent)"
          :aria-pressed="draft.flags[flag] === true"
          @click="toggleFlag(flag)"
        >
          {{ flag }}
        </Button>
      </div>
    </div>
  </div>
</template>
