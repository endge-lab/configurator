<script setup lang="ts">
import type {
  ComponentSFCInteractionKeyboardCondition,
  ComponentSFCInteractionTriggerHeldKeys,
  ComponentSFCInteractionTriggerModifiers,
  ComponentSFCInteractionTriggerProjection,
  ComponentSFCIntrinsicEventDefinition,
  ComponentSFCTableCellInteractionModifier,
} from '@endge/core'
import type { SearchableSelectOption } from '@/shared/ui/searchable-select'

import { ChevronDown, CircleDot, X } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, ref, useSlots, watch } from 'vue'

import { Button } from '@/shared/ui/button'
import { Collapsible, CollapsibleContent } from '@/shared/ui/collapsible'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { SearchableSelect } from '@/shared/ui/searchable-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

type BindingMode = 'trigger' | 'condition'
type PhysicalModifier = 'shift' | 'ctrl' | 'alt' | 'meta' | 'altGraph'

interface RecordedGesture {
  key: string[]
  code: string[]
  heldKey: string[]
  heldCode: string[]
  modifiers: ComponentSFCInteractionTriggerProjection['modifiers']
  button: number | null
}

const props = withDefaults(defineProps<{
  mode?: BindingMode
  trigger?: ComponentSFCInteractionTriggerProjection | null
  condition?: ComponentSFCInteractionKeyboardCondition | null
  events?: readonly ComponentSFCIntrinsicEventDefinition[]
  disabled?: boolean
}>(), {
  mode: 'trigger',
  trigger: null,
  condition: null,
  events: () => [],
  disabled: false,
})

const emit = defineEmits<{
  'update:trigger': [value: ComponentSFCInteractionTriggerProjection]
  'update:condition': [value: ComponentSFCInteractionKeyboardCondition | null]
}>()

const EVENT_SEARCH_ALIASES: Readonly<Record<string, string>> = {
  click: 'single click mouse click клик одиночный клик',
  dblclick: 'double click double-click doubleclick двойной клик двойной щелчок',
  contextmenu: 'context menu right click right-click контекстное меню правый клик',
  mousedown: 'mouse down mouse button down press mouse button',
  mouseup: 'mouse up mouse button up release mouse button',
  mousemove: 'mouse move mouse movement',
  mouseover: 'mouse over hover mouse',
  mouseout: 'mouse out leave mouse',
  mouseenter: 'mouse enter',
  mouseleave: 'mouse leave',
  pointerdown: 'pointer down pointer press',
  pointerup: 'pointer up pointer release',
  pointermove: 'pointer move pointer movement',
  pointerover: 'pointer over hover pointer',
  pointerout: 'pointer out leave pointer',
  pointerenter: 'pointer enter',
  pointerleave: 'pointer leave',
  keydown: 'key down keyboard press нажать клавишу',
  keyup: 'key up keyboard release отпустить клавишу',
  focus: 'focus receive focus получить фокус',
  blur: 'blur lose focus потерять фокус',
  focusin: 'focus in enter focus',
  focusout: 'focus out leave focus',
  wheel: 'mouse wheel trackpad колесо трекпад',
  scroll: 'scroll scrolling прокрутить',
  dragstart: 'drag start start dragging',
  drag: 'drag dragging',
  dragend: 'drag end stop dragging',
  dragenter: 'drag enter',
  dragleave: 'drag leave',
  dragover: 'drag over',
  drop: 'drop release dragged item',
  input: 'input text input enter value ввод текста',
  change: 'change value change изменение значения',
}

const MODIFIER_OPTIONS = [
  { name: 'shift', help: 'Требует активный модификатор Shift.' },
  { name: 'ctrl', help: 'Требует активный модификатор Ctrl.' },
  { name: 'alt', help: 'Требует активный модификатор Alt (Option на macOS).' },
  { name: 'meta', help: 'Требует Meta: Command на macOS или клавишу Windows.' },
  { name: 'mod', help: 'Платформенный модификатор: Ctrl на Windows/Linux, Command на macOS.' },
  { name: 'altGraph', help: 'Требует активный AltGraph (AltGr).' },
  { name: 'exact', help: 'Запрещает дополнительные активные модификаторы, не указанные в условии.' },
] as const

