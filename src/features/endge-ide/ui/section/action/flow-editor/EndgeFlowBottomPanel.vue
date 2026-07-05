<script setup lang="ts">
import { Box, GitBranch } from 'lucide-vue-next'
import { computed } from 'vue'

import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const props = defineProps<{
  modelValue: 'block' | 'context'
  hasSelectedBlock: boolean
  selectedStepLabel: string
  height: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: 'block' | 'context']
}>()

const model = computed({
  get: () => props.modelValue,
  set: (value: 'block' | 'context') => emit('update:modelValue', value),
})

const headerText = computed(() => {
  if (model.value === 'context')
    return 'Контекст выполнения'

  if (props.hasSelectedBlock && props.selectedStepLabel.trim())
    return props.selectedStepLabel.trim()

  return 'Текущий блок'
})
</script>

<template>
  <!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
  <div
    class="action-playgrounds-bottom-panel"
    :style="{ height: `${height}px` }"
  >
    <Tabs
      v-model="model"
      class="action-playgrounds-bottom-panel__tabs flex min-h-0 flex-1 flex-col gap-0"
    >
      <div class="action-playgrounds-bottom-panel__header">
        <div class="action-playgrounds-bottom-panel__header-main">
          <div class="action-playgrounds-bottom-panel__title">
            {{ headerText }}
          </div>
        </div>

        <div
          v-if="$slots['header-actions']"
          class="action-playgrounds-bottom-panel__header-actions"
        >
          <slot name="header-actions" />
        </div>

        <TooltipProvider :delay-duration="120">
          <TabsList class="action-playgrounds-bottom-panel__tabs-list bg-transparent p-0">
            <Tooltip>
              <TooltipTrigger as-child>
                <TabsTrigger
                  value="block"
                  class="action-playgrounds-bottom-panel__tab-trigger bg-slate-100/90 text-slate-600 hover:bg-slate-200/80 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 data-[state=active]:border-blue-300"
                >
                  <Box class="size-4" />
                  <span class="sr-only">Текущий блок</span>
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Текущий блок
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <TabsTrigger
                  value="context"
                  class="action-playgrounds-bottom-panel__tab-trigger bg-slate-100/90 text-slate-600 hover:bg-slate-200/80 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 data-[state=active]:border-blue-300"
                >
                  <GitBranch class="size-4" />
                  <span class="sr-only">Контекст</span>
                </TabsTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Контекст
              </TooltipContent>
            </Tooltip>
          </TabsList>
        </TooltipProvider>
      </div>

      <TabsContent
        value="block"
        class="m-0 min-h-0 h-full flex-1 flex-col overflow-hidden data-[state=active]:flex data-[state=inactive]:hidden"
      >
        <ScrollArea class="h-full min-h-0 flex-1">
          <div class="flex h-full min-h-full flex-col gap-3 p-4">
            <slot name="block" />
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent
        value="context"
        class="m-0 min-h-0 h-full flex-1 flex-col overflow-hidden data-[state=active]:flex data-[state=inactive]:hidden"
      >
        <ScrollArea class="h-full min-h-0 flex-1">
          <div class="flex h-full min-h-full flex-col gap-3 p-4">
            <slot name="context" />
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  </div>
  <!-- eslint-enable @intlify/vue-i18n/no-raw-text -->
</template>

<style scoped>
.action-playgrounds-bottom-panel {
  display: grid;
  grid-template-rows: auto 1fr;
  flex: 0 0 auto;
  min-height: 140px;
  overflow: hidden;
  border-top: 1px solid rgba(226, 232, 240, 0.96);
  background: rgba(255, 255, 255, 0.98);
}

.action-playgrounds-bottom-panel__tabs {
  min-height: 0;
  height: 100%;
}

.action-playgrounds-bottom-panel__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(226, 232, 240, 0.96);
  padding: 14px 16px 10px;
}

.action-playgrounds-bottom-panel__header-main {
  min-width: 0;
}

.action-playgrounds-bottom-panel__header-actions {
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-playgrounds-bottom-panel__tabs-list {
  display: inline-flex;
  width: auto;
  min-width: auto;
  gap: 8px;
  padding: 0;
  background: transparent;
  border: none;
  box-shadow: none;
  justify-self: end;
}

.action-playgrounds-bottom-panel__tab-trigger {
  width: 40px;
  min-width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid rgba(203, 213, 225, 0.9);
  border-radius: 12px;
  transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease;
}

.action-playgrounds-bottom-panel__tab-trigger[data-state='active'] {
  background: rgba(219, 234, 254, 0.95);
  border-color: rgba(147, 197, 253, 0.95);
  color: #1d4ed8;
}

.action-playgrounds-bottom-panel__title {
  color: #0f172a;
  font-size: 13px;
  font-weight: 700;
}

.action-playgrounds-bottom-panel__subtitle {
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
}
</style>
