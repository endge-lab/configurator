<script setup lang="ts">
import { Endge } from '@endge/core'
import { useCurrentTimezone } from '@endge/ui-vue'
import { ChevronsUpDown, Clock3 } from 'lucide-vue-next'
import { computed, onScopeDispose, ref } from 'vue'

import { Button } from '@/shared/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'

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
  return Endge.workspace.normalizeTimezone(current.value)
})
const currentLabel = computed(() => Endge.workspace.getTimezoneLabel(currentTimezone.value))
</script>

<template>
  <DropdownMenu :modal="false">
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
        @select="setCurrent(timezone.identity)"
      >
        {{ timezone.displayName || timezone.identity }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
