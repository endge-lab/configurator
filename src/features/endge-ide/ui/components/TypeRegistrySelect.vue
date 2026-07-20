<script setup lang="ts">
/* eslint-disable style/max-statements-per-line */
import type { HTMLAttributes } from 'vue'

import { useDomainStore } from '@endge/ui-vue'
import { computed } from 'vue'

import { SearchableSelect } from '@/components/ui/searchable-select'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide'

const props = withDefaults(defineProps<{
  modelValue?: string | null
  placeholder?: string
  disabled?: boolean
  size?: 'default' | 'compact'
  triggerClass?: HTMLAttributes['class']
}>(), {
  modelValue: '',
  placeholder: 'Выберите тип',
  disabled: false,
  size: 'default',
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

const domainStore = useDomainStore()
const options = computed(() => domainStore.typeCatalog.map(type => ({
  value: type.identity,
  label: type.displayName || type.identity,
  group: type.category === 'primitive'
    ? 'Primitive types'
    : type.category === 'reference'
      ? 'Entity references'
      : 'User types',
})))

function update(value: string | string[] | null): void {
  emit('update:modelValue', typeof value === 'string' ? value : '')
}

function openType(event: MouseEvent): void {
  if (!event.ctrlKey && !event.metaKey) { return }
  const type = domainStore.typeCatalog.find(item => item.identity === props.modelValue)
  if (!type || type.category !== 'user') { return }
  event.preventDefault()
  event.stopPropagation()
  EndgeIDE.tabs.openSourceReference({
    target: 'type',
    identity: type.identity,
    range: { start: 0, end: 0 },
  })
}
</script>

<template>
  <div class="min-w-0" title="Cmd/Ctrl + click: открыть пользовательский тип" @click.capture="openType">
    <SearchableSelect
      :model-value="modelValue"
      :options="options"
      :placeholder="placeholder"
      :disabled="disabled"
      :size="size"
      :trigger-class="triggerClass"
      @update:model-value="update"
    />
  </div>
</template>
