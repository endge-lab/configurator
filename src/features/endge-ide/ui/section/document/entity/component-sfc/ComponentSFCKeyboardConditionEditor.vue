<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type {
  ComponentSFCInteractionKeyboardCondition,
  ComponentSFCInteractionTriggerHeldKeys,
  ComponentSFCInteractionTriggerModifiers,
} from '@endge/core'

import { Check, CircleDot, RotateCcw, X } from 'lucide-vue-next'
import { nextTick, onBeforeUnmount, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const props = defineProps<{
  modelValue?: ComponentSFCInteractionKeyboardCondition | null
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ComponentSFCInteractionKeyboardCondition | null]
}>()

type PhysicalModifier = 'shift' | 'ctrl' | 'alt' | 'meta' | 'altGraph'

interface RecordedKeyboardCondition {
  modifiers: ComponentSFCInteractionTriggerModifiers
  held: ComponentSFCInteractionTriggerHeldKeys | null
}

const modifierOptions = [
  ['shift', 'Shift'],
  ['ctrl', 'Ctrl'],
  ['alt', 'Alt'],
  ['meta', 'Meta'],
  ['mod', 'Ctrl/Cmd'],
  ['altGraph', 'AltGr'],
  ['exact', 'exact'],
] as const

const modifierKeys = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph'])
const recording = ref(false)
const recorded = ref<RecordedKeyboardCondition | null>(null)
const liveModifiers = ref<Partial<Record<PhysicalModifier, boolean>>>({})
const liveKeys = new Map<string, string>()
const liveCodes = ref<string[]>([])
let recordingSurface: HTMLElement | null = null

onBeforeUnmount(cancelRecording)

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

function publish(value: ComponentSFCInteractionKeyboardCondition): void {
  const next = cloneCondition(value)
  if (!next.modifiers || !Object.keys(next.modifiers).length) {
    delete next.modifiers
  }
  if (!next.held || !(next.held.key?.length || next.held.code?.length)) {
    delete next.held
  }
  emit('update:modelValue', Object.keys(next).length ? next : null)
}

function toggleModifier(name: keyof ComponentSFCInteractionTriggerModifiers): void {
  const next = cloneCondition(props.modelValue)
  next.modifiers ??= {}
  const current = next.modifiers[name]
  next.modifiers[name] = current == null ? true : current ? false : undefined
  if (next.modifiers[name] === undefined) {
    delete next.modifiers[name]
  }
  publish(next)
}

function updateHeldList(field: 'key' | 'code', raw: string): void {
  const next = cloneCondition(props.modelValue)
  const values = splitList(raw)
  const other = field === 'key' ? next.held?.code ?? [] : next.held?.key ?? []
  if (!values.length && !other.length) {
    delete next.held
  }
  else {
    next.held = {
      ...next.held,
      key: field === 'key' ? values : next.held?.key ?? [],
      code: field === 'code' ? values : next.held?.code ?? [],
      match: next.held?.match ?? 'all',
      exact: next.held?.exact ?? false,
    }
  }
  publish(next)
}

function updateHeldMatch(value: unknown): void {
  if (!props.modelValue?.held) {
    return
  }
  const next = cloneCondition(props.modelValue)
  next.held!.match = value === 'any' ? 'any' : 'all'
  publish(next)
}

function toggleHeldExact(): void {
  if (!props.modelValue?.held) {
    return
  }
  const next = cloneCondition(props.modelValue)
  next.held!.exact = !next.held!.exact
  publish(next)
}

function startRecording(): void {
  cancelRecording()
  recording.value = true
  void nextTick(() => recordingSurface?.focus())
}

function retryRecording(): void {
  recorded.value = null
  clearLiveState()
  void nextTick(() => recordingSurface?.focus())
}

function cancelRecording(): void {
  recording.value = false
  recorded.value = null
  recordingSurface = null
  clearLiveState()
}

function setRecordingSurface(element: unknown): void {
  recordingSurface = element instanceof HTMLElement ? element : null
}

