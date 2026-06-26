<script setup lang="ts">
import type { LogNode } from '@endge/core'

import { ComponentType, Endge } from '@endge/core'
import { useDomainStore } from '@endge/vue'
import { computed, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EndgeAdmin } from '@/features/endge-admin/model/core/endge-admin.ts'
import { useDebugStore } from '@/features/endge-admin/store/debug.ts'
import LogTree from '@/features/endge-admin/ui/components/LogTree.vue'

const debugStore = useDebugStore()
const domainStore = useDomainStore()
const tabs = EndgeAdmin.tabs

const activeTab = ref<'logs' | 'errors'>('logs')
const logTreeRef = ref<InstanceType<typeof LogTree>>()
const isAnalyzing = ref(false)

const expandAll = (): void => logTreeRef.value?.expandAll()
const collapseAll = (): void => logTreeRef.value?.collapseAll()

const errorsByComponent = computed(() =>
  domainStore.components
    .map((component: any) => ({
      componentId: component.id,
      componentName: component.name ?? component.id,
      errors: component.validationErrors ?? [],
    }))
    .filter((x: { errors: unknown[] }) => x.errors.length > 0),
)

async function runProjectAnalysis(): Promise<void> {
  isAnalyzing.value = true
  try {
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        Endge.domain.compile()
        resolve()
      }, 100)
    })
  }
  finally {
    isAnalyzing.value = false
  }
}

function openComponentTab(componentId: string, label: string): void {
  tabs.openDocument(componentId, ComponentType.DSL)
}

function formatNodeMessage(n: LogNode): string {
  switch (n.kind) {
    case 'span': {
      const dur
        = typeof n.durMs === 'number'
          ? ` (${n.durMs} ms)`
          : n.endTs
            ? ` (${(n.endTs - n.ts)} ms)`
            : ''
      return `${n.name ?? 'span'}${dur}`
    }
    case 'event':
      return n.msg || n.name || 'event'
    default:
      return n.name ?? n.kind
  }
}
</script>

<template>
  <div class="flex flex-col h-full">
    <Tabs v-model="activeTab" class="flex flex-col flex-1 min-h-0">
      <div class="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b">
        <TabsList class="grid grid-cols-2">
          <TabsTrigger value="logs">
            Логирование
          </TabsTrigger>
          <TabsTrigger value="errors">
            Ошибки
          </TabsTrigger>
        </TabsList>
        <div class="flex items-center gap-1 shrink-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button size="icon" variant="ghost" class="size-8" @click="expandAll">
                  <i class="ti ti-arrow-bar-down text-base" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Развернуть все</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button size="icon" variant="ghost" class="size-8" @click="collapseAll">
                  <i class="ti ti-arrow-bar-up text-base" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Свернуть все</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  size="icon"
                  variant="ghost"
                  class="size-8 text-green-600 hover:text-green-700"
                  :disabled="isAnalyzing"
                  @click="runProjectAnalysis"
                >
                  <i class="ti ti-player-play text-base" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Запустить анализ проекта</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <TabsContent value="logs" class="flex-1 mt-0 min-h-0 overflow-hidden data-[state=inactive]:hidden">
        <ScrollArea class="h-full">
          <div class="p-3">
            <h3 class="text-xs font-bold mb-2 text-muted-foreground">
              Журнал выполнения
            </h3>
            <LogTree
              ref="logTreeRef"
              :nodes="debugStore.nodes"
              :row-message="formatNodeMessage"
            />
            <Button
              variant="ghost"
              size="sm"
              class="mt-2 text-xs text-muted-foreground hover:text-foreground"
              @click="debugStore.clear"
            >
              очистить
            </Button>
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="errors" class="flex-1 mt-0 min-h-0 overflow-hidden data-[state=inactive]:hidden">
        <ScrollArea class="h-full">
          <div class="p-3">
            <h3 class="text-xs font-bold mb-2 text-muted-foreground">
              Анализ проекта
            </h3>
            <p v-if="isAnalyzing" class="text-xs text-muted-foreground">
              Идёт анализ проекта...
            </p>
            <div v-else class="space-y-2">
              <details
                v-for="(item, index) in errorsByComponent"
                :key="index"
                class="border border-border rounded-md bg-muted/30"
              >
                <summary
                  class="cursor-pointer flex items-center justify-between px-2 py-1.5 font-semibold text-xs hover:bg-muted transition-colors rounded-t-md"
                >
                  <span>{{ item.componentName }} ({{ item.errors.length }})</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-auto py-0.5 text-xs"
                    @click.stop="openComponentTab(item.componentId, item.componentName)"
                  >
                    открыть
                  </Button>
                </summary>
                <ul class="pl-4 py-1 text-xs text-destructive list-disc">
                  <li v-for="(error, idx) in item.errors" :key="idx">
                    {{ error }}
                  </li>
                </ul>
              </details>
              <p v-if="!errorsByComponent.length" class="text-xs text-muted-foreground">
                Нет ошибок
              </p>
            </div>
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  </div>
</template>
