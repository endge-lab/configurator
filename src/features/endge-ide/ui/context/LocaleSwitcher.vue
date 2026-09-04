<script setup lang="ts">
import { Endge } from '@endge/core'
import { useCurrentLocale } from '@endge/ui-vue'
import { ChevronsUpDown } from 'lucide-vue-next'
import { computed, onScopeDispose, ref } from 'vue'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const { current, setCurrent } = useCurrentLocale()
const workspaceVersion = ref(0)
const offWorkspace = Endge.workspace.subscribe(() => {
  workspaceVersion.value += 1
})
onScopeDispose(offWorkspace)

const availableLocales = computed(() => {
  void workspaceVersion.value
  return Endge.workspace.locales
})
const currentLabel = computed(() => {
  void workspaceVersion.value
  const c = Endge.workspace.normalizeLocale(current.value)
  return getLocaleDisplayLabel(c)
})

function getLocaleDisplayLabel(localeCode: string): string {
  const locale = Endge.workspace.locales.find(item => item.code === localeCode)
  return String(locale?.displayName || locale?.shortLabel || localeCode)
}
</script>

<template>
  <DropdownMenu :modal="false">
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
      side="top"
      :side-offset="4"
    >
      <DropdownMenuItem
        v-for="loc in availableLocales"
        :key="loc.code"
        :class="{ 'bg-accent': Endge.workspace.normalizeLocale(current) === loc.code }"
        @select="setCurrent(loc.code)"
      >
        {{ getLocaleDisplayLabel(loc.code) }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
