<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { computed, ref, watch } from 'vue'

import { Check, ChevronDown } from 'lucide-vue-next'

import { cn } from '@/lib/utils.ts'

import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export interface SearchableSelectOption {
  value: string
  label: string
}

const props = withDefaults(
  defineProps<{
    options: SearchableSelectOption[]
    modelValue?: string | string[] | null
    multiple?: boolean
    placeholder?: string
    triggerClass?: HTMLAttributes['class']
    contentMaxHeight?: string
    size?: 'default' | 'compact'
    disabled?: boolean
    /** Первая опция «Все» (например { value: '*', label: 'Все' }) - только при multiple */
    allOption?: SearchableSelectOption | null
  }>(),
  {
    placeholder: 'Выберите',
    contentMaxHeight: 'min(320px, 60vh)',
    size: 'default',
    disabled: false,
    allOption: null,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | string[] | null): void
}>()

const open = ref(false)
const searchQuery = ref('')

watch(open, (v) => {
  if (!v) searchQuery.value = ''
})

const filteredOptions = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return props.options
  return props.options.filter(o => o.label.toLowerCase().includes(q))
})

const optionsToShow = computed(() => {
  if (props.multiple && props.allOption) {
    return [props.allOption, ...filteredOptions.value]
  }
  return filteredOptions.value
})

const selectedSet = computed(() => {
  const v = props.modelValue
  if (Array.isArray(v)) return new Set(v.map(String))
  if (v != null && v !== '') return new Set([String(v)])
  return new Set<string>()
})

const triggerLabel = computed(() => {
  const v = props.modelValue
  if (Array.isArray(v)) {
    if (!v.length) return props.placeholder
    if (v.length === 1 && v[0] === '*') return props.allOption?.label ?? '*'
    if (v.length === 1) {
      const o = props.options.find(op => op.value === v[0])
      return o?.label ?? v[0]
    }
    return `Выбрано: ${v.length}`
  }
  if (v != null && v !== '') {
    const o = props.options.find(op => op.value === String(v))
    return o?.label ?? String(v)
  }
  return props.placeholder
})

function isSelected(value: string): boolean {
  return selectedSet.value.has(value)
}

function toggleOption(value: string): void {
  if (props.multiple) {
    const set = new Set(selectedSet.value)
    if (props.allOption && value !== props.allOption.value) {
      set.delete(props.allOption.value)
    }
    if (set.has(value)) {
      set.delete(value)
    }
    else {
      set.add(value)
    }
    emit('update:modelValue', set.size ? [...set] : null)
  }
  else {
    emit('update:modelValue', value)
    open.value = false
  }
}

function onAllOptionClick(): void {
  if (!props.multiple || !props.allOption) return
  emit('update:modelValue', [props.allOption.value])
  open.value = false
}

const triggerCls = computed(() =>
  cn(
    'border-input text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
    props.size === 'compact' ? 'h-8' : 'h-9',
    props.triggerClass,
  ),
)
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        :class="triggerCls"
        role="combobox"
        :aria-expanded="open"
        :disabled="disabled"
        @click="open = !open"
      >
        <span class="truncate">{{ triggerLabel }}</span>
        <ChevronDown class="size-4 opacity-50 shrink-0" />
      </button>
    </PopoverTrigger>
    <PopoverContent
      class="min-w-[12rem] p-0"
      align="start"
      side-offset="4"
    >
      <div class="border-b p-1.5">
        <Input
          v-model="searchQuery"
          placeholder="Поиск..."
          class="h-8 text-sm"
          @keydown.stop
        />
      </div>
      <div
        class="overflow-y-auto overflow-x-hidden p-1"
        :style="{ maxHeight: contentMaxHeight }"
      >
        <ul
          class="flex flex-col gap-0.5"
          role="listbox"
        >
          <li
            v-for="opt in optionsToShow"
            :key="opt.value"
            role="option"
            :aria-selected="isSelected(opt.value)"
            class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
            @click="multiple && allOption && opt.value === allOption.value ? onAllOptionClick() : toggleOption(opt.value)"
          >
            <span class="flex size-4 items-center justify-center">
              <Check
                v-if="isSelected(opt.value)"
                class="size-4 text-primary"
              />
              <span v-else class="size-4" />
            </span>
            {{ opt.label }}
          </li>
          <li
            v-if="!optionsToShow.length"
            class="px-2 py-3 text-center text-sm text-muted-foreground"
          >
            Ничего не найдено
          </li>
        </ul>
      </div>
    </PopoverContent>
  </Popover>
</template>
