<script setup lang="ts">
import { ChevronsUpDown } from 'lucide-vue-next'
import { Endge } from '@endge/core'
import { useCurrentLocale } from '@endge/vue'
import { computed } from 'vue'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const { current, setCurrent } = useCurrentLocale()
const availableLocales = computed(() => Endge.workspace.locales)
const currentLabel = computed(() => {
  const c = Endge.workspace.normalizeLocale(current.value)
  return Endge.workspace.getLocaleLabel(c, 'nativeLabel')
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
        v-for="loc in availableLocales"
        :key="loc.code"
        :class="{ 'bg-accent': Endge.workspace.normalizeLocale(current) === loc.code }"
        @click="setCurrent(loc.code)"
      >
        {{ loc.nativeLabel }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
