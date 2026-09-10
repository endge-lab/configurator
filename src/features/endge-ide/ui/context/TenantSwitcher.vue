<script setup lang="ts">
import { Endge } from '@endge/core'
import { useDomainStore } from '@endge/ui-vue'
import { Building2, ChevronsUpDown, Loader2 } from 'lucide-vue-next'
import { computed } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useEndgeIDEContext } from '@/features/endge-ide/services/context/use-endge-ide-context'

const props = defineProps<{ readonly?: boolean, value?: string | null }>()
const readOnly = computed(() => props.readonly || Endge.mode === 'debugger')

const domain = useDomainStore()
const context = useEndgeIDEContext()
const current = computed(() => props.value !== undefined ? props.value : context.currentContext().tenantIdentity ?? Endge.context.getCurrentTenant())
const currentLabel = computed(() => domain.tenants.find((item: any) => item.identity === current.value)?.displayName ?? current.value)
const disabled = computed(() => context.isSwitching() || Endge.context.isTenantLockedBySession)

async function select(identity: string): Promise<void> {
  if (readOnly.value) {
    return
  }
  try {
    await context.switchContext({ tenantIdentity: identity })
  }
  catch (error: any) {
    toast.error('Не удалось переключить тенант', { description: String(error?.message ?? error) })
  }
}
</script>

<template>
  <Button v-if="readOnly" as="span" variant="ghost" size="sm" class="pointer-events-none gap-2 px-2">
    <Building2 class="size-4" />
    <span>{{ currentLabel || '—' }}</span>
  </Button>
  <DropdownMenu v-else :modal="false">
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="sm" class="gap-2" :disabled="disabled" :title="Endge.context.isTenantLockedBySession ? 'Тенант задан сессией' : 'Выбрать тенант'">
        <Loader2 v-if="context.isSwitching()" class="size-4 animate-spin" /><Building2 v-else class="size-4" />
        <span>{{ currentLabel }}</span><ChevronsUpDown class="size-4 text-muted-foreground" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-56" align="start" side="top">
      <DropdownMenuItem v-for="tenant in domain.tenants" :key="tenant.identity" :class="{ 'bg-accent': tenant.identity === current }" @select="select(tenant.identity)">
        {{ tenant.displayName ?? tenant.name ?? tenant.identity }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
