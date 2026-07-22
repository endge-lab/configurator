<script setup lang="ts">
import { Endge } from '@endge/core'
import { useDomainStore } from '@endge/ui-vue'
import { ChevronsUpDown } from 'lucide-vue-next'
import { computed } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useEndgeIDEContext } from '@/features/endge-ide/model/context/use-endge-ide-context'

const domainStore = useDomainStore()
const context = useEndgeIDEContext()
const currentEnv = computed(() => context.currentContext().environmentIdentity ?? Endge.context.getCurrentEnvironment())
const environments = computed(() => {
  const projectIdentity = context.currentContext().projectIdentity ?? Endge.context.getCurrentProject()
  const project = Endge.domain.getProject(projectIdentity)
  if (!project?.allowedEnvironmentIds.length) {
    return domainStore.environments
  }
  return domainStore.environments.filter((item: any) => project.allowedEnvironmentIds.includes(Number(item.id)))
})

const environmentLabel = computed(() => {
  const id = currentEnv.value
  const e = domainStore.environments.find((x: { identity: string }) => x.identity === id)
  return e?.displayName ?? e?.name ?? id
})

async function select(identity: string): Promise<void> {
  try {
    await context.switchContext({ environmentIdentity: identity })
  }
  catch (error: any) {
    toast.error('Не удалось переключить окружение', { description: String(error?.message ?? error) })
  }
}
</script>

<template>
  <DropdownMenu :modal="false">
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="sm"
        :disabled="context.isSwitching()"
        class="gap-2 px-2 hover:bg-muted-foreground/10 dark:hover:bg-muted-foreground/20 hover:text-card-foreground"
      >
        <span class="font-medium">{{ environmentLabel }}</span>
        <ChevronsUpDown class="size-4 text-muted-foreground" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      class="w-48"
      align="end"
      side="top"
      :side-offset="4"
    >
      <DropdownMenuItem
        v-for="e in environments"
        :key="e.identity"
        :class="{ 'bg-accent': currentEnv === e.identity }"
        @select="select(e.identity)"
      >
        {{ e.displayName ?? e.name ?? e.identity }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
