<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type {
  ComponentSFCTableCellInteractionFlag,
  ComponentSFCTableCellInteractionModifier,
  ComponentSFCTableCellInteractionRuleProjection,
  ComponentSFCTableCellInteractionsProjection,
} from '@endge/core'

import { Endge, getComponentSFCIntrinsicEventDefinitions } from '@endge/core'
import { Check, ChevronDown, CircleDot, CircleHelp, FileCode2, Plus, RotateCcw, Trash2, X } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const props = defineProps<{
  modelValue: ComponentSFCTableCellInteractionsProjection
}>()

const emit = defineEmits<{
  (event: 'update', value: string | null): void
  (event: 'openSource'): void
}>()

type RuleDraft = ComponentSFCTableCellInteractionRuleProjection
type PhysicalModifier = 'shift' | 'ctrl' | 'alt' | 'meta' | 'altGraph'

interface RecordedGesture {
  key: string[]
  code: string[]
  heldKey: string[]
  heldCode: string[]
  modifiers: Partial<Record<ComponentSFCTableCellInteractionModifier, boolean>>
  button: number | null
}

const events = getComponentSFCIntrinsicEventDefinitions('Cell')
const actionsRevision = ref(0)
const unsubscribeActions = Endge.actions.subscribe(() => actionsRevision.value += 1)
const actions = computed(() => (void actionsRevision.value, Endge.actions.listResolved())
  .filter(action => action.active && Boolean(action.identity.trim()))
  .sort((left, right) => {
    const groupDifference = actionGroupOrder(left.origin.kind) - actionGroupOrder(right.origin.kind)
    return groupDifference || left.displayName.localeCompare(right.displayName)
  }))
const actionOptions = computed<SearchableSelectOption[]>(() => actions.value.map(action => ({
  value: action.identity,
  label: action.displayName || action.identity,
  group: actionGroupLabel(action.origin.kind),
})))
const drafts = ref<RuleDraft[]>([])
const expanded = ref<Set<number>>(new Set())
const recordingRuleIndex = ref<number | null>(null)
const recordedGesture = ref<RecordedGesture | null>(null)
const recordingHeldCodes = ref<string[]>([])
const recordingModifiers = ref<Partial<Record<PhysicalModifier, boolean>>>({})
const pressedKeys = new Map<string, string>()
let recordingSurface: HTMLElement | null = null

watch(
  () => props.modelValue,
  (value) => {
    cancelRecording()
    drafts.value = value.rules.map(cloneRule)
  },
  { immediate: true, deep: true },
)

onBeforeUnmount(() => {
  cancelRecording()
  unsubscribeActions()
})

function cloneRule(rule: RuleDraft): RuleDraft {
  return {
    ...rule,
    key: [...rule.key],
    code: [...rule.code],
    held: rule.held ? { ...rule.held, key: [...rule.held.key], code: [...rule.held.code] } : null,
    modifiers: { ...rule.modifiers },
    flags: { ...rule.flags },
  }
}

function createRule(): RuleDraft {
  return {
    event: 'click',
    key: [],
    code: [],
    held: null,
    modifiers: {},
    repeat: null,
    composing: null,
    button: 0,
    flags: {},
    reactionSource: serializeAction(actions.value[0]),
  }
}

function addRule(): void {
  const next = [...drafts.value, createRule()]
  drafts.value = next
  expanded.value = new Set([...expanded.value, next.length - 1])
  commit()
}

function removeRule(index: number): void {
  const next = [...drafts.value]
  next.splice(index, 1)
  drafts.value = next
  expanded.value = new Set([...expanded.value].filter(item => item !== index).map(item => item > index ? item - 1 : item))
  commit()
}

function setExpanded(index: number, open: boolean): void {
  const next = new Set(expanded.value)
  open ? next.add(index) : next.delete(index)
  expanded.value = next
}

function isRecording(index: number): boolean {
  return recordingRuleIndex.value === index
}

function canRecordGesture(rule: RuleDraft): boolean {
  const payloadType = events.find(event => event.name === rule.event)?.payloadType
  return payloadType === 'ComponentSFCPointerEventPayload'
    || payloadType === 'ComponentSFCKeyboardEventPayload'
}

