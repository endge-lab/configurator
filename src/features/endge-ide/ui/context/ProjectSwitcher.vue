<script setup lang="ts">
import { Endge } from '@endge/core'
import { useDomainStore } from '@endge/ui-vue'
import { Briefcase, ChevronsUpDown, Loader2 } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useEndgeIDEContext } from '@/features/endge-ide/services/context/use-endge-ide-context'

const props = defineProps<{ readonly?: boolean, value?: string | null }>()
const readOnly = computed(() => props.readonly === true)
const pending = ref(false)

const domain = useDomainStore()
const context = useEndgeIDEContext()
const current = computed(() => props.value !== undefined ? props.value : context.currentContext().projectIdentity)
const currentLabel = computed(() => domain.projects.find((item: any) => item.identity === current.value)?.displayName ?? current.value)

async function select(identity: string): Promise<void> {
  if (readOnly.value || pending.value) {
    return
  }
  pending.value = true
  try {
    await Endge.commands.execute({ type: 'context:set-project', payload: { project: identity } })
  }
  catch (error: any) {
    toast.error('Не удалось переключить проект', { description: String(error?.message ?? error) })
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <Button v-if="readOnly" as="span" variant="ghost" size="sm" class="pointer-events-none gap-2 px-2">
    <Briefcase class="size-4" />
    <span>{{ currentLabel || '—' }}</span>
  </Button>
  <DropdownMenu v-else :modal="false">
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="sm" class="gap-2" :disabled="pending || context.isSwitching()">
        <Loader2 v-if="context.isSwitching()" class="size-4 animate-spin" /><Briefcase v-else class="size-4" />
        <span>{{ currentLabel }}</span><ChevronsUpDown class="size-4 text-muted-foreground" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-64" align="start" side="top">
      <DropdownMenuItem v-for="project in domain.projects" :key="project.identity" :class="{ 'bg-accent': project.identity === current }" @select="select(project.identity)">
        {{ project.displayName ?? project.name ?? project.identity }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
