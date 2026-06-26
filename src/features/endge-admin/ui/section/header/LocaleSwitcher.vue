<script setup lang="ts">
import { ChevronsUpDown } from 'lucide-vue-next'
import { useCurrentLocale } from '@endge/vue'
import { computed } from 'vue'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const AVAILABLE_LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
]

const { current, setCurrent } = useCurrentLocale()
const currentLabel = computed(() => {
  const c = current.value ?? 'en'
  return AVAILABLE_LOCALES.find(x => x.code === c)?.label ?? c
})
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="sm"
        class="gap-2 px-2 hover:bg-muted-foreground/10 dark:hover:bg-muted-foreground/20 hover:text-card-foreground"
      >
        <span class="font-medium">{{ currentLabel }}</span>
        <ChevronsUpDown class="size-4 text-muted-foreground" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      class="w-40"
      align="end"
      side="bottom"
      :side-offset="4"
    >
      <DropdownMenuItem
        v-for="loc in AVAILABLE_LOCALES"
        :key="loc.code"
        :class="{ 'bg-accent': (current ?? 'en') === loc.code }"
        @click="setCurrent(loc.code)"
      >
        {{ loc.label }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
