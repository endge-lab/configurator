<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type Option = {
  value: string
  label?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  modelValue: string[]
  options: Option[]
  placeholder?: string
  disabled?: boolean
  searchable?: boolean
  searchPlaceholder?: string
  maxChips?: number
}>(), {
  placeholder: 'Выберите ...',
  disabled: false,
  searchable: true,
  searchPlaceholder: 'Поиск ...',
  maxChips: 3,
})

const emit = defineEmits<{
  (e: 'update:modelValue', v: string[]): void
}>()

const q = ref<string>('')

const optionsByValue = computed(() => {
  const m = new Map<string, Option>()
  for (const o of props.options) m.set(String(o.value), o)
  return m
})

const selected = computed<string[]>({
  get: () => Array.isArray(props.modelValue) ? props.modelValue : [],
  set: v => emit('update:modelValue', v),
})

const selectedSet = computed(() => new Set(selected.value.map(String)))

const filteredOptions = computed(() => {
  const list = Array.isArray(props.options) ? props.options : []
  const query = q.value.trim().toLowerCase()

  if (!props.searchable || !query) return list

  return list.filter((o) => {
    const v = String(o.value ?? '').toLowerCase()
    const l = String(o.label ?? '').toLowerCase()
    return v.includes(query) || l.includes(query)
  })
})

function toggleValue(v: string) {
  if (props.disabled) return

  const value = String(v)
  const set = new Set(selected.value.map(String))

  if (set.has(value)) set.delete(value)
  else set.add(value)

  selected.value = Array.from(set)
}

function clearAll() {
  if (props.disabled) return
  selected.value = []
}

function removeOne(v: string) {
  if (props.disabled) return
  selected.value = selected.value.filter(x => String(x) !== String(v))
}

const chips = computed(() => {
  const list = selected.value.map((v) => {
    const opt = optionsByValue.value.get(String(v))
    return {
      value: String(v),
      label: String(opt?.label ?? v),
      disabled: Boolean(opt?.disabled),
    }
  })
  return list
})

const chipsVisible = computed(() => chips.value.slice(0, props.maxChips))
const chipsHiddenCount = computed(() => Math.max(0, chips.value.length - chipsVisible.value.length))

watch(
  () => props.options,
  () => {
    // нормализуем: если options поменялись и выбранное больше не существует - вычищаем
    const allowed = new Set((props.options ?? []).map(o => String(o.value)))
    const next = selected.value.filter(v => allowed.has(String(v)))
    if (next.length !== selected.value.length) selected.value = next
  },
  { deep: true },
)
</script>

<template>
  <Popover>
    <PopoverTrigger>
      <button
        type="button"
        class="h-10 w-full rounded-md border px-3 flex items-center gap-2 bg-background text-left"
        :class="disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'"
        :disabled="disabled"
      >
        <template v-if="chips.length">
          <div class="flex items-center gap-1 flex-wrap min-w-0">
            <span
              v-for="c in chipsVisible"
              :key="c.value"
              class="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs max-w-[140px]"
              title="Удалить"
            >
              <span class="truncate">{{ c.label }}</span>
              <span
                class="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded hover:bg-muted-foreground/10"
                @click.stop="removeOne(c.value)"
              >
                ×
              </span>
            </span>

            <span
              v-if="chipsHiddenCount"
              class="text-xs text-muted-foreground"
            >
              +{{ chipsHiddenCount }}
            </span>
          </div>
        </template>

        <span v-else class="text-sm text-muted-foreground">
          {{ placeholder }}
        </span>

        <span class="ml-auto text-muted-foreground text-xs">▼</span>
      </button>
    </PopoverTrigger>

    <PopoverContent class="p-2">
      <div class="w-full">
        <div v-if="searchable" class="mb-2">
          <input
            v-model="q"
            class="h-9 w-full rounded-md border px-3 text-sm"
            :placeholder="searchPlaceholder"
            :disabled="disabled"
          >
        </div>

        <div class="max-h-[260px] overflow-auto pr-1">
          <div v-if="!filteredOptions.length" class="px-2 py-3 text-sm text-muted-foreground">
            Ничего не найдено
          </div>

          <label
            v-for="opt in filteredOptions"
            :key="String(opt.value)"
            class="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted cursor-pointer select-none"
            :class="(opt.disabled || disabled) ? 'opacity-60 cursor-not-allowed' : ''"
          >
            <input
              type="checkbox"
              class="h-4 w-4"
              :disabled="disabled || opt.disabled"
              :checked="selectedSet.has(String(opt.value))"
              @change="toggleValue(String(opt.value))"
              @click.stop
            >
            <span class="min-w-0 truncate">
              {{ opt.label ?? opt.value }}
            </span>
            <span class="ml-auto text-xs text-muted-foreground">
              {{ opt.value }}
            </span>
          </label>
        </div>

        <div class="mt-2 flex items-center justify-between gap-2">
          <div class="text-xs text-muted-foreground">
            Выбрано: {{ chips.length }}
          </div>

          <button
            type="button"
            class="h-8 rounded-md border px-2 text-xs hover:bg-muted"
            :disabled="disabled || !chips.length"
            @click="clearAll"
          >
            Очистить
          </button>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
