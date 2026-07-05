<script setup lang="ts">
import type { Component } from 'vue'

import { ArrowRight, ChevronLeft, ChevronRight, Code2, Play, StepForward, Wand2 } from 'lucide-vue-next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface PaletteBlock {
  id: string
  title: string
  description: string
  variant: string
}

interface PaletteSection {
  title: string
  items: PaletteBlock[]
}

interface VariantBadgeMeta {
  icon: Component
  className: string
}

defineProps<{
  isCollapsed: boolean
  sections: PaletteSection[]
  canRunSelectedNode: boolean
  canRunNextNode: boolean
  getVariantBadgeMeta: (variant: string) => VariantBadgeMeta
}>()

const emit = defineEmits<{
  toggleCollapsed: []
  runWholeFlow: []
  runSelectedNode: []
  runNextNode: []
  autoLayout: []
  showPayload: []
  paletteDragStart: [event: DragEvent, block: PaletteBlock]
}>()

function onPaletteDragStart(event: DragEvent, block: PaletteBlock): void {
  emit('paletteDragStart', event, block)
}
</script>

<template>
  <!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
  <div
    class="flex h-full min-h-0 flex-col gap-4 w-full"
    :class="{ 'w-[72px] min-w-[72px] max-w-[72px] xl:ml-auto': isCollapsed }"
  >
    <Card class="flex h-full min-h-[720px] flex-1 flex-col gap-0 overflow-hidden py-6">
      <CardHeader class="shrink-0 border-b" :class="isCollapsed ? 'px-2 py-2' : ''">
        <TooltipProvider :delay-duration="120">
          <div
            class="flex gap-2"
            :class="isCollapsed ? 'flex-col items-center' : 'items-center'"
          >
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  class="action-playgrounds-palette__toggle-button shrink-0"
                  @click="emit('toggleCollapsed')"
                >
                  <ChevronLeft v-if="!isCollapsed" class="size-4" />
                  <ChevronRight v-else class="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {{ isCollapsed ? 'Развернуть палитру' : 'Свернуть палитру' }}
              </TooltipContent>
            </Tooltip>

            <div v-if="!isCollapsed" class="h-6 w-px bg-border/70" />

            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  @click="emit('runWholeFlow')"
                >
                  <Play class="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                Выполнить действие
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  :disabled="!canRunSelectedNode"
                  @click="emit('runSelectedNode')"
                >
                  <StepForward class="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                Выполнить выбранный блок
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  :disabled="!canRunNextNode"
                  @click="emit('runNextNode')"
                >
                  <ArrowRight class="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                Перейти к следующему шагу и выполнить его
              </TooltipContent>
            </Tooltip>

            <div v-if="!isCollapsed" class="h-6 w-px bg-border/70" />

            <template v-if="!isCollapsed">
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    @click="emit('autoLayout')"
                  >
                    <Wand2 class="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  Автовыравнивание диаграммы
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    @click="emit('showPayload')"
                  >
                    <Code2 class="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  Показать payload flow
                </TooltipContent>
              </Tooltip>
            </template>
          </div>
        </TooltipProvider>
      </CardHeader>

      <CardContent :class="isCollapsed ? 'min-h-0 flex-1 p-2' : 'min-h-0 flex-1'">
        <ScrollArea class="h-full min-h-0" :class="{ 'pr-3': !isCollapsed }">
          <div :class="isCollapsed ? 'space-y-3' : 'space-y-4'">
            <section
              v-for="(section, sectionIndex) in sections"
              :key="section.title"
              :class="[
                isCollapsed ? 'space-y-2' : 'space-y-3',
                sectionIndex === 0 ? 'pt-4' : '',
              ]"
            >
              <div v-if="!isCollapsed" class="flex items-center justify-between gap-3">
                <div class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {{ section.title }}
                </div>
                <Badge variant="outline">
                  {{ section.items.length }}
                </Badge>
              </div>

              <div :class="isCollapsed ? 'flex flex-col items-center gap-2' : 'space-y-3'">
                <TooltipProvider
                  v-for="block in section.items"
                  :key="block.id"
                  :delay-duration="120"
                >
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <div
                        class="action-playgrounds-palette-item"
                        :class="{ 'action-playgrounds-palette-item--collapsed': isCollapsed }"
                        draggable="true"
                        @dragstart="onPaletteDragStart($event, block)"
                      >
                        <div
                          class="action-playgrounds-palette-item__icon"
                          :class="getVariantBadgeMeta(block.variant).className"
                        >
                          <component
                            :is="getVariantBadgeMeta(block.variant).icon"
                            class="size-3.5"
                          />
                        </div>
                        <div v-if="!isCollapsed" class="action-playgrounds-palette-item__title">
                          {{ block.title }}
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="left" class="max-w-xs">
                      <div class="space-y-1">
                        <div class="font-medium">
                          {{ block.title }}
                        </div>
                        <div v-if="block.description">
                          {{ block.description }}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </section>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  </div>
  <!-- eslint-enable @intlify/vue-i18n/no-raw-text -->
</template>

<style scoped>
.action-playgrounds-palette-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.94);
  padding: 0 14px;
  cursor: grab;
}

.action-playgrounds-palette-item--collapsed {
  justify-content: center;
  width: 52px;
  min-height: 52px;
  padding: 0;
  border-radius: 18px;
}

.action-playgrounds-palette-item__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
}

.action-playgrounds-node__variant-badge--entry {
  background: rgba(224, 242, 254, 1);
  color: #0369a1;
}

.action-playgrounds-node__variant-badge--action {
  background: rgba(219, 234, 254, 1);
  color: #1d4ed8;
}

.action-playgrounds-node__variant-badge--runtime {
  background: rgba(224, 231, 255, 1);
  color: #4338ca;
}

.action-playgrounds-node__variant-badge--switch {
  background: rgba(254, 243, 199, 1);
  color: #b45309;
}

.action-playgrounds-node__variant-badge--watch {
  background: rgba(254, 249, 195, 1);
  color: #a16207;
}

.action-playgrounds-node__variant-badge--event-subscribe {
  background: rgba(219, 234, 254, 1);
  color: #1d4ed8;
}

.action-playgrounds-node__variant-badge--delay {
  background: rgba(254, 242, 242, 1);
  color: #dc2626;
}

.action-playgrounds-node__variant-badge--timer {
  background: rgba(254, 242, 242, 1);
  color: #dc2626;
}

.action-playgrounds-node__variant-badge--interval-timer {
  background: rgba(237, 233, 254, 1);
  color: #7c3aed;
}

.action-playgrounds-node__variant-badge--for-each,
.action-playgrounds-node__variant-badge--while {
  background: rgba(209, 250, 229, 1);
  color: #047857;
}

.action-playgrounds-node__variant-badge--parallel {
  background: rgba(224, 231, 255, 1);
  color: #4338ca;
}

.action-playgrounds-palette-item__title {
  color: #0f172a;
  font-size: 13px;
  font-weight: 600;
}

.action-playgrounds-palette__toggle-button {
  border-color: rgba(14, 165, 233, 0.28);
  background: linear-gradient(180deg, rgba(240, 249, 255, 0.98), rgba(224, 242, 254, 0.96));
  color: #0369a1;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.action-playgrounds-palette__toggle-button:hover {
  border-color: rgba(2, 132, 199, 0.38);
  background: linear-gradient(180deg, rgba(224, 242, 254, 0.98), rgba(186, 230, 253, 0.96));
  color: #075985;
}
</style>