const EVENT_FLAG_OPTIONS = [
  { name: 'stop', help: 'Вызывает stopPropagation() и останавливает дальнейшее всплытие события.' },
  { name: 'prevent', help: 'Вызывает preventDefault() и отменяет стандартное действие браузера.' },
  { name: 'self', help: 'Запускает reaction только когда event.target совпадает с текущим элементом.' },
  { name: 'once', help: 'Обработчик выполнится только один раз.' },
  { name: 'capture', help: 'Подключает обработчик в capture phase.' },
  { name: 'passive', help: 'Объявляет passive listener; несовместим с prevent.' },
] as const

const slots = useSlots()
const expanded = ref(false)
const recording = ref(false)
const recordingCodes = ref<string[]>([])
const recordingModifiers = ref<Partial<Record<PhysicalModifier, boolean>>>({})
const pressedKeys = new Map<string, string>()
const triggerDraft = ref(cloneTrigger(props.trigger))
const conditionDraft = ref(cloneCondition(props.condition))
let recordingSurface: HTMLElement | null = null

const isTriggerMode = computed(() => props.mode === 'trigger')
const hasReaction = computed(() => Boolean(slots.reaction))
const selectedEvent = computed(() => props.events.find(event => event.name === triggerDraft.value.event))
const eventOptions = computed<SearchableSelectOption[]>(() => {
  const options = props.events.map(event => ({
    value: event.name,
    label: `${event.displayName} · ${event.name}`,
    searchText: `${event.description} ${EVENT_SEARCH_ALIASES[event.name] ?? ''}`,
  }))
  if (!props.events.some(event => event.name === triggerDraft.value.event)) {
    options.unshift({
      value: triggerDraft.value.event,
      label: triggerDraft.value.event,
      searchText: triggerDraft.value.event,
    })
  }
  return options
})
const eventPayloadType = computed(() => selectedEvent.value?.payloadType)
const canRecord = computed(() => !props.disabled && (
  !isTriggerMode.value
  || eventPayloadType.value === 'ComponentSFCPointerEventPayload'
  || eventPayloadType.value === 'ComponentSFCKeyboardEventPayload'
))
const isKeyboardTrigger = computed(() => isTriggerMode.value && eventPayloadType.value === 'ComponentSFCKeyboardEventPayload')
const isPointerTrigger = computed(() => isTriggerMode.value && eventPayloadType.value === 'ComponentSFCPointerEventPayload')
const summaryTokens = computed(() => isTriggerMode.value
  ? triggerTokens(triggerDraft.value)
  : conditionTokens(conditionDraft.value))
const advancedCount = computed(() => {
  const condition = isTriggerMode.value ? triggerDraft.value : conditionDraft.value
  let count = Object.values(condition.modifiers ?? {}).filter(value => value != null).length
  if (condition.held) {
    count += 1
  }
  if (isTriggerMode.value) {
    if (triggerDraft.value.key.length || triggerDraft.value.code.length) {
      count += 1
    }
    if (triggerDraft.value.button != null) {
      count += 1
    }
    if (triggerDraft.value.repeat != null) {
      count += 1
    }
    if (triggerDraft.value.composing != null) {
      count += 1
    }
    count += Object.values(triggerDraft.value.flags).filter(Boolean).length
  }
  return count
})

watch(
  () => props.trigger,
  (value) => {
    if (isTriggerMode.value) {
      cancelRecording()
      triggerDraft.value = cloneTrigger(value)
    }
  },
  { immediate: true, deep: true },
)

watch(
  () => props.condition,
  (value) => {
    if (!isTriggerMode.value) {
      cancelRecording()
      conditionDraft.value = cloneCondition(value)
    }
  },
  { immediate: true, deep: true },
)

onBeforeUnmount(cancelRecording)

function createTrigger(event = 'click'): ComponentSFCInteractionTriggerProjection {
  return {
    event,
    key: [],
    code: [],
    held: null,
    modifiers: {},
    repeat: null,
    composing: null,
    button: null,
    flags: {},
  }
}

function cloneTrigger(value: ComponentSFCInteractionTriggerProjection | null | undefined): ComponentSFCInteractionTriggerProjection {
  if (!value) {
    return createTrigger()
  }
  return {
    ...value,
    event: String(value.event || 'click'),
    key: [...(value.key ?? [])],
    code: [...(value.code ?? [])],
    held: value.held
      ? {
          ...value.held,
          key: [...(value.held.key ?? [])],
          code: [...(value.held.code ?? [])],
          match: value.held.match ?? 'all',
          exact: value.held.exact ?? false,
        }
      : null,
    modifiers: { ...(value.modifiers ?? {}) },
    repeat: value.repeat ?? null,
    composing: value.composing ?? null,
    button: value.button ?? null,
    flags: { ...(value.flags ?? {}) },
  }
}

