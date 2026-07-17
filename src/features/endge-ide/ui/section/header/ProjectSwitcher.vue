<script setup lang="ts">
import { Endge } from '@endge/core'
import { useDomainStore } from '@endge/vue'
import { Briefcase, ChevronsUpDown, Loader2 } from 'lucide-vue-next'
import { computed } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useConfiguratorContext } from '@/features/endge-configurator/model/use-configurator-context'

const domain = useDomainStore()
const context = useConfiguratorContext()
const current = computed(() => Endge.context.getCurrentProject())
const currentLabel = computed(() => domain.projects.find((item: any) => item.identity === current.value)?.displayName ?? current.value)

async function select(identity: string): Promise<void> {
  try {
    const project = domain.projects.find((item: any) => item.identity === identity)
    const allowed = Array.isArray(project?.allowedEnvironmentIds) ? project.allowedEnvironmentIds.map(Number) : []
    const currentEnvironment = domain.environments.find((item: any) => item.identity === Endge.context.getCurrentEnvironment())
    const currentEnvironmentAllowed = allowed.length === 0 || allowed.includes(Number(currentEnvironment?.id))
    const fallbackEnvironment = !currentEnvironmentAllowed
      ? domain.environments.find((item: any) => allowed.includes(Number(item.id)))
      : null

    if (!currentEnvironmentAllowed && !fallbackEnvironment)
      throw new Error('У проекта нет доступного окружения')

    await context.switchContext({
      projectIdentity: identity,
      ...(fallbackEnvironment ? { environmentIdentity: fallbackEnvironment.identity } : {}),
    })
  }
  catch (error: any) {
    toast.error('Не удалось переключить проект', { description: String(error?.message ?? error) })
  }
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child><Button variant="ghost" size="sm" class="gap-2" :disabled="context.isSwitching()">
      <Loader2 v-if="context.isSwitching()" class="size-4 animate-spin" /><Briefcase v-else class="size-4" />
      <span>{{ currentLabel }}</span><ChevronsUpDown class="size-4 text-muted-foreground" />
    </Button></DropdownMenuTrigger>
    <DropdownMenuContent class="w-64" align="start">
      <DropdownMenuItem v-for="project in domain.projects" :key="project.identity" :class="{ 'bg-accent': project.identity === current }" @click="select(project.identity)">{{ project.displayName ?? project.name ?? project.identity }}</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
