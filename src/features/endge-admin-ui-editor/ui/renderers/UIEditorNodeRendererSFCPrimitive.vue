<script setup lang="ts">
import type { UIEditorNode } from '@/features/endge-admin-ui-editor/types'
import type { UIComponentDefinition, UIPresentationSurface } from '@endge/core'

import { Check, ChevronDown, Shapes } from 'lucide-vue-next'
import { computed } from 'vue'

import { getUIEditorSFCAttributeBindings, getUIEditorSFCContentPreview } from '@/features/endge-admin-ui-editor/entities/ui-editor-sfc-bindings'
import { getUIEditorSFCDefinitionContract } from '@/features/endge-admin-ui-editor/entities/ui-editor-sfc-contract'

const props = defineProps<{
  node: UIEditorNode<'custom-component'>
  definition: UIComponentDefinition | null
  surface: UIPresentationSurface
  preview?: boolean
}>()

const tag = computed(() => getUIEditorSFCDefinitionContract(props.node.definitionRef)?.tag ?? 'Component')
const bindings = computed(() => getUIEditorSFCAttributeBindings(props.node))

function bindingValue(name: string): unknown {
  const binding = bindings.value.find(candidate => candidate.name === name)
  if (!binding) {
    return undefined
  }
  return binding.resolved ? binding.previewValue : `{{ ${binding.expression} }}`
}

function display(value: unknown): string {
  if (value == null || value === '') {
    return ''
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    }
    catch {
      return String(value)
    }
  }
  return String(value)
}

const value = computed(() => bindingValue('value'))
const placeholder = computed(() => display(bindingValue('placeholder')))
const label = computed(() => display(bindingValue('label')))
const tone = computed(() => display(bindingValue('tone')).toLowerCase())
const iconName = computed(() => display(bindingValue('name') ?? bindingValue('icon')))
const checked = computed(() => bindingValue('checked') === true)
const fieldValue = computed(() => display(value.value) || placeholder.value || tag.value)
const selectValue = computed(() => {
  const selected = value.value
  const options = bindingValue('options')
  if (Array.isArray(options)) {
    const option = options.find((candidate) => {
      return candidate != null
        && typeof candidate === 'object'
        && String((candidate as { value?: unknown }).value) === String(selected ?? '')
    }) as { label?: unknown } | undefined
    if (option?.label != null) {
      return String(option.label)
    }
  }
  return display(selected) || placeholder.value || 'Select'
})
const dateTimeValue = computed(() => {
  if (value.value == null || value.value === '') {
    return '—'
  }
  const date = new Date(String(value.value))
  if (Number.isNaN(date.getTime())) {
    return display(value.value)
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
})
const toneClass = computed(() => {
  switch (tone.value) {
    case 'success':
    case 'positive':
      return 'border-emerald-500/25 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
    case 'warning':
      return 'border-amber-500/25 bg-amber-500/12 text-amber-700 dark:text-amber-300'
    case 'danger':
    case 'destructive':
    case 'error':
      return 'border-red-500/25 bg-red-500/12 text-red-700 dark:text-red-300'
    case 'info':
      return 'border-sky-500/25 bg-sky-500/12 text-sky-700 dark:text-sky-300'
    default:
      return 'border-border/70 bg-muted/55 text-foreground/75'
  }
})
const dotClass = computed(() => {
  switch (tone.value) {
    case 'success':
    case 'positive':
      return 'bg-emerald-500'
    case 'warning':
      return 'bg-amber-500'
    case 'danger':
    case 'destructive':
    case 'error':
      return 'bg-red-500'
    case 'info':
      return 'bg-sky-500'
    default:
      return 'bg-muted-foreground/55'
  }
})
</script>

<template>
  <div v-if="tag === 'Divider'" class="flex min-h-8 w-full items-center px-2">
    <div class="h-px w-full bg-border/80" />
  </div>

  <div v-else-if="tag === 'Dot'" class="flex min-h-8 w-full items-center px-2">
    <span class="size-2 rounded-full" :class="dotClass" />
  </div>

  <div v-else-if="tag === 'Badge'" class="flex min-h-8 w-full items-center px-2 py-1">
    <span
      class="inline-flex max-w-full items-center truncate rounded-md border px-2 py-0.5 text-xs font-medium leading-4"
      :class="toneClass"
    >
      {{ getUIEditorSFCContentPreview(node) || 'Badge' }}
    </span>
  </div>

  <div v-else-if="tag === 'Checkbox'" class="flex min-h-8 w-full items-center gap-2 px-2 text-xs text-foreground">
    <span class="flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border border-border bg-background">
      <Check v-if="checked" class="size-3 text-sky-600 dark:text-sky-400" />
    </span>
    <span class="truncate">{{ label || 'Checkbox' }}</span>
  </div>

  <div v-else-if="tag === 'Select'" class="flex min-h-8 w-full items-center justify-between gap-2 border border-border/75 bg-background/65 px-2 text-xs text-foreground">
    <span class="truncate">{{ selectValue }}</span>
    <ChevronDown class="size-3.5 shrink-0 text-muted-foreground" />
  </div>

  <div v-else-if="tag === 'Input' || tag === 'Textarea'" class="flex min-h-8 w-full items-center border border-border/75 bg-background/65 px-2 text-xs text-foreground">
    <span class="truncate" :class="display(value) ? '' : 'text-muted-foreground'">
      {{ fieldValue }}
    </span>
  </div>

  <div v-else-if="tag === 'Icon'" class="flex min-h-8 w-full items-center gap-1.5 px-2 text-xs text-foreground">
    <Shapes class="size-3.5 shrink-0 text-muted-foreground" />
    <span class="truncate">{{ iconName || 'Icon' }}</span>
  </div>

  <time v-else-if="tag === 'DateTime'" class="flex min-h-8 w-full items-center px-2 text-xs tabular-nums text-foreground">
    {{ dateTimeValue }}
  </time>

  <div v-else-if="tag === 'Number'" class="flex min-h-8 w-full items-center px-2 text-xs tabular-nums text-foreground">
    {{ display(value) || '0' }}
  </div>

  <div v-else class="flex min-h-8 w-full items-center px-2 text-xs text-muted-foreground">
    {{ tag }}
  </div>
</template>