function cloneCondition(value: ComponentSFCInteractionKeyboardCondition | null | undefined): ComponentSFCInteractionKeyboardCondition {
  return {
    ...(value?.modifiers ? { modifiers: { ...value.modifiers } } : {}),
    ...(value?.held
      ? {
          held: {
            ...value.held,
            key: [...(value.held.key ?? [])],
            code: [...(value.held.code ?? [])],
          },
        }
      : {}),
  }
}

function publishTrigger(): void {
  emit('update:trigger', cloneTrigger(triggerDraft.value))
}

function publishCondition(): void {
  const next = cloneCondition(conditionDraft.value)
  if (!next.modifiers || !Object.keys(next.modifiers).length) {
    delete next.modifiers
  }
  if (!next.held || !(next.held.key?.length || next.held.code?.length)) {
    delete next.held
  }
  emit('update:condition', Object.keys(next).length ? next : null)
}

function updateEvent(value: unknown): void {
  const event = String(value ?? '').trim()
  if (!event) {
    return
  }
  triggerDraft.value.event = event
  cancelRecording()
  const definition = props.events.find(candidate => candidate.name === event)
  if (definition?.payloadType !== 'ComponentSFCPointerEventPayload') {
    triggerDraft.value.button = null
  }
  publishTrigger()
}

function startRecording(): void {
  if (!canRecord.value) {
    return
  }
  cancelRecording()
  expanded.value = true
  recording.value = true
  void nextTick(() => recordingSurface?.focus())
}

function cancelRecording(): void {
  recording.value = false
  recordingSurface = null
  pressedKeys.clear()
  recordingCodes.value = []
  recordingModifiers.value = {}
}

function setRecordingSurface(element: unknown): void {
  recordingSurface = element instanceof HTMLElement ? element : null
}

function recordingEventListeners(): Record<string, (event: Event) => void> {
  if (!recording.value || !isPointerTrigger.value) {
    return {}
  }
  return { [triggerDraft.value.event]: capturePointerGesture }
}

function handleRecordingKeyDown(event: KeyboardEvent): void {
  if (!recording.value) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  updateRecordingModifiers(event)
  if (!isModifierKey(event)) {
    pressedKeys.set(event.code || `key:${event.key}`, event.key)
    recordingCodes.value = [...pressedKeys.keys()].filter(code => !code.startsWith('key:'))
  }
  if (isTriggerMode.value && triggerDraft.value.event === 'keydown' && !isModifierKey(event)) {
    applyRecordedGesture(recordedKeyboardGesture(event))
  }
}

function handleRecordingKeyUp(event: KeyboardEvent): void {
  if (!recording.value) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  if (isTriggerMode.value) {
    updateRecordingModifiers(event)
    if (triggerDraft.value.event === 'keyup' && !isModifierKey(event)) {
      applyRecordedGesture(recordedKeyboardGesture(event))
    }
    return
  }
  applyRecordedGesture({
    key: [],
    code: [],
    heldKey: [...new Set(pressedKeys.values())],
    heldCode: [...new Set([...pressedKeys.keys()].filter(code => !code.startsWith('key:')))],
    modifiers: recordedModifiers(),
    button: null,
  })
}

