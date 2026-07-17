<script setup lang="ts">
import { Endge } from '@endge/core'
import { useCurrentLocale } from '@endge/vue'
import { ChevronsUpDown } from 'lucide-vue-next'
import { computed, onScopeDispose, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const { current, setCurrent } = useCurrentLocale()
const version = ref(0)
onScopeDispose(Endge.workspace.subscribe(() => { version.value += 1 }))
const locales = computed(() => { void version.value; return Endge.workspace.locales })
const currentCode = computed(() => { void version.value; return Endge.workspace.normalizeLocale(current.value) })
const currentLabel = computed(() => {
  const locale = locales.value.find(item => item.code === currentCode.value)
  return String(locale?.displayName || locale?.shortLabel || currentCode.value)
})
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="sm" class="gap-2 px-2">
        <span class="font-medium">{{ currentLabel }}</span>
        <ChevronsUpDown class="size-4 text-muted-foreground" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-40" align="end">
      <DropdownMenuItem v-for="locale in locales" :key="locale.code" :class="{ 'bg-accent': currentCode === locale.code }" @click="setCurrent(locale.code)">
        {{ locale.displayName || locale.shortLabel || locale.code }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
