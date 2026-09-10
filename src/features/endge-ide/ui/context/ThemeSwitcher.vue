<script setup lang="ts">
import { Endge } from '@endge/core'
import { useCurrentTheme } from '@endge/ui-vue'
import { ChevronsUpDown, Palette } from 'lucide-vue-next'
import { computed, onScopeDispose, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const props = defineProps<{ readonly?: boolean, value?: string | null }>()
const readOnly = computed(() => props.readonly === true)
const pending = ref(false)

const { current, setCurrent } = useCurrentTheme()
const workspaceVersion = ref(0)
const offWorkspace = Endge.workspace.subscribe(() => {
  workspaceVersion.value += 1
})
onScopeDispose(offWorkspace)

const availableThemes = computed(() => {
  void workspaceVersion.value
  return Endge.workspace.isLoaded ? Endge.workspace.themes : []
})
const currentTheme = computed(() => {
  void workspaceVersion.value
  if (!Endge.workspace.isLoaded) {
    return ''
  }
  return props.value !== undefined ? props.value ?? '' : Endge.workspace.normalizeTheme(current.value)
})
const currentLabel = computed(() => currentTheme.value ? Endge.workspace.getThemeLabel(currentTheme.value) : '')
/** Изменяет тему только в интерактивном представлении. */
async function select(theme: string): Promise<void> {
  if (readOnly.value || pending.value) {
    return
  }
  pending.value = true
  try {
    await setCurrent(theme)
  }
  catch (error) {
    toast.error('Не удалось изменить контекст', { description: error instanceof Error ? error.message : String(error) })
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <Button v-if="readOnly" as="span" variant="ghost" size="sm" class="pointer-events-none gap-2 px-2">
    <Palette class="size-4" />
    <span>{{ currentLabel || '—' }}</span>
  </Button>
  <DropdownMenu v-else :modal="false">
    <DropdownMenuTrigger as-child :disabled="pending">
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
