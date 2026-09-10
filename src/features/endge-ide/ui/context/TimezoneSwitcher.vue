<script setup lang="ts">
import { Endge } from '@endge/core'
import { useCurrentTimezone } from '@endge/ui-vue'
import { ChevronsUpDown, Clock3 } from 'lucide-vue-next'
import { computed, onScopeDispose, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const props = defineProps<{ readonly?: boolean, value?: string | null }>()
const readOnly = computed(() => props.readonly || Endge.mode === 'debugger')

const { current, setCurrent } = useCurrentTimezone()
const workspaceVersion = ref(0)
const offWorkspace = Endge.workspace.subscribe(() => {
  workspaceVersion.value += 1
})
onScopeDispose(offWorkspace)

const availableTimezones = computed(() => {
  void workspaceVersion.value
  return Endge.workspace.timezones
})
const currentTimezone = computed(() => {
  void workspaceVersion.value
  return props.value !== undefined ? props.value ?? '' : Endge.workspace.normalizeTimezone(current.value)
})
const currentLabel = computed(() => currentTimezone.value ? Endge.workspace.getTimezoneLabel(currentTimezone.value) : '')
/** Изменяет временную зону только в интерактивном представлении. */
function select(timezone: string): void {
  if (!readOnly.value) {
    setCurrent(timezone)
  }
}
</script>

<template>
  <Button v-if="readOnly" as="span" variant="ghost" size="sm" class="pointer-events-none gap-2 px-2">
    <Clock3 class="size-4" />
    <span>{{ currentLabel || '—' }}</span>
  </Button>
  <DropdownMenu v-else :modal="false">
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="sm" class="gap-2 px-2">
        <Clock3 class="size-4 text-muted-foreground" />
        <span class="font-medium">{{ currentLabel }}</span>
        <ChevronsUpDown class="size-4 text-muted-foreground" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-52" align="end" side="top" :side-offset="4">
      <DropdownMenuItem
        v-for="timezone in availableTimezones"
        :key="timezone.identity"
        :class="{ 'bg-accent': currentTimezone === timezone.identity }"
        @select="select(timezone.identity)"
      >
        {{ timezone.displayName || timezone.identity }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