function recordedKeyboardGesture(event: KeyboardEvent): RecordedGesture {
  const triggerCode = event.code || event.key
  const held = [...pressedKeys.entries()].filter(([code]) => code !== triggerCode)
  return {
    key: [event.key],
    code: [triggerCode],
    heldKey: held.map(([, key]) => key),
    heldCode: held.map(([code]) => code).filter(code => !code.startsWith('key:')),
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
  applyRecordedGesture({
    key: [],
    code: [],
    heldKey: [...pressedKeys.values()],
    heldCode: [...pressedKeys.keys()].filter(code => !code.startsWith('key:')),
    modifiers: capturedModifiers(pointerEvent),
    button: typeof pointerEvent.button === 'number' ? pointerEvent.button : null,
  })
}

function applyRecordedGesture(gesture: RecordedGesture): void {
  if (isTriggerMode.value) {
    triggerDraft.value.key = [...gesture.key]
    triggerDraft.value.code = [...gesture.code]
    triggerDraft.value.held = gesture.heldKey.length || gesture.heldCode.length
      ? { key: [...gesture.heldKey], code: [...gesture.heldCode], match: 'all', exact: true }
      : null
    triggerDraft.value.modifiers = { ...gesture.modifiers }
    triggerDraft.value.button = gesture.button
    publishTrigger()
  }
  else {
    conditionDraft.value = {
      modifiers: { ...gesture.modifiers },
      ...(gesture.heldKey.length || gesture.heldCode.length
        ? {
            held: {
              key: [...gesture.heldKey],
              code: [...gesture.heldCode],
              match: 'all',
              exact: true,
            },
          }
        : {}),
    }
    publishCondition()
  }
  cancelRecording()
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

function recordedModifiers(): ComponentSFCInteractionTriggerProjection['modifiers'] {
  const modifiers: ComponentSFCInteractionTriggerProjection['modifiers'] = { exact: true }
  for (const name of ['shift', 'ctrl', 'alt', 'meta', 'altGraph'] as const) {
    if (recordingModifiers.value[name]) {
      modifiers[name] = true
    }
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

function isModifierKey(event: KeyboardEvent): boolean {
  return ['Shift', 'Control', 'Alt', 'Meta', 'AltGraph'].includes(event.key)
}

function currentModifiers(): ComponentSFCInteractionTriggerModifiers {
  return isTriggerMode.value ? triggerDraft.value.modifiers : conditionDraft.value.modifiers ?? {}
}

function toggleModifier(name: keyof ComponentSFCInteractionTriggerModifiers): void {
  const modifiers = { ...currentModifiers() }
  const current = modifiers[name]
  modifiers[name] = current == null ? true : current ? false : undefined
  if (modifiers[name] === undefined) {
    delete modifiers[name]
  }
  if (isTriggerMode.value) {
    triggerDraft.value.modifiers = modifiers
    publishTrigger()
  }
  else {
    conditionDraft.value.modifiers = modifiers
    publishCondition()
  }
}

function currentHeld(): ComponentSFCInteractionTriggerHeldKeys | null {
  return isTriggerMode.value ? triggerDraft.value.held : conditionDraft.value.held ?? null
}

function updateHeldList(field: 'key' | 'code', raw: string): void {
  const held = currentHeld()
  const values = splitList(raw)
  const next: ComponentSFCInteractionTriggerHeldKeys = {
    key: field === 'key' ? values : [...(held?.key ?? [])],
    code: field === 'code' ? values : [...(held?.code ?? [])],
    match: held?.match ?? 'all',
    exact: held?.exact ?? false,
  }
  const hasKeys = Boolean(next.key?.length || next.code?.length)
  if (isTriggerMode.value) {
    triggerDraft.value.held = hasKeys
      ? { key: next.key ?? [], code: next.code ?? [], match: next.match ?? 'all', exact: next.exact ?? false }
      : null
    publishTrigger()
  }
  else {
    conditionDraft.value.held = hasKeys ? next : undefined
    publishCondition()
  }
}

function updateHeldMatch(value: unknown): void {
  const held = currentHeld()
  if (!held) {
    return
  }
  held.match = value === 'any' ? 'any' : 'all'
  publishCurrentHeld(held)
}

function toggleHeldExact(): void {
  const held = currentHeld()
  if (!held) {
    return
  }
  held.exact = !held.exact
  publishCurrentHeld(held)
}

function publishCurrentHeld(value: ComponentSFCInteractionTriggerHeldKeys): void {
  if (isTriggerMode.value) {
    triggerDraft.value.held = {
      key: [...(value.key ?? [])],
      code: [...(value.code ?? [])],
      match: value.match ?? 'all',
      exact: value.exact ?? false,
    }
    publishTrigger()
  }
  else {
    conditionDraft.value.held = { ...value, key: [...(value.key ?? [])], code: [...(value.code ?? [])] }
    publishCondition()
  }
}

function updateTriggerList(field: 'key' | 'code', raw: string): void {
  triggerDraft.value[field] = splitList(raw)
  publishTrigger()
}

function updateButton(raw: string): void {
  const value = raw.trim()
  const button = value === '' ? null : Number(value)
  triggerDraft.value.button = button != null && Number.isFinite(button) ? button : null
  publishTrigger()
}

function updateNullableBoolean(field: 'repeat' | 'composing', value: unknown): void {
  triggerDraft.value[field] = value === 'true' ? true : value === 'false' ? false : null
  publishTrigger()
}

function toggleFlag(flag: keyof ComponentSFCInteractionTriggerProjection['flags']): void {
  if (flag === 'prevent' && triggerDraft.value.flags.passive) {
    return
  }
  if (flag === 'passive' && triggerDraft.value.flags.prevent) {
    return
  }
  triggerDraft.value.flags[flag] = triggerDraft.value.flags[flag] === true ? undefined : true
  publishTrigger()
}

function conditionTokens(condition: ComponentSFCInteractionKeyboardCondition | null | undefined): string[] {
  return uniqueTokens([
    ...modifierTokens(condition?.modifiers),
    ...(condition?.held?.code?.length
      ? condition.held.code.map(displayCode)
      : condition?.held?.key ?? []),
  ])
}

function triggerTokens(trigger: ComponentSFCInteractionTriggerProjection): string[] {
  const held = trigger.held?.code.length ? trigger.held.code.map(displayCode) : trigger.held?.key ?? []
  const key = trigger.code.length ? trigger.code.map(displayCode) : trigger.key
  return uniqueTokens([
    ...modifierTokens(trigger.modifiers),
    ...held,
    ...key,
    ...(trigger.button == null ? [] : [buttonLabel(trigger.button)]),
  ])
}

function recordingTokens(): string[] {
  return uniqueTokens([
    ...modifierTokens(recordingModifiers.value),
    ...recordingCodes.value.map(displayCode),
  ])
}

function modifierTokens(modifiers: Partial<Record<ComponentSFCTableCellInteractionModifier, boolean>> | undefined): string[] {
  const labels = [
    ['mod', 'Ctrl/Cmd'],
    ['ctrl', 'Ctrl'],
    ['shift', 'Shift'],
    ['alt', 'Alt'],
    ['meta', 'Meta'],
    ['altGraph', 'AltGr'],
  ] as const
  return labels.filter(([name]) => modifiers?.[name] === true).map(([, label]) => label)
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

function uniqueTokens(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function splitList(value: string): string[] {
  return [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))]
}
</script>

<template>
  <Collapsible
    :open="expanded"
    class="editor-panel overflow-hidden rounded-lg border border-border/70"
    @update:open="expanded = $event"
  >
    <div class="grid min-w-0 gap-2 p-2.5 md:grid-cols-[minmax(9rem,0.8fr)_minmax(13rem,1.35fr)_auto] md:items-center">
      <div v-if="isTriggerMode" class="min-w-0">
        <SearchableSelect
          :model-value="triggerDraft.event"
          :options="eventOptions"
          :disabled="disabled"
          placeholder="Найти событие..."
          trigger-class="editor-control w-full min-w-0 text-foreground"
          @update:model-value="updateEvent"
        />
      </div>
      <div v-else class="px-1 text-xs font-medium text-muted-foreground">
        {{ $t('uiText.keyboardConditionc45b562c') }}
      </div>

      <button
        type="button"
        class="editor-control flex min-h-9 min-w-0 items-center gap-2 rounded-md border border-border/70 px-2 text-left hover:border-primary/45 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="!canRecord"
        :title="canRecord ? 'Записать комбинацию' : 'Для неизвестного события доступно только ручное редактирование'"
        @click="startRecording"
      >
        <span class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          <span v-if="!summaryTokens.length" class="text-xs text-muted-foreground">{{ $t('uiText.noConditionse0bc717e') }}</span>
          <code v-for="token in summaryTokens" :key="token" class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground">
            {{ token }}
          </code>
        </span>
        <span class="shrink-0 text-[10px] text-muted-foreground">{{ summaryTokens.length ? $t('uiText.rewrite621ab9c3') : $t('uiText.record4be73032') }}</span>
      </button>

      <div class="flex items-center justify-end gap-1">
        <Button v-if="hasReaction" type="button" variant="ghost" size="sm" class="h-8 px-2 text-[11px]" @click="expanded = true">
          {{ $t('uiText.reactionf996ddc3') }}
        </Button>
        <slot name="actions" />
        <Button type="button" variant="ghost" size="icon" class="size-8 text-muted-foreground" :aria-label="expanded ? 'Свернуть условия' : 'Раскрыть условия'" @click="expanded = !expanded">
          <ChevronDown class="size-4 transition-transform" :class="{ '-rotate-90': !expanded }" />
        </Button>
      </div>
    </div>

    <CollapsibleContent>
      <div class="space-y-3 border-t border-border/60 bg-background/20 p-3">
        <div
          v-if="recording"
          :ref="setRecordingSurface"
          class="rounded-lg border border-primary/45 bg-primary/5 p-3 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          :draggable="isTriggerMode && triggerDraft.event.startsWith('drag')"
          tabindex="0"
          role="application"
          aria-label="Запись комбинации события"
          v-on="recordingEventListeners()"
          @keydown.capture="handleRecordingKeyDown"
          @keyup.capture="handleRecordingKeyUp"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2 text-xs font-semibold">
                <span class="relative flex size-2">
                  <span class="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-60" />
                  <span class="relative inline-flex size-2 rounded-full bg-destructive" />
                </span>
                {{ $t('uiText.recordingInProgress69087bd9') }}
              </div>
              <p class="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {{ isTriggerMode
                  ? `Удерживайте нужные клавиши и выполните ${triggerDraft.event} в этой области. Комбинация применится сразу.`
                  : $t('uiText.pressTheRequiredKeysAndReleaseAnyOfThemTheConditionWb5424b87') }}
              </p>
            </div>
            <Button type="button" variant="ghost" size="icon" class="size-7 text-muted-foreground" aria-label="Отменить запись" @click.stop="cancelRecording">
              <X class="size-3.5" />
            </Button>
          </div>
          <div class="mt-3 flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-border/60 bg-background/45 px-3 py-2">
            <span v-if="!recordingTokens().length" class="text-xs text-muted-foreground">{{ $t('uiText.waitingForCombinationcb074be3') }}</span>
            <code v-for="token in recordingTokens()" :key="token" class="rounded-md border border-border/60 bg-background px-2 py-1 text-xs font-semibold shadow-xs">
              {{ token }}
            </code>
          </div>
        </div>

        <div v-else class="flex flex-wrap items-center justify-between gap-2">
          <div class="text-xs text-muted-foreground">
            {{ summaryTokens.length ? `Настроено: ${summaryTokens.join(' + ')}` : $t('uiText.limitingCombinationNotSet178555a6') }}
          </div>
          <Button type="button" variant="outline" size="sm" class="h-8 gap-1.5" :disabled="!canRecord" @click="startRecording">
            <CircleDot class="size-3.5" />
            {{ summaryTokens.length ? $t('uiText.rewrite621ab9c3') : $t('uiText.recordCombinationa6cc1078') }}
          </Button>
        </div>

        <TooltipProvider :delay-duration="160">
          <details class="rounded-md border border-border/60 px-3 py-2">
            <summary class="cursor-pointer text-xs font-medium text-muted-foreground" title="Ручная настройка точных условий события">
              {{ $t('uiText.advancedConditionsc53a2d87') }}{{ advancedCount ? ` · ${advancedCount}` : undefined }}
            </summary>
            <div class="mt-3 space-y-3">
              <div class="space-y-1.5">
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Label class="w-fit cursor-help font-mono text-xs">{{ $t('uiText.modifiers3dcdbf0f') }}</Label>
                  </TooltipTrigger>
                  <TooltipContent class="max-w-80 leading-relaxed">
                    {{ $t('uiText.modifierKeyConditionsEachClickCyclesTheValueTrueFals4a352964') }}
                  </TooltipContent>
                </Tooltip>
                <div class="flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-border/70 p-1">
                  <Tooltip v-for="modifier in MODIFIER_OPTIONS" :key="modifier.name">
                    <TooltipTrigger as-child>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        class="h-7 px-2 font-mono text-[11px]"
                        :class="currentModifiers()[modifier.name] === true ? 'bg-primary/12 text-primary' : currentModifiers()[modifier.name] === false ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300' : 'text-muted-foreground'"
                        :disabled="disabled"
                        :aria-pressed="currentModifiers()[modifier.name] === true"
                        @click="toggleModifier(modifier.name)"
                      >
                        {{ currentModifiers()[modifier.name] === false ? `!${modifier.name}` : modifier.name }}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent class="max-w-80 leading-relaxed">
                      {{ modifier.help }}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <div class="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
                <div class="space-y-1.5">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Label class="w-fit cursor-help font-mono text-xs">{{ $t('uiText.heldCodeaa0d8751') }}</Label>
                    </TooltipTrigger>
                    <TooltipContent class="max-w-80 leading-relaxed">
                      {{ $t('uiText.physicalKeyCodesThatShouldBeHeldEGKeyWOrEnter7b5b14e5') }}
                    </TooltipContent>
                  </Tooltip>
                  <Input class="editor-control font-mono text-xs" :disabled="disabled" :model-value="currentHeld()?.code?.join(', ') ?? ''" placeholder="KeyW, KeyE" @change="updateHeldList('code', ($event.target as HTMLInputElement).value)" />
                </div>
                <div class="space-y-1.5">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Label class="w-fit cursor-help font-mono text-xs">{{ $t('uiText.heldKey80969168') }}</Label>
                    </TooltipTrigger>
                    <TooltipContent class="max-w-80 leading-relaxed">
                      {{ $t('uiText.valuesOfKeyboardEventKeyThatShouldBeHeldDependOnKeyb0e93eb74') }}
                    </TooltipContent>
                  </Tooltip>
                  <Input class="editor-control font-mono text-xs" :disabled="disabled" :model-value="currentHeld()?.key?.join(', ') ?? ''" placeholder="w, e" @change="updateHeldList('key', ($event.target as HTMLInputElement).value)" />
                </div>
                <div v-if="currentHeld()" class="space-y-1.5">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Label class="w-fit cursor-help font-mono text-xs">{{ $t('uiText.heldMatch670d7083') }}</Label>
                    </TooltipTrigger>
                    <TooltipContent class="max-w-80 leading-relaxed">
                      {{ $t('uiText.allRequiresHoldingAllListedKeysAnyAtLeastOne088f0231') }}
                    </TooltipContent>
                  </Tooltip>
                  <div class="flex gap-1">
                    <Select :model-value="currentHeld()?.match ?? 'all'" :disabled="disabled" @update:model-value="updateHeldMatch">
                      <SelectTrigger class="editor-control h-9 w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {{ $t('uiText.alld87c4480') }}
                        </SelectItem><SelectItem value="any">
                          {{ $t('uiText.anyc5fe0200') }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button type="button" variant="outline" size="sm" class="h-9 px-2 font-mono text-[11px]" :class="currentHeld()?.exact ? 'border-primary/50 bg-primary/8 text-primary' : 'text-muted-foreground'" :disabled="disabled" @click="toggleHeldExact">
                          {{ $t('uiText.exactb55e22fe') }}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent class="max-w-80 leading-relaxed">
                        {{ $t('uiText.preventsAdditionalHeldKeysNotPresentInHeldKeyOrHeldC7bae02e9') }}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>

              <template v-if="isTriggerMode">
                <div class="grid gap-3 sm:grid-cols-2">
                  <div class="space-y-1.5">
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Label class="w-fit cursor-help font-mono text-xs">{{ $t('uiText.keya62f2225') }}</Label>
                      </TooltipTrigger>
                      <TooltipContent class="max-w-80 leading-relaxed">
                        {{ $t('uiText.allowedValuesOfKeyboardEventKeyForTheEventDependOnKe3602550f') }}
                      </TooltipContent>
                    </Tooltip>
                    <Input class="editor-control font-mono text-xs" :disabled="disabled" :model-value="triggerDraft.key.join(', ')" placeholder="Enter, Escape" @change="updateTriggerList('key', ($event.target as HTMLInputElement).value)" />
                  </div>
                  <div class="space-y-1.5">
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Label class="w-fit cursor-help font-mono text-xs">{{ $t('uiText.codee6fb0621') }}</Label>
                      </TooltipTrigger>
                      <TooltipContent class="max-w-80 leading-relaxed">
                        {{ $t('uiText.allowedPhysicalKeyboardEventCodeForTheEventDoNotDepeae985b58') }}
                      </TooltipContent>
                    </Tooltip>
                    <Input class="editor-control font-mono text-xs" :disabled="disabled" :model-value="triggerDraft.code.join(', ')" placeholder="Enter, Space" @change="updateTriggerList('code', ($event.target as HTMLInputElement).value)" />
                  </div>
                </div>

                <div class="grid gap-3 sm:grid-cols-3">
                  <div v-if="isPointerTrigger || triggerDraft.button != null" class="space-y-1.5">
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Label class="w-fit cursor-help font-mono text-xs">{{ $t('uiText.button7b7fcc78') }}</Label>
                      </TooltipTrigger>
                      <TooltipContent class="max-w-80 leading-relaxed">
                        {{ $t('uiText.valueOfMouseEventButton0Primary1Middle2SecondaryButtd0f7e855') }}
                      </TooltipContent>
                    </Tooltip>
                    <Input class="editor-control font-mono text-xs" type="number" min="0" max="4" :disabled="disabled" :model-value="triggerDraft.button ?? ''" placeholder="any" @change="updateButton(($event.target as HTMLInputElement).value)" />
                  </div>
                  <div v-if="isKeyboardTrigger || triggerDraft.repeat != null" class="space-y-1.5">
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Label class="w-fit cursor-help font-mono text-xs">{{ $t('uiText.repeatc0ac4842') }}</Label>
                      </TooltipTrigger>
                      <TooltipContent class="max-w-80 leading-relaxed">
                        {{ $t('uiText.filterByKeyboardEventRepeatTrueRepeatFalseFirstPressc988f5a0') }}
                      </TooltipContent>
                    </Tooltip>
                    <Select :model-value="triggerDraft.repeat == null ? 'any' : String(triggerDraft.repeat)" :disabled="disabled" @update:model-value="updateNullableBoolean('repeat', $event)">
                      <SelectTrigger class="editor-control">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">
                          {{ $t('uiText.anyc5fe0200') }}
                        </SelectItem><SelectItem value="true">
                          {{ $t('uiText.true5ffe533b') }}
                        </SelectItem><SelectItem value="false">
                          {{ $t('uiText.false7cb6efb9') }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div v-if="isKeyboardTrigger || triggerDraft.composing != null" class="space-y-1.5">
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Label class="w-fit cursor-help font-mono text-xs">{{ $t('uiText.composingb8ac4598') }}</Label>
                      </TooltipTrigger>
                      <TooltipContent class="max-w-80 leading-relaxed">
                        {{ $t('uiText.filterByIMECompositionStateTrueDuringCompositionFals60e962a6') }}
                      </TooltipContent>
                    </Tooltip>
                    <Select :model-value="triggerDraft.composing == null ? 'any' : String(triggerDraft.composing)" :disabled="disabled" @update:model-value="updateNullableBoolean('composing', $event)">
                      <SelectTrigger class="editor-control">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">
                          {{ $t('uiText.anyc5fe0200') }}
                        </SelectItem><SelectItem value="true">
                          {{ $t('uiText.true5ffe533b') }}
                        </SelectItem><SelectItem value="false">
                          {{ $t('uiText.false7cb6efb9') }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div class="space-y-1.5">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Label class="w-fit cursor-help font-mono text-xs">{{ $t('uiText.flagsc16186ba') }}</Label>
                    </TooltipTrigger>
                    <TooltipContent class="max-w-80 leading-relaxed">
                      {{ $t('uiText.modifiersOfDOMEventBehaviorTheirNamesMatchTheSourceC3e0b4f28') }}
                    </TooltipContent>
                  </Tooltip>
                  <div class="flex flex-wrap gap-1">
                    <Tooltip v-for="flag in EVENT_FLAG_OPTIONS" :key="flag.name">
                      <TooltipTrigger as-child>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          class="h-7 px-2 font-mono text-[11px]"
                          :class="triggerDraft.flags[flag.name] ? 'border-primary/50 bg-primary/8 text-primary' : 'text-muted-foreground'"
                          :disabled="disabled || (flag.name === 'prevent' && triggerDraft.flags.passive) || (flag.name === 'passive' && triggerDraft.flags.prevent)"
                          :aria-pressed="triggerDraft.flags[flag.name] === true"
                          @click="toggleFlag(flag.name)"
                        >
                          {{ flag.name }}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent class="max-w-80 leading-relaxed">
                        {{ flag.help }}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </template>
            </div>
          </details>
        </TooltipProvider>

        <div v-if="hasReaction" class="rounded-md border border-border/60 p-3">
          <slot name="reaction" />
        </div>
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>
