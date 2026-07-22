<script setup lang="ts">
import { Endge } from '@endge/core'
import { useDomainStore } from '@endge/ui-vue'
import { Briefcase, ChevronsUpDown, Loader2 } from 'lucide-vue-next'
import { computed } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useEndgeIDEContext } from '@/features/endge-ide/model/context/use-endge-ide-context'

const domain = useDomainStore()
const context = useEndgeIDEContext()
const current = computed(() => context.currentContext().projectIdentity ?? Endge.context.getCurrentProject())
const currentLabel = computed(() => domain.projects.find((item: any) => item.identity === current.value)?.displayName ?? current.value)

async function select(identity: string): Promise<void> {
  try {
    await context.switchContext({ projectIdentity: identity })
  }
  catch (error: any) {
    toast.error('Не удалось переключить проект', { description: String(error?.message ?? error) })
  }
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="sm" class="gap-2" :disabled="context.isSwitching()">
        <Loader2 v-if="context.isSwitching()" class="size-4 animate-spin" /><Briefcase v-else class="size-4" />
        <span>{{ currentLabel }}</span><ChevronsUpDown class="size-4 text-muted-foreground" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-64" align="start">
      <DropdownMenuItem v-for="project in domain.projects" :key="project.identity" :class="{ 'bg-accent': project.identity === current }" @select="select(project.identity)">
        {{ project.displayName ?? project.name ?? project.identity }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
