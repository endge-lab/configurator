<script setup lang="ts">
import { Endge } from '@endge/core'
import { useUI } from '@endge/vue'
import { ChevronsUpDown, Palette } from 'lucide-vue-next'
import { computed, onScopeDispose, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const ui = useUI()
const workspaceVersion = ref(0)
const offWorkspace = Endge.workspace.subscribe(() => {
  workspaceVersion.value += 1
})
onScopeDispose(offWorkspace)

const availableThemes = computed(() => {
  workspaceVersion.value
  return Endge.workspace.themes
})
const currentTheme = computed(() => {
  workspaceVersion.value
  return Endge.workspace.normalizeTheme(ui.value.theme)
})
const currentLabel = computed(() => Endge.workspace.getThemeLabel(currentTheme.value))
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="sm" class="gap-2 px-2">
        <Palette class="size-4 text-muted-foreground" />
        <span class="font-medium">{{ currentLabel }}</span>
        <ChevronsUpDown class="size-4 text-muted-foreground" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-44" align="end" side="bottom" :side-offset="4">
      <DropdownMenuItem
        v-for="theme in availableThemes"
        :key="theme.identity"
        :class="{ 'bg-accent': currentTheme === theme.identity }"
        @click="ui.setTheme(theme.identity)"
      >
        {{ theme.displayName || theme.identity }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
