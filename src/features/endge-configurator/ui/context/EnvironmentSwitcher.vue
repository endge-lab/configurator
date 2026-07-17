<script setup lang="ts">
import { Endge } from '@endge/core'
import { useDomainStore } from '@endge/vue'
import { ChevronsUpDown } from 'lucide-vue-next'
import { computed } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useConfiguratorContext } from '@/features/endge-configurator/model/use-configurator-context'

const domain = useDomainStore()
const context = useConfiguratorContext()
const current = computed(() => context.currentContext().environmentIdentity ?? Endge.context.getCurrentEnvironment())
const environments = computed(() => {
  const project = Endge.domain.getProject(context.currentContext().projectIdentity ?? Endge.context.getCurrentProject())
  if (!project?.allowedEnvironmentIds.length) return domain.environments
  return domain.environments.filter((item: any) => project.allowedEnvironmentIds.includes(Number(item.id)))
})
const currentLabel = computed(() => {
  const item = domain.environments.find((entry: any) => entry.identity === current.value)
  return item?.displayName ?? item?.name ?? current.value
})

async function select(identity: string): Promise<void> {
  try { await context.switchContext({ environmentIdentity: identity }) }
  catch (error: any) {
    toast.error('Не удалось переключить окружение', { description: String(error?.message ?? error) })
  }
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="sm" class="gap-2 px-2" :disabled="context.isSwitching()">
        <span class="font-medium">{{ currentLabel }}</span>
        <ChevronsUpDown class="size-4 text-muted-foreground" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-48" align="end">
      <DropdownMenuItem v-for="item in environments" :key="item.identity" :class="{ 'bg-accent': current === item.identity }" @click="select(item.identity)">
        {{ item.displayName ?? item.name ?? item.identity }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