function handleKeyDown(event: KeyboardEvent): void {
  if (!recording.value || recorded.value) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  updateLiveModifiers(event)
  if (!modifierKeys.has(event.key)) {
    const key = event.key.toLowerCase()
    liveKeys.set(event.code || `key:${key}`, key)
    liveCodes.value = [...liveKeys.keys()].filter(code => !code.startsWith('key:'))
  }
}

function handleKeyUp(event: KeyboardEvent): void {
  if (!recording.value || recorded.value) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  captureLiveCondition()
}

function captureLiveCondition(): void {
  const modifiers: ComponentSFCInteractionTriggerModifiers = { exact: true }
  for (const name of ['shift', 'ctrl', 'alt', 'meta', 'altGraph'] as const) {
    if (liveModifiers.value[name]) {
      modifiers[name] = true
    }
  }
  const key = [...new Set(liveKeys.values())]
  const code = [...new Set(liveCodes.value)]
  recorded.value = {
    modifiers,
    held: key.length || code.length
      ? { key, code, match: 'all', exact: true }
      : null,
  }
}

function updateLiveModifiers(event: KeyboardEvent): void {
  liveModifiers.value = {
    shift: event.shiftKey || undefined,
    ctrl: event.ctrlKey || undefined,
    alt: event.altKey || undefined,
    meta: event.metaKey || undefined,
    altGraph: event.getModifierState('AltGraph') || undefined,
  }
}

function canUsePortableMod(): boolean {
  return recorded.value?.modifiers.ctrl === true || recorded.value?.modifiers.meta === true
}

function usePortableMod(): void {
  if (!recorded.value) {
    return
  }
  delete recorded.value.modifiers.ctrl
  delete recorded.value.modifiers.meta
  recorded.value.modifiers.mod = true
}

function applyRecordedCondition(): void {
  if (!recorded.value) {
    return
  }
  publish({
    modifiers: { ...recorded.value.modifiers },
    ...(recorded.value.held ? { held: { ...recorded.value.held } } : {}),
  })
  cancelRecording()
}

function clearLiveState(): void {
  liveKeys.clear()
  liveCodes.value = []
  liveModifiers.value = {}
}

function conditionTokens(condition: {
  modifiers?: ComponentSFCInteractionTriggerModifiers
  held?: ComponentSFCInteractionTriggerHeldKeys | null
} | null | undefined): string[] {
  return uniqueTokens([
    ...modifierTokens(condition?.modifiers),
    ...(condition?.held?.code?.length
      ? condition.held.code.map(displayCode)
      : condition?.held?.key ?? []),
  ])
}

function recordingTokens(): string[] {
  if (recorded.value) {
    return conditionTokens(recorded.value)
  }
  return uniqueTokens([
    ...modifierTokens(liveModifiers.value),
    ...liveCodes.value.map(displayCode),
  ])
}

function modifierTokens(modifiers: Partial<Record<keyof ComponentSFCInteractionTriggerModifiers, boolean>> | undefined): string[] {
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

function uniqueTokens(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function splitList(value: string): string[] {
  return [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))]
}
</script>

