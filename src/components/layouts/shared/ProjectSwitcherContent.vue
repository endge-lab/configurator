<script setup lang="ts">
import { ChevronsUpDown } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCurrentProjectFilter, useDomainStore } from '@endge/ui-vue'
import { computed } from 'vue'

const domainStore = useDomainStore()
const { current: currentProject, setCurrent: setCurrentProject } = useCurrentProjectFilter()

const projectLabel = computed(() => {
  if (!currentProject.value) return 'Все'
  const p = domainStore.projects.find((x: { identity: string }) => x.identity === currentProject.value)
  return p?.displayName ?? p?.name ?? currentProject.value ?? 'Все'
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
        <span class="font-medium">{{ projectLabel }}</span>
        <ChevronsUpDown class="size-4 text-muted-foreground" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      class="w-64 rounded-lg"
      align="start"
      :side-offset="4"
    >
      <DropdownMenuLabel class="text-xs text-muted-foreground">
        Проекты
      </DropdownMenuLabel>
      <DropdownMenuItem
        :class="{ 'bg-accent': !currentProject }"
        class="cursor-pointer"
        @click="setCurrentProject(null)"
      >
        Все
      </DropdownMenuItem>
      <DropdownMenuItem
        v-for="p in domainStore.projects"
        :key="p.identity"
        :class="{ 'bg-accent': currentProject === p.identity }"
        class="cursor-pointer"
        @click="setCurrentProject(p.identity)"
      >
        {{ p.displayName ?? p.name ?? p.identity }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
