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

const props = defineProps<{ readonly?: boolean, value?: string | null }>()
const readOnly = computed(() => props.readonly || Endge.mode === 'debugger')

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
  const c = props.value !== undefined ? props.value ?? '' : Endge.workspace.normalizeLocale(current.value)
  return getLocaleDisplayLabel(c)
})

function getLocaleDisplayLabel(localeCode: string): string {
  if (!localeCode) {
    return ''
  }
  const locale = Endge.workspace.locales.find(item => item.code === localeCode)
  return String(locale?.displayName || locale?.shortLabel || localeCode)
}
/** Изменяет локаль только в интерактивном представлении. */
function select(locale: string): void {
  if (!readOnly.value) {
    setCurrent(locale)
  }
}
</script>

<template>
  <Button v-if="readOnly" as="span" variant="ghost" size="sm" class="pointer-events-none gap-2 px-2">
    <span>{{ currentLabel || '—' }}</span>
  </Button>
  <DropdownMenu v-else :modal="false">
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
        @select="select(loc.code)"
      >
        {{ getLocaleDisplayLabel(loc.code) }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