function isKeyboardGesture(rule: RuleDraft): boolean {
  return events.find(event => event.name === rule.event)?.payloadType === 'ComponentSFCKeyboardEventPayload'
}

function startRecording(index: number): void {
  cancelRecording()
  recordingRuleIndex.value = index
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
  recordingRuleIndex.value = null
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

function recordingEventListeners(index: number, rule: RuleDraft): Record<string, (event: Event) => void> {
  if (!isRecording(index) || recordedGesture.value || isKeyboardGesture(rule)) {
    return {}
  }
  return {
    [rule.event]: event => capturePointerGesture(index, event),
  }
}

function handleRecordingKeyDown(index: number, rule: RuleDraft, event: KeyboardEvent): void {
  if (!isRecording(index) || recordedGesture.value) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  updateRecordingModifiers(event)
  if (!isModifierKey(event)) {
    pressedKeys.set(event.code || event.key, event.key)
  }
  syncRecordingHeldCodes()
  if (rule.event === 'keydown' && !isModifierKey(event)) {
    captureKeyboardGesture(index, event)
  }
}

function handleRecordingKeyUp(index: number, rule: RuleDraft, event: KeyboardEvent): void {
  if (!isRecording(index) || recordedGesture.value) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  updateRecordingModifiers(event)
  if (rule.event === 'keyup' && !isModifierKey(event)) {
    captureKeyboardGesture(index, event)
    return
  }
  pressedKeys.delete(event.code || event.key)
  syncRecordingHeldCodes()
}

function captureKeyboardGesture(index: number, event: KeyboardEvent): void {
  if (!isRecording(index)) {
    return
  }
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

function capturePointerGesture(index: number, event: Event): void {
  if (!isRecording(index)) {
    return
  }
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

function applyRecordedGesture(index: number): void {
  const rule = drafts.value[index]
  const gesture = recordedGesture.value
  if (!rule || !gesture || !isRecording(index)) {
    return
  }
  rule.key = [...gesture.key]
  rule.code = [...gesture.code]
  rule.held = gesture.heldCode.length || gesture.heldKey.length
    ? {
        key: [...gesture.heldKey],
        code: [...gesture.heldCode],
        match: 'all',
        exact: true,
      }
    : null
  rule.modifiers = { ...gesture.modifiers }
  rule.button = gesture.button
  cancelRecording()
  commit()
}

function capturedModifiers(event: MouseEvent | KeyboardEvent): RuleDraft['modifiers'] {
  const modifiers: RuleDraft['modifiers'] = { exact: true }
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

function ruleGestureTokens(rule: RuleDraft): string[] {
  const heldTokens = rule.held?.code.length
    ? rule.held.code.map(displayCode)
    : rule.held?.key ?? []
  const triggerTokens = rule.code.length
    ? rule.code.map(displayCode)
    : rule.key
  return uniqueTokens([
    ...modifierTokens(rule.modifiers),
    ...heldTokens,
    ...triggerTokens,
    ...(rule.button == null ? [] : [buttonLabel(rule.button)]),
  ])
}

function ruleGestureSummary(rule: RuleDraft): string {
  const tokens = ruleGestureTokens(rule)
  return tokens.length ? tokens.join(' + ') : 'Без условий'
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

function updateEvent(index: number, value: unknown): void {
  const event = String(value ?? '').trim()
  if (!event || !drafts.value[index]) return
  const rule = drafts.value[index]!
  rule.event = event
  if (isRecording(index)) {
    cancelRecording()
  }
  const definition = events.find(candidate => candidate.name === event)
  if (definition?.payloadType !== 'ComponentSFCPointerEventPayload') rule.button = null
  commit()
}

function toggleModifier(rule: RuleDraft, modifier: ComponentSFCTableCellInteractionModifier): void {
  const current = rule.modifiers[modifier]
  rule.modifiers[modifier] = current == null ? true : current ? false : undefined
  commit()
}

function toggleFlag(rule: RuleDraft, flag: ComponentSFCTableCellInteractionFlag): void {
  if (flag === 'prevent' && rule.flags.passive) return
  if (flag === 'passive' && rule.flags.prevent) return
  rule.flags[flag] = rule.flags[flag] === true ? undefined : true
  commit()
}

function heldCodes(rule: RuleDraft): string {
  return rule.held?.code.join(', ') ?? ''
}

function updateHeldCodes(rule: RuleDraft, raw: string): void {
  const code = splitList(raw)
  rule.held = code.length
    ? { key: rule.held?.key ?? [], code, match: rule.held?.match ?? 'all', exact: rule.held?.exact ?? false }
    : null
  commit()
}

function updateHeldMatch(rule: RuleDraft, value: unknown): void {
  if (!rule.held) return
  rule.held.match = value === 'any' ? 'any' : 'all'
  commit()
}

function toggleHeldExact(rule: RuleDraft): void {
  if (!rule.held) return
  rule.held.exact = !rule.held.exact
  commit()
}

function updateList(rule: RuleDraft, field: 'key' | 'code', raw: string): void {
  rule[field] = splitList(raw)
  commit()
}

function updateButton(rule: RuleDraft, raw: string): void {
  const value = raw.trim()
  rule.button = value === '' ? null : Number(value)
  if (!Number.isFinite(rule.button)) rule.button = null
  commit()
}

function updateNullableBoolean(rule: RuleDraft, field: 'repeat' | 'composing', value: unknown): void {
  rule[field] = value === 'true' ? true : value === 'false' ? false : null
  commit()
}

function selectedAction(rule: RuleDraft): string | null {
  const match = rule.reactionSource.match(/\bidentity\s*:\s*(['"])(.*?)\1/)
  return match?.[2] && actions.value.some(action => action.identity === match[2]) ? match[2] : null
}

function updateAction(rule: RuleDraft, value: string | string[] | null): void {
  if (!value || Array.isArray(value)) return
  rule.reactionSource = serializeAction(actions.value.find(action => action.identity === value))
  commit()
}

function serializeAction(action: { identity: string } | undefined): string {
  const identity = action?.identity || 'action.identity'
  const definition = action ? Endge.actions.getDefinition(action.identity) : null
  const params = [...(definition?.input?.params?.values() ?? [])]
  const input = action
    ? params.length
      ? `{ ${params.map(param => `${param.name}: ${cellActionInputSource(param.name)}`).join(', ')} }`
      : 'event()'
    : '{ rowId: rowKey, row, rowIndex, columnKey, value, event: event() }'
  return `action({ identity: ${quote(identity)}, input: ${input} })`
}

function actionGroupOrder(kind: 'storage' | 'builtin' | 'derived' | 'local'): number {
  return ({ builtin: 0, storage: 1, derived: 2, local: 3 })[kind]
}

function actionGroupLabel(kind: 'storage' | 'builtin' | 'derived' | 'local'): string {
  return ({ builtin: 'Built-in', storage: 'Actions', derived: 'Provided', local: 'Local' })[kind]
}

function cellActionInputSource(name: string): string {
  if (name === 'rowId' || name === 'rowKey') return 'rowKey'
  if (name === 'row' || name === 'rowIndex' || name === 'columnKey' || name === 'value') return name
  if (name === 'event') return 'event()'
  return `event(${quote(name)})`
}

function commit(): void {
  emit('update', drafts.value.length ? serializeRules(drafts.value) : null)
}

function serializeRules(rules: RuleDraft[]): string {
  const serialized = rules.map(serializeRule)
  return serialized.length === 1 ? serialized[0]! : `[\n${serialized.map(rule => `  ${rule}`).join(',\n')}\n]`
}

function serializeRule(rule: RuleDraft): string {
  const fields = [`event: ${quote(rule.event)}`]
  if (rule.key.length) fields.push(`key: ${serializeStringList(rule.key)}`)
  if (rule.code.length) fields.push(`code: ${serializeStringList(rule.code)}`)
  if (rule.held) {
    const held = []
    if (rule.held.key.length) held.push(`key: ${serializeStringList(rule.held.key)}`)
    if (rule.held.code.length) held.push(`code: ${serializeStringList(rule.held.code)}`)
    if (rule.held.match === 'any') held.push(`match: 'any'`)
    if (rule.held.exact) held.push('exact: true')
    if (held.length) fields.push(`held: { ${held.join(', ')} }`)
  }
  const modifiers = Object.entries(rule.modifiers)
    .filter(([, value]) => value != null)
    .map(([name, value]) => `${name}: ${value}`)
  if (modifiers.length) fields.push(`modifiers: { ${modifiers.join(', ')} }`)
  if (rule.repeat != null) fields.push(`repeat: ${rule.repeat}`)
  if (rule.composing != null) fields.push(`composing: ${rule.composing}`)
  if (rule.button != null) fields.push(`button: ${rule.button}`)
  for (const flag of ['stop', 'prevent', 'self', 'once', 'capture', 'passive'] as const) {
    if (rule.flags[flag] === true) fields.push(`${flag}: true`)
  }
  fields.push(`reaction: ${rule.reactionSource.trim() || serializeAction(undefined)}`)
  return `{ ${fields.join(', ')} }`
}

function serializeStringList(values: string[]): string {
  return values.length === 1 ? quote(values[0]!) : `[${values.map(quote).join(', ')}]`
}

function quote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

function splitList(value: string): string[] {
  return [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))]
}
</script>

<template>
  <section class="bg-background/10 px-5 py-4">
    <div class="mb-3 flex justify-end">
      <Button v-if="modelValue.editable" type="button" size="sm" class="gap-1.5" @click="addRule">
        <Plus class="size-3.5" />
        Событие
      </Button>
    </div>

    <div v-if="!modelValue.editable" class="editor-control flex items-center justify-between gap-4 rounded-lg border border-border/70 px-4 py-3">
      <div class="min-w-0">
        <div class="text-sm font-medium">Аннотация управляется Source</div>
        <div class="mt-0.5 text-xs text-muted-foreground">{{ modelValue.message }}</div>
      </div>
      <Button type="button" variant="outline" size="sm" class="shrink-0 gap-1.5" @click="$emit('openSource')">
        <FileCode2 class="size-3.5" />
        Открыть
      </Button>
    </div>

    <div v-else-if="!drafts.length" class="rounded-lg border border-dashed border-border/70 px-4 py-7 text-center text-xs text-muted-foreground">
      Нет обработчиков. Добавьте только те события, на которые нужна реакция.
    </div>

    <div v-else class="space-y-2">
      <div v-if="modelValue.suffixes.length" class="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
        <span>Для всех правил:</span>
        <code v-for="suffix in modelValue.suffixes" :key="suffix" class="rounded bg-muted px-1.5 py-0.5">.{{ suffix }}</code>
      </div>

      <Collapsible
        v-for="(rule, index) in drafts"
        :key="`${index}:${rule.event}`"
        :open="expanded.has(index)"
        class="editor-panel overflow-hidden rounded-lg border border-border/70"
        @update:open="setExpanded(index, $event)"
      >
        <div class="flex min-h-14 items-center gap-2 p-2.5">
          <button type="button" class="flex min-w-0 flex-1 items-center gap-2 text-left" @click="setExpanded(index, !expanded.has(index))">
            <ChevronDown class="size-4 shrink-0 text-muted-foreground transition-transform" :class="{ '-rotate-90': !expanded.has(index) }" />
            <span class="min-w-0 flex-1">
              <span class="block font-mono text-sm">{{ rule.event }}</span>
              <span class="block truncate text-[11px] text-muted-foreground">
                {{ ruleGestureSummary(rule) }}
              </span>
            </span>
          </button>
          <Button type="button" variant="ghost" size="icon" class="size-8 text-muted-foreground hover:text-destructive" aria-label="Удалить обработчик" @click="removeRule(index)">
            <Trash2 class="size-3.5" />
          </Button>
        </div>

        <CollapsibleContent>
          <div class="space-y-4 border-t border-border/60 p-3">
            <div class="grid gap-3 md:grid-cols-[minmax(180px,0.55fr)_minmax(260px,1.45fr)]">
              <div class="space-y-1.5">
                <Label class="text-xs">Событие</Label>
                <Select :model-value="rule.event" @update:model-value="updateEvent(index, $event)">
                  <SelectTrigger class="editor-control"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="event in events" :key="event.name" :value="event.name">
                      {{ event.displayName }} · {{ event.name }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="space-y-1.5">
                <Label class="text-xs">Комбинация</Label>
                <div class="editor-control flex min-h-9 items-center gap-2 rounded-md border border-border/70 p-1 pl-2">
                  <div class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                    <span v-if="!ruleGestureTokens(rule).length" class="text-xs text-muted-foreground">
                      Без условий
                    </span>
                    <code
                      v-for="token in ruleGestureTokens(rule)"
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
                    :disabled="!canRecordGesture(rule)"
                    :title="canRecordGesture(rule) ? 'Записать физическую комбинацию' : 'Для этого события условия настраиваются вручную'"
                    @click="startRecording(index)"
                  >
                    <CircleDot class="size-3.5" />
                    {{ ruleGestureTokens(rule).length ? 'Перезаписать' : 'Записать' }}
                  </Button>
                </div>
              </div>
            </div>

            <div
              v-if="isRecording(index)"
              :ref="setRecordingSurface"
              v-on="recordingEventListeners(index, rule)"
              class="rounded-lg border border-primary/45 bg-primary/5 p-3 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              :draggable="rule.event.startsWith('drag')"
              tabindex="0"
              role="application"
              aria-label="Запись комбинации события"
              @keydown.capture="handleRecordingKeyDown(index, rule, $event)"
              @keyup.capture="handleRecordingKeyUp(index, rule, $event)"
            >
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-2 text-xs font-semibold">
                    <span class="relative flex size-2">
                      <span v-if="!recordedGesture" class="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-60" />
                      <span class="relative inline-flex size-2 rounded-full" :class="recordedGesture ? 'bg-primary' : 'bg-destructive'" />
                    </span>
                    {{ recordedGesture ? 'Комбинация записана' : 'Идёт запись' }}
                    <code class="rounded bg-background/70 px-1.5 py-0.5 text-[10px]">{{ rule.event }}</code>
                  </div>
                  <p class="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {{ recordedGesture
                      ? 'Проверьте комбинацию и примените её к обработчику.'
                      : `Удерживайте нужные клавиши и выполните ${rule.event} в этой области.` }}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="icon" class="size-7 text-muted-foreground" aria-label="Отменить запись" @click.stop="cancelRecording">
                  <X class="size-3.5" />
                </Button>
              </div>

              <div class="mt-3 flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-border/60 bg-background/45 px-3 py-2">
                <span v-if="!recordingTokens().length" class="text-xs text-muted-foreground">
                  Ожидаю комбинацию…
                </span>
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
                <Button type="button" size="sm" class="h-8 gap-1.5" @click.stop="applyRecordedGesture(index)">
                  <Check class="size-3.5" />
                  Применить
                </Button>
              </div>
            </div>

            <details class="rounded-md border border-border/60 px-3 py-2">
              <summary class="cursor-pointer text-xs font-medium text-muted-foreground">Расширенные условия</summary>
              <div class="mt-3 space-y-3">
                <div class="space-y-1.5">
                  <Label class="text-xs">Модификаторы</Label>
                  <div class="flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-border/70 p-1">
                    <Button
                      v-for="modifier in (['shift', 'ctrl', 'alt', 'meta', 'mod', 'altGraph', 'exact'] as const)"
                      :key="modifier"
                      type="button"
                      variant="ghost"
                      size="sm"
                      class="h-7 px-2 font-mono text-[11px]"
                      :class="rule.modifiers[modifier] === true ? 'bg-primary/12 text-primary' : rule.modifiers[modifier] === false ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300' : 'text-muted-foreground'"
                      :aria-pressed="rule.modifiers[modifier] === true"
                      @click="toggleModifier(rule, modifier)"
                    >
                      {{ rule.modifiers[modifier] === false ? `!${modifier}` : modifier }}
                    </Button>
                  </div>
                </div>

                <div class="grid gap-3 lg:grid-cols-3">
                  <div class="space-y-1.5">
                    <Label class="text-xs">Удерживаемые code</Label>
                    <Input class="editor-control font-mono text-xs" :model-value="heldCodes(rule)" placeholder="KeyW, KeyE" @change="updateHeldCodes(rule, ($event.target as HTMLInputElement).value)" />
                  </div>
                  <div v-if="rule.held" class="space-y-1.5">
                    <Label class="text-xs">Совпадение held</Label>
                    <div class="flex gap-1">
                      <Select :model-value="rule.held.match" @update:model-value="updateHeldMatch(rule, $event)">
                        <SelectTrigger class="editor-control"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="all">Все</SelectItem><SelectItem value="any">Любая</SelectItem></SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="sm" class="h-9" :class="rule.held.exact ? 'border-primary/50 text-primary' : ''" @click="toggleHeldExact(rule)">exact</Button>
                    </div>
                  </div>
                  <div class="space-y-1.5">
                    <Label class="text-xs">Button</Label>
                    <Input class="editor-control font-mono text-xs" type="number" min="0" max="4" :model-value="rule.button ?? ''" placeholder="Любая" @change="updateButton(rule, ($event.target as HTMLInputElement).value)" />
                  </div>
                </div>

                <TooltipProvider :delay-duration="120">
                  <div class="grid gap-3 sm:grid-cols-2">
                    <div class="space-y-1.5"><Label class="text-xs">Keyboard key</Label><Input class="editor-control font-mono text-xs" :model-value="rule.key.join(', ')" placeholder="Enter, Escape" @change="updateList(rule, 'key', ($event.target as HTMLInputElement).value)" /></div>
                    <div class="space-y-1.5"><Label class="text-xs">Keyboard code</Label><Input class="editor-control font-mono text-xs" :model-value="rule.code.join(', ')" placeholder="Enter, Space" @change="updateList(rule, 'code', ($event.target as HTMLInputElement).value)" /></div>
                    <div class="space-y-1.5">
                      <div class="flex items-center gap-1">
                        <Label class="text-xs">Repeat</Label>
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <button
                              type="button"
                              class="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label="О настройке Repeat"
                            >
                              <CircleHelp class="size-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" class="max-w-80 leading-relaxed">
                            Фильтр по KeyboardEvent.repeat: «Только repeat» — автоповтор при удержании клавиши, «Без repeat» — первое нажатие, «Любое» — без фильтра.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Select :model-value="rule.repeat == null ? 'any' : String(rule.repeat)" @update:model-value="updateNullableBoolean(rule, 'repeat', $event)">
                        <SelectTrigger class="editor-control"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="any">Любое</SelectItem><SelectItem value="true">Только repeat</SelectItem><SelectItem value="false">Без repeat</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div class="space-y-1.5">
                      <div class="flex items-center gap-1">
                        <Label class="text-xs">Composing</Label>
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <button
                              type="button"
                              class="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label="О настройке Composing"
                            >
                              <CircleHelp class="size-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" class="max-w-80 leading-relaxed">
                            Фильтр по KeyboardEvent.isComposing: «IME composing» — событие во время составления текста через IME, «Не composing» — вне этого процесса, «Любое» — без фильтра.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Select :model-value="rule.composing == null ? 'any' : String(rule.composing)" @update:model-value="updateNullableBoolean(rule, 'composing', $event)">
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
                  :class="rule.flags[flag] ? 'border-primary/50 bg-primary/8 text-primary' : 'text-muted-foreground'"
                  :disabled="(flag === 'prevent' && rule.flags.passive) || (flag === 'passive' && rule.flags.prevent)"
                  :aria-pressed="rule.flags[flag] === true"
                  @click="toggleFlag(rule, flag)"
                >
                  {{ flag }}
                </Button>
              </div>
            </div>

            <div class="grid gap-3 md:grid-cols-[minmax(180px,0.55fr)_minmax(260px,1.45fr)]">
              <div class="space-y-1.5">
                <Label class="text-xs">Action</Label>
                <SearchableSelect :options="actionOptions" :model-value="selectedAction(rule)" placeholder="Выбрать Action..." trigger-class="editor-control w-full" @update:model-value="updateAction(rule, $event)" />
              </div>
              <div class="space-y-1.5">
                <Label class="text-xs">Reaction</Label>
                <Textarea v-model="rule.reactionSource" class="editor-control min-h-20 font-mono text-xs" spellcheck="false" @blur="commit" />
                <p class="text-[10px] text-muted-foreground">Можно указать action(), query(), emit(), typescript() или их массив.</p>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  </section>
</template>
