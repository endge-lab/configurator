<script setup lang="ts">
import type { RPageTemplatePreviewSchema } from '@endge/core'

import { DomainSectionType } from '@endge/core'
import { computed } from 'vue'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import DomainEntityDropTarget from '@/features/endge-admin/ui/components/DomainEntityDropTarget.vue'

interface PagePreviewBlock {
  key: string
  entityType?: string | null
  entityIdentity?: string | null
  entityId?: string | number | null
  displayName?: string | null
  iconClass?: string | null
}

interface PagePreviewArea {
  slotId: string
  blocks: PagePreviewBlock[]
}

interface AreaLabel {
  identity: string
  title?: string
}

const props = withDefaults(
  defineProps<{
    preview: RPageTemplatePreviewSchema | null
    /** Для подписей ячеек: identity -> title */
    areaLabels?: AreaLabel[] | Record<string, string>
    /** Режим страницы: ячейки - дроп-зоны, показываем блоки */
    pageMode?: boolean
    /** Области страницы (slotId + blocks) для pageMode */
    pageAreas?: PagePreviewArea[]
  }>(),
  { pageMode: false, pageAreas: () => [] },
)

const emit = defineEmits<{
  (e: 'drop', payload: { slotId: string, id: string, sectionType: DomainSectionType }): void
  (e: 'removeBlock', payload: { slotId: string, blockKey: string }): void
}>()

const ROW_HEIGHT_MAP: Record<string, string> = {
  short: 'h-8',
  normal: 'h-12',
  tall: 'h-24',
}

const TOOLTIP_IDENTITY_LABEL = 'identity'
const TOOLTIP_ID_LABEL = 'id'
const MENU_REMOVE_LABEL = 'Удалить'

const labelsByIdentity = computed(() => {
  const out: Record<string, string> = {}
  if (!props.areaLabels)
    return out
  if (Array.isArray(props.areaLabels)) {
    for (const a of props.areaLabels)
      out[a.identity] = a.title ?? a.identity
  }
  else {
    Object.assign(out, props.areaLabels)
  }
  return out
})

const blocksBySlotId = computed(() => {
  const out: Record<string, PagePreviewBlock[]> = {}
  for (const a of props.pageAreas ?? [])
    out[a.slotId] = a.blocks ?? []
  return out
})

const rows = computed(() => props.preview?.rows ?? [])
const rowHeights = computed(() => props.preview?.rowHeights ?? [])

function rowHeightClass(rowIndex: number): string {
  const h = rowHeights.value[rowIndex]
  return ROW_HEIGHT_MAP[h ?? 'normal'] ?? ROW_HEIGHT_MAP.normal
}

function label(slotId: string): string {
  return labelsByIdentity.value[slotId] ?? slotId
}
</script>

<template>
  <!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
  <div
    v-if="rows.length"
    class="template-preview-grid border rounded-lg overflow-hidden bg-muted/30"
  >
    <div
      v-for="(row, rowIdx) in rows"
      :key="rowIdx"
      class="grid w-full gap-px"
      :style="{ gridTemplateColumns: `repeat(${row.length}, 1fr)` }"
    >
      <template v-for="(slotId, colIdx) in row" :key="`${rowIdx}-${colIdx}-${slotId}`">
        <DomainEntityDropTarget
          v-if="pageMode"
          :accept-section-types="[DomainSectionType.Component, DomainSectionType.Filters]"
          :show-hint="false"
          class="min-h-0 flex flex-col p-1.5 bg-background border border-border/50 rounded-sm"
          :class="rowHeightClass(rowIdx)"
          @entity-drop="({ id, sectionType }) => emit('drop', { slotId, id, sectionType })"
        >
          <div class="text-[10px] font-medium text-muted-foreground truncate mb-0.5">
            {{ label(slotId) }}
          </div>
          <div class="flex-1 min-h-0">
            <TooltipProvider :delay-duration="120">
              <div class="flex h-full flex-wrap items-start content-start gap-1.5">
                <DropdownMenu
                  v-for="b in (blocksBySlotId[slotId] ?? [])"
                  :key="b.key"
                >
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <DropdownMenuTrigger as-child>
                        <button
                          type="button"
                          class="inline-flex h-6 w-6 items-center justify-center rounded border border-border bg-muted/40 hover:bg-muted/70"
                        >
                          <i
                            :class="b.iconClass ?? 'ti ti-cube text-primary'"
                            class="text-sm leading-none"
                          />
                        </button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="top" class="text-xs">
                      <div class="font-medium">
                        {{ b.displayName ?? b.entityIdentity ?? b.key }}
                      </div>
                      <div class="text-muted-foreground">
                        {{ TOOLTIP_IDENTITY_LABEL }}: {{ b.entityIdentity ?? '-' }}
                      </div>
                      <div class="text-muted-foreground">
                        {{ TOOLTIP_ID_LABEL }}: {{ b.entityId ?? '-' }}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem
                      class="text-destructive focus:text-destructive"
                      @click="emit('removeBlock', { slotId, blockKey: b.key })"
                    >
                      {{ MENU_REMOVE_LABEL }}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </TooltipProvider>
          </div>
        </DomainEntityDropTarget>
        <div
          v-else
          class="flex flex-col justify-center p-2 bg-background border border-border/50 rounded-sm"
          :class="rowHeightClass(rowIdx)"
        >
          <span class="text-xs font-medium text-muted-foreground truncate">
            {{ label(slotId) }}
          </span>
        </div>
      </template>
    </div>
  </div>
</template>