<template>
  <div class="space-y-3">
    <div class="editor-control flex min-h-9 items-center gap-2 rounded-md border border-border/70 p-1 pl-2">
      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        <span v-if="!conditionTokens(modelValue).length" class="text-xs text-muted-foreground">Без условий</span>
        <code v-for="token in conditionTokens(modelValue)" :key="token" class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground">
          {{ token }}
        </code>
      </div>
      <Button type="button" variant="outline" size="sm" class="h-7 shrink-0 gap-1.5 px-2 text-[11px]" :disabled="disabled" @click="startRecording">
        <CircleDot class="size-3.5" />
        {{ conditionTokens(modelValue).length ? 'Перезаписать' : 'Записать' }}
      </Button>
    </div>

    <div
      v-if="recording"
      :ref="setRecordingSurface"
      class="rounded-lg border border-primary/45 bg-primary/5 p-3 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      tabindex="0"
      role="application"
      aria-label="Запись состояния клавиатуры"
      @keydown.capture="handleKeyDown"
      @keyup.capture="handleKeyUp"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2 text-xs font-semibold">
            <span class="relative flex size-2">
              <span v-if="!recorded" class="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-60" />
              <span class="relative inline-flex size-2 rounded-full" :class="recorded ? 'bg-primary' : 'bg-destructive'" />
            </span>
            {{ recorded ? 'Комбинация записана' : 'Идёт запись' }}
          </div>
          <p class="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {{ recorded ? 'Проверьте условие и примените его.' : 'Зажмите нужные клавиши и отпустите любую из них.' }}
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" class="size-7 text-muted-foreground" aria-label="Отменить запись" @click.stop="cancelRecording">
          <X class="size-3.5" />
        </Button>
      </div>

      <div class="mt-3 flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-border/60 bg-background/45 px-3 py-2">
        <span v-if="!recordingTokens().length" class="text-xs text-muted-foreground">Ожидаю комбинацию…</span>
        <code v-for="token in recordingTokens()" :key="token" class="rounded-md border border-border/60 bg-background px-2 py-1 text-xs font-semibold shadow-xs">
          {{ token }}
        </code>
      </div>

      <div v-if="recorded" class="mt-3 flex justify-end gap-2">
        <Button v-if="canUsePortableMod()" type="button" variant="outline" size="sm" class="mr-auto h-8 font-mono text-[11px]" @click.stop="usePortableMod">
          Использовать Ctrl/Cmd
        </Button>
        <Button type="button" variant="ghost" size="sm" class="h-8 gap-1.5" @click.stop="retryRecording">
          <RotateCcw class="size-3.5" />
          Ещё раз
        </Button>
        <Button type="button" size="sm" class="h-8 gap-1.5" @click.stop="applyRecordedCondition">
          <Check class="size-3.5" />
          Применить
        </Button>
      </div>
    </div>

    <div class="space-y-1.5">
      <Label class="text-xs">Модификаторы</Label>
      <div class="flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-border/70 p-1">
        <Button
          v-for="([name, label]) in modifierOptions"
          :key="name"
          type="button"
          variant="ghost"
          size="sm"
          class="h-7 px-2 font-mono text-[11px]"
          :class="modelValue?.modifiers?.[name] === true ? 'bg-primary/12 text-primary' : modelValue?.modifiers?.[name] === false ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300' : 'text-muted-foreground'"
          :aria-pressed="modelValue?.modifiers?.[name] === true"
          :disabled="disabled"
          @click="toggleModifier(name)"
        >
          {{ modelValue?.modifiers?.[name] === false ? `!${label}` : label }}
        </Button>
      </div>
    </div>

    <div class="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
      <div class="space-y-1.5">
        <Label class="text-xs">Удерживаемые code</Label>
        <Input class="editor-control font-mono text-xs" :disabled="disabled" :model-value="modelValue?.held?.code?.join(', ') ?? ''" placeholder="KeyW, KeyE" @change="updateHeldList('code', ($event.target as HTMLInputElement).value)" />
      </div>
      <div class="space-y-1.5">
        <Label class="text-xs">Удерживаемые key</Label>
        <Input class="editor-control font-mono text-xs" :disabled="disabled" :model-value="modelValue?.held?.key?.join(', ') ?? ''" placeholder="w, e" @change="updateHeldList('key', ($event.target as HTMLInputElement).value)" />
      </div>
      <div v-if="modelValue?.held" class="space-y-1.5">
        <Label class="text-xs">Совпадение</Label>
        <div class="flex gap-1">
          <Select :model-value="modelValue.held.match ?? 'all'" :disabled="disabled" @update:model-value="updateHeldMatch">
            <SelectTrigger class="editor-control min-w-24"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Все</SelectItem><SelectItem value="any">Любая</SelectItem></SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" class="h-9" :class="modelValue.held.exact ? 'border-primary/50 text-primary' : ''" :disabled="disabled" @click="toggleHeldExact">exact</Button>
        </div>
      </div>
    </div>
  </div>
</template>
