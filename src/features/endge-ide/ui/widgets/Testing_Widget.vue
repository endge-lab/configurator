<script setup lang="ts">
import { ScriptType } from '@endge/core'
import { computed } from 'vue'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import { useTestingStore } from '@/features/endge-ide/store/testing.ts'

const testingStore = useTestingStore()
const tabs = EndgeIDE.tabs

/** Тестирование доступно, когда активна вкладка сценария. */
const isScenarioActive = computed(() => {
  const tab = tabs.activeTab.value
  const payload = tab?.payload as { documentType?: string } | undefined
  return payload?.documentType === ScriptType.ScenarioSetup
})

const options = testingStore.options
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="shrink-0 px-3 py-2 border-b">
      <h3 class="text-sm font-semibold">Тестирование</h3>
      <p class="text-xs text-muted-foreground mt-0.5">
        Параметры для сценариев
      </p>
    </div>
    <ScrollArea class="flex-1">
      <div class="p-4 flex flex-col gap-6">
        <template v-if="isScenarioActive">
          <div class="space-y-2">
            <Label for="generator-count">Генератор (кол-во элементов)</Label>
            <Input
              id="generator-count"
              v-model.number="options.generatorCount"
              type="number"
              min="0"
              class="w-full"
            />
          </div>
          <div class="space-y-2">
            <Label for="ups-count">Поток обновлений (кол-во в секунду)</Label>
            <div class="flex gap-2 items-center">
              <Input
                id="ups-count"
                v-model.number="options.updatesPerSeconds"
                type="number"
                min="0"
                class="flex-1"
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      v-if="!testingStore.isUPSRunning"
                      size="icon"
                      variant="outline"
                      class="shrink-0"
                      @click="testingStore.toggleUpdates"
                    >
                      <i class="ti ti-player-play text-lg" />
                    </Button>
                    <Button
                      v-else
                      size="icon"
                      variant="destructive"
                      class="shrink-0"
                      @click="testingStore.toggleUpdates"
                    >
                      <i class="ti ti-player-stop text-lg" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {{ testingStore.isUPSRunning ? 'Остановить' : 'Запустить' }} тестовый поток обновлений
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </template>
        <p v-else class="text-sm text-muted-foreground">
          Тестирование доступно только при открытом документе типа «Сценарий».
        </p>
      </div>
    </ScrollArea>
  </div>
</template>
