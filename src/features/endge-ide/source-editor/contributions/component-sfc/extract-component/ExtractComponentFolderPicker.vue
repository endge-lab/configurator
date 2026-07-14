<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { ExtractComponentFolderOption } from './extract-component.types'

import { Check, ChevronsUpDown, Folder, FolderRoot } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const props = defineProps<{
  modelValue: string | null
  options: ExtractComponentFolderOption[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const open = ref(false)
const query = ref('')

const selected = computed(() => props.options.find(option => option.id === props.modelValue) ?? null)
const filteredOptions = computed(() => {
  const normalized = query.value.trim().toLocaleLowerCase('ru')
  if (!normalized) {
    return props.options
  }
  return props.options.filter(option => option.path.toLocaleLowerCase('ru').includes(normalized))
})

watch(open, (value) => {
  if (!value) {
    query.value = ''
  }
})

function select(value: string | null): void {
  emit('update:modelValue', value)
  open.value = false
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        role="combobox"
        :aria-expanded="open"
        class="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-sm shadow-xs outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50"
        @click="open = !open"
      >
        <span class="flex min-w-0 items-center gap-2">
          <FolderRoot v-if="!selected" class="size-4 shrink-0 text-violet-500" />
          <Folder v-else class="size-4 shrink-0 text-amber-500" />
          <span class="truncate">{{ selected?.path ?? 'Корень компонентов' }}</span>
        </span>
        <ChevronsUpDown class="size-3.5 shrink-0 text-muted-foreground" />
      </button>
    </PopoverTrigger>

    <PopoverContent class="w-[320px] overflow-hidden p-0" align="start" side-offset="5">
      <div class="border-b p-2">
        <Input v-model="query" class="h-8 text-xs" placeholder="Поиск папки..." @keydown.stop />
      </div>

      <div class="max-h-[280px] overflow-y-auto p-1.5" role="listbox">
        <button
          type="button"
          role="option"
          :aria-selected="modelValue === null"
          class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
          @click="select(null)"
        >
          <span class="flex size-4 items-center justify-center">
            <Check v-if="modelValue === null" class="size-3.5 text-primary" />
          </span>
          <FolderRoot class="size-4 text-violet-500" />
          <span>Корень компонентов</span>
        </button>

        <button
          v-for="option in filteredOptions"
          :key="option.id"
          type="button"
          role="option"
          :aria-selected="modelValue === option.id"
          class="flex w-full items-center gap-2 rounded-sm py-1.5 pr-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
          :style="{ paddingLeft: `${8 + option.depth * 14}px` }"
          @click="select(option.id)"
        >
          <span class="flex size-4 shrink-0 items-center justify-center">
            <Check v-if="modelValue === option.id" class="size-3.5 text-primary" />
          </span>
          <Folder class="size-4 shrink-0 text-amber-500" />
          <span class="min-w-0 truncate" :title="option.path">{{ query ? option.path : option.name }}</span>
        </button>

        <div v-if="query && !filteredOptions.length" class="px-4 py-6 text-center text-xs text-muted-foreground">
          Папки не найдены
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
