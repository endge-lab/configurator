<script setup lang="ts">
import { Endge } from '@endge/core'
import { useUI } from '@endge/ui-vue'
import { ChevronsUpDown, Palette } from 'lucide-vue-next'
import { computed, onScopeDispose, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const props = defineProps<{ readonly?: boolean, value?: string | null }>()
const readOnly = computed(() => props.readonly || Endge.mode === 'debugger')

const ui = useUI()
const workspaceVersion = ref(0)
const offWorkspace = Endge.workspace.subscribe(() => {
  workspaceVersion.value += 1
})
onScopeDispose(offWorkspace)

const availableThemes = computed(() => {
  void workspaceVersion.value
  return Endge.workspace.themes
})
const currentTheme = computed(() => {
  void workspaceVersion.value
  return props.value !== undefined ? props.value ?? '' : Endge.workspace.normalizeTheme(ui.value.theme)
})
const currentLabel = computed(() => currentTheme.value ? Endge.workspace.getThemeLabel(currentTheme.value) : '')
/** Изменяет тему только в интерактивном представлении. */
function select(theme: string): void {
  if (!readOnly.value) {
    ui.value.setTheme(theme)
  }
}
</script>

<template>
  <Button v-if="readOnly" as="span" variant="ghost" size="sm" class="pointer-events-none gap-2 px-2">
    <Palette class="size-4" />
    <span>{{ currentLabel || '—' }}</span>
  </Button>
  <DropdownMenu v-else :modal="false">
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="sm" class="gap-2 px-2">
        <Palette class="size-4 text-muted-foreground" />
        <span class="font-medium">{{ currentLabel }}</span>
        <ChevronsUpDown class="size-4 text-muted-foreground" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-44" align="end" side="top" :side-offset="4">
      <DropdownMenuItem
        v-for="theme in availableThemes"
        :key="theme.identity"
        :class="{ 'bg-accent': currentTheme === theme.identity }"
        @select="select(theme.identity)"
      >
        {{ theme.displayName || theme.identity }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
