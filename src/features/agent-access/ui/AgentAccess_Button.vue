<script setup lang="ts">
import { Bot } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { Configurator } from '@/app/Configurator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import AgentAccess_Dialog from '@/features/agent-access/ui/AgentAccess_Dialog.vue'

defineProps<{
  documentationUrl?: string
}>()

const { t } = useI18n()
const dialog = ref<InstanceType<typeof AgentAccess_Dialog> | null>(null)
const available = computed(() =>
  Configurator.session.state.status === 'authenticated' && Configurator.context.hasActiveWorkspace,
)
</script>

<template>
  <template v-if="available">
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger as-child>
          <button
            type="button"
            class="inline-flex size-8 items-center justify-center rounded-md border border-transparent bg-transparent text-muted-foreground transition-colors hover:border-border hover:bg-accent hover:text-foreground"
            :aria-label="t('agentAccess.button')"
            @click="dialog?.open()"
          >
            <Bot class="size-4 text-fuchsia-500" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{{ t('agentAccess.button') }}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
    <AgentAccess_Dialog ref="dialog" :documentation-url="documentationUrl" />
  </template>
</template>
