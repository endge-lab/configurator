<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type {
  ComponentSFCExpressionCompletion,
  ComponentSFCExpressionCompletionScope,
} from '@endge/core'
import type { HTMLAttributes } from 'vue'

import { Endge, resolveComponentSFCExpressionCompletions } from '@endge/core'
import { computed, nextTick, ref, useId, watch } from 'vue'

import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const props = defineProps<{
  modelValue: string
  scope: ComponentSFCExpressionCompletionScope
  placeholder?: string
  inputClass?: HTMLAttributes['class']
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

const inputRoot = ref<HTMLElement | null>(null)
const open = ref(false)
const activeIndex = ref(0)
const suggestions = ref<ComponentSFCExpressionCompletion[]>([])
const listboxId = `sfc-expression-completions-${useId().replace(/:/g, '')}`

const activeOptionId = computed(() => open.value && suggestions.value.length
  ? `${listboxId}-option-${activeIndex.value}`
  : undefined)

watch(
  () => props.scope,
  () => refreshSuggestions(),
)

function inputElement(): HTMLInputElement | null {
  return inputRoot.value?.querySelector('input') ?? null
}

function updateValue(value: string | number): void {
  const source = String(value ?? '')
  emit('update:modelValue', source)
  void nextTick(() => refreshSuggestions(source))
}

function refreshSuggestions(source = props.modelValue): void {
  const input = inputElement()
  const cursor = input?.selectionStart ?? source.length
  const next = resolveComponentSFCExpressionCompletions({
    source,
    cursor,
    scope: props.scope,
    context: Endge.context.runtimeSnapshot(),
    configurations: Endge.configurationSchema.list(),
  })
  suggestions.value = next
  activeIndex.value = next.length ? Math.min(activeIndex.value, next.length - 1) : 0
  open.value = next.length > 0
}

function moveActive(delta: number): void {
  if (!suggestions.value.length) {
    return
  }
  activeIndex.value = (activeIndex.value + delta + suggestions.value.length) % suggestions.value.length
  void nextTick(() => document.getElementById(activeOptionId.value ?? '')?.scrollIntoView({ block: 'nearest' }))
}

function applySuggestion(suggestion: ComponentSFCExpressionCompletion): void {
  const source = props.modelValue
  const next = `${source.slice(0, suggestion.replace.start)}${suggestion.insertText}${source.slice(suggestion.replace.end)}`
  const cursor = suggestion.replace.start + suggestion.insertText.length
  suggestions.value = []
  open.value = false
  emit('update:modelValue', next)
  void nextTick(() => {
    const input = inputElement()
    input?.focus()
    input?.setSelectionRange(cursor, cursor)
  })
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    event.stopPropagation()
    open.value = false
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    if (!open.value) {
      refreshSuggestions()
    }
    if (!suggestions.value.length) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    moveActive(event.key === 'ArrowDown' ? 1 : -1)
    return
  }
  if ((event.key === 'Enter' || event.key === 'Tab') && open.value) {
    const suggestion = suggestions.value[activeIndex.value]
    if (!suggestion) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    applySuggestion(suggestion)
  }
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <div ref="inputRoot" class="w-full">
        <Input
          :model-value="modelValue"
          :class="inputClass"
          :placeholder="placeholder"
          role="combobox"
          aria-autocomplete="list"
          :aria-expanded="open"
          :aria-controls="listboxId"
          :aria-activedescendant="activeOptionId"
          autocomplete="off"
          spellcheck="false"
          @update:model-value="updateValue"
          @click="refreshSuggestions()"
          @keydown="onKeydown"
          @blur="open = false"
        />
      </div>
    </PopoverTrigger>

    <PopoverContent
      class="w-[22rem] max-w-[calc(100vw-1rem)] overflow-hidden p-1 shadow-lg"
      align="start"
      side-offset="4"
    >
      <div :id="listboxId" class="max-h-56 overflow-y-auto" role="listbox">
        <button
          v-for="(suggestion, index) in suggestions"
          :id="`${listboxId}-option-${index}`"
          :key="`${suggestion.label}:${suggestion.replace.start}`"
          type="button"
          role="option"
          :aria-selected="index === activeIndex"
          class="flex w-full min-w-0 items-start gap-3 rounded-md px-2 py-1.5 text-left outline-none"
          :class="index === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/70'"
          @mouseenter="activeIndex = index"
          @mousedown.prevent="applySuggestion(suggestion)"
        >
          <code class="min-w-24 shrink-0 pt-0.5 text-xs font-medium text-foreground">{{ suggestion.label }}</code>
          <span class="min-w-0 flex-1 text-[10px] leading-4 text-muted-foreground">
            {{ suggestion.detail }}
          </span>
        </button>
      </div>
      <div class="border-t px-2 pt-1.5 text-[9px] text-muted-foreground">
        ↑↓ выбрать · Enter или Tab вставить · Esc закрыть
      </div>
    </PopoverContent>
  </Popover>
</template>
