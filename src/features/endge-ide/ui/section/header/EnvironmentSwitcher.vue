<script setup lang="ts">
import { ChevronsUpDown } from 'lucide-vue-next'
import { useCurrentEnvironment, useDomainStore } from '@endge/vue'
import { computed } from 'vue'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const domainStore = useDomainStore()
const { current: currentEnv, setCurrent: setCurrentEnv } = useCurrentEnvironment()

const environmentLabel = computed(() => {
  const id = currentEnv.value ?? 'dev'
  const e = domainStore.environments.find((x: { identity: string }) => x.identity === id)
  return e?.displayName ?? e?.name ?? id
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
        <span class="font-medium">{{ environmentLabel }}</span>
        <ChevronsUpDown class="size-4 text-muted-foreground" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      class="w-48"
      align="end"
      side="bottom"
      :side-offset="4"
    >
      <DropdownMenuItem
        v-for="e in domainStore.environments"
        :key="e.identity"
        :class="{ 'bg-accent': (currentEnv ?? 'dev') === e.identity }"
        @click="setCurrentEnv(e.identity)"
      >
        {{ e.displayName ?? e.name ?? e.identity }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
