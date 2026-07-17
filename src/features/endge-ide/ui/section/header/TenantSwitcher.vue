<script setup lang="ts">
import { Endge } from '@endge/core'
import { useDomainStore } from '@endge/vue'
import { Building2, ChevronsUpDown, Loader2 } from 'lucide-vue-next'
import { computed } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useConfiguratorContext } from '@/features/endge-configurator/model/use-configurator-context'

const domain = useDomainStore()
const context = useConfiguratorContext()
const current = computed(() => Endge.context.getCurrentTenant())
const currentLabel = computed(() => domain.tenants.find((item: any) => item.identity === current.value)?.displayName ?? current.value)
const disabled = computed(() => context.isSwitching() || Endge.context.isTenantLockedBySession)

async function select(identity: string): Promise<void> {
  try {
    await context.switchContext({ tenantIdentity: identity })
  }
  catch (error: any) {
    toast.error('Не удалось переключить тенант', { description: String(error?.message ?? error) })
  }
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child><Button variant="ghost" size="sm" class="gap-2" :disabled="disabled" :title="Endge.context.isTenantLockedBySession ? 'Тенант задан сессией' : 'Выбрать тенант'">
      <Loader2 v-if="context.isSwitching()" class="size-4 animate-spin" /><Building2 v-else class="size-4" />
      <span>{{ currentLabel }}</span><ChevronsUpDown class="size-4 text-muted-foreground" />
    </Button></DropdownMenuTrigger>
    <DropdownMenuContent class="w-56" align="start">
      <DropdownMenuItem v-for="tenant in domain.tenants" :key="tenant.identity" :class="{ 'bg-accent': tenant.identity === current }" @click="select(tenant.identity)">{{ tenant.displayName ?? tenant.name ?? tenant.identity }}</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
