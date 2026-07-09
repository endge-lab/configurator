<script setup lang="ts">
import type { WidgetDefinition, WidgetDefinitionState, WidgetInstance, WidgetPosition } from '@/components/layouts/grid/types.ts'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getIconComponent } from '@/components/layouts/grid/icons.ts'
import { endWidgetDrag, getLayoutState, getPopupInstances, getWidgetInstances, getWidgetOrder, moveWidget, reorderWidget, restorePopupInstance, startWidgetDrag, toggleWidget } from '@/components/layouts/grid/layout.ts'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'

const props = defineProps<{
  position: 'left' | 'right'
  widgets: (WidgetDefinition & WidgetDefinitionState)[]
  bottomWidgets: (WidgetDefinition & WidgetDefinitionState)[]
}>()

const { t } = useI18n()

const { widgets: widgetsState, isDraggingWidget, draggingWidgetId } = getLayoutState()

interface PopupWidgetGroup {
  definition: WidgetDefinition & WidgetDefinitionState
  instances: { instance: WidgetInstance, isMinimized: boolean, isOpen: boolean }[]
}

const popupWidgetGroups = computed(() => {
  if (props.position !== 'right')
    return []

  const popupInstances = getPopupInstances()
  const groups = new Map<string, PopupWidgetGroup>()

  popupInstances.forEach(({ instance, definition, isMinimized, isOpen }) => {
    if (!groups.has(definition.id)) {
      groups.set(definition.id, { definition, instances: [] })
    }
    groups.get(definition.id)!.instances.push({ instance, isMinimized, isOpen })
  })

  return Array.from(groups.values())
})

const draggingWidgetDefinition = computed(() => {
  if (!draggingWidgetId.value)
    return null
  return widgetsState.value.definitions[draggingWidgetId.value] ?? null
})

function canDropToPosition(targetPosition: WidgetPosition): boolean {
  if (!isDraggingWidget.value || !draggingWidgetDefinition.value)
    return false
  const allowed = draggingWidgetDefinition.value.allowedPositions
  if (!allowed)
    return true
  return allowed.includes(targetPosition)
}

function sortByOrder(widgets: (WidgetDefinition & WidgetDefinitionState)[], position: WidgetPosition) {
  const order = getWidgetOrder(position)
  return [...widgets].sort((a, b) => {
    const aIndex = order.indexOf(a.id)
    const bIndex = order.indexOf(b.id)
    if (aIndex === -1 && bIndex === -1)
      return 0
    if (aIndex === -1)
      return 1
    if (bIndex === -1)
      return -1
    return aIndex - bIndex
  })
}

const topWidgets = computed(() =>
  sortByOrder(
    props.widgets.filter(w => getWidgetInstances(w.id).length > 0),
    props.position,
  ),
)

const workspaceSettingsActive = computed(() => EndgeIDE.tabs.activeTabId.value === 'workspace-settings')

const bottomWidgetsFiltered = computed(() =>
  sortByOrder(
    props.bottomWidgets.filter(w => getWidgetInstances(w.id).length > 0),
    props.position === 'left' ? 'bottom' : 'floating',
  ),
)

function isActive(widget: WidgetDefinition & WidgetDefinitionState): boolean {
  if (widget.position === 'floating') {
    const floatingState = widgetsState.value.areas.floating.states[widget.id]
    return floatingState ? !floatingState.minimized : false
  }
  const area = widgetsState.value.areas[widget.position as 'left' | 'right' | 'bottom']
  if (!area)
    return false
  return area.activeWidget === widget.id && area.expanded
}

function handleWidgetClick(widget: WidgetDefinition & WidgetDefinitionState) {
  toggleWidget(widget.id)
}

function openWorkspaceSettings() {
  EndgeIDE.tabs.openWorkspaceSettings()
}

function handlePopupWidgetClick(group: PopupWidgetGroup) {
  if (group.instances.length === 1 && group.instances[0]) {
    restorePopupInstance(group.instances[0].instance.id)
  }
}

function handlePopupInstanceClick(instanceId: string) {
  restorePopupInstance(instanceId)
}

function isPopupActive(group: PopupWidgetGroup): boolean {
  return group.instances.some(i => i.isOpen && !i.isMinimized)
}

function handleDragStart(event: DragEvent, widget: WidgetDefinition & WidgetDefinitionState) {
  if (event.dataTransfer) {
    event.dataTransfer.setData('widget-id', widget.id)
    event.dataTransfer.effectAllowed = 'move'
  }
  startWidgetDrag(widget.id)
}

function handleDragEnd() {
  endWidgetDrag()
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function handleDrop(event: DragEvent, targetPosition: WidgetPosition) {
  event.preventDefault()
  event.stopPropagation()
  const widgetId = event.dataTransfer?.getData('widget-id')
  if (widgetId) {
    moveWidget(widgetId, targetPosition)
    endWidgetDrag()
  }
}

function handleIconDragOver(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function handleIconDrop(event: DragEvent, targetWidget: WidgetDefinition & WidgetDefinitionState) {
  event.preventDefault()
  event.stopPropagation()
  const widgetId = event.dataTransfer?.getData('widget-id')
  if (widgetId && widgetId !== targetWidget.id) {
    const draggedWidget = widgetsState.value.definitions[widgetId]
    if (draggedWidget && draggedWidget.position === targetWidget.position) {
      reorderWidget(widgetId, targetWidget.id, targetWidget.position)
    }
    else if (draggedWidget) {
      moveWidget(widgetId, targetWidget.position)
    }
    endWidgetDrag()
  }
}
</script>

<template>
  <div class="flex flex-col items-center w-10 shrink-0 gap-1">
    <!-- Top drop zone: left panel -> left area, right panel -> right area -->
    <div
      class="relative flex-1 w-full min-h-12 flex flex-col items-center rounded-lg transition-colors"
      :class="{
        'bg-primary/10': canDropToPosition(position),
      }"
      @dragover="handleDragOver"
      @drop="handleDrop($event, position)"
    >
      <div
        v-if="canDropToPosition(position)"
        class="absolute inset-0.5 rounded-lg border-2 border-dashed border-primary pointer-events-none"
      />
      <div class="flex flex-col items-center gap-0.5">
        <template v-for="(widget, index) in topWidgets" :key="widget.id">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="size-8 hover:bg-muted-foreground/10 dark:hover:bg-muted-foreground/20 hover:text-card-foreground"
                :class="{
                  'bg-muted-foreground/15 dark:bg-muted-foreground/25 text-card-foreground': isActive(widget),
                }"
                draggable="true"
                @click="handleWidgetClick(widget)"
                @dragstart="handleDragStart($event, widget)"
                @dragend="handleDragEnd"
                @dragover="handleIconDragOver"
                @drop="handleIconDrop($event, widget)"
              >
                <component :is="getIconComponent(widget.icon)" class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent :side="position === 'left' ? 'right' : 'left'">
              {{ widget.title }}
            </TooltipContent>
          </Tooltip>

          <Tooltip v-if="position === 'left' && index === 0">
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="size-8 hover:bg-muted-foreground/10 dark:hover:bg-muted-foreground/20 hover:text-card-foreground"
                :class="{
                  'bg-muted-foreground/15 dark:bg-muted-foreground/25 text-card-foreground': workspaceSettingsActive,
                }"
                @click="openWorkspaceSettings"
              >
                <component :is="getIconComponent('Globe2')" class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              Рабочее пространство
            </TooltipContent>
          </Tooltip>
        </template>
      </div>
    </div>

    <!-- Bottom drop zone: left panel -> bottom area, right panel -> floating -->
    <div
      class="relative w-full min-h-12 flex flex-col items-center rounded-lg transition-colors"
      :class="{
        'bg-primary/10': canDropToPosition(position === 'left' ? 'bottom' : 'floating'),
      }"
      @dragover="handleDragOver"
      @drop="handleDrop($event, position === 'left' ? 'bottom' : 'floating')"
    >
      <div
        v-if="canDropToPosition(position === 'left' ? 'bottom' : 'floating')"
        class="absolute inset-0.5 rounded-lg border-2 border-dashed border-primary pointer-events-none"
      />
      <div class="flex flex-col items-center gap-0.5 pt-1 pb-3">
        <Tooltip v-for="widget in bottomWidgetsFiltered" :key="widget.id">
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="size-8 hover:bg-muted-foreground/10 dark:hover:bg-muted-foreground/20 hover:text-card-foreground"
              :class="{
                'bg-muted-foreground/15 dark:bg-muted-foreground/25 text-card-foreground': isActive(widget),
              }"
              draggable="true"
              @click="handleWidgetClick(widget)"
              @dragstart="handleDragStart($event, widget)"
              @dragend="handleDragEnd"
              @dragover="handleIconDragOver"
              @drop="handleIconDrop($event, widget)"
            >
              <component :is="getIconComponent(widget.icon)" class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent :side="position === 'left' ? 'right' : 'left'">
            {{ widget.title }}
          </TooltipContent>
        </Tooltip>

        <!-- Popup widgets (only in right panel) -->
        <template v-if="position === 'right' && popupWidgetGroups.length > 0">
          <Separator class="my-1 w-6" />

          <template v-for="group in popupWidgetGroups" :key="group.definition.id">
            <!-- Single instance: direct click -->
            <Tooltip v-if="group.instances.length === 1">
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-8 hover:bg-muted-foreground/10 dark:hover:bg-muted-foreground/20 hover:text-card-foreground"
                  :class="{
                    'bg-muted-foreground/15 dark:bg-muted-foreground/25 text-card-foreground': isPopupActive(group),
                  }"
                  @click="handlePopupWidgetClick(group)"
                >
                  <component :is="getIconComponent(group.definition.icon)" class="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {{ group.instances[0]?.instance.title ?? group.definition.title }}
              </TooltipContent>
            </Tooltip>

            <!-- Multiple instances: dropdown -->
            <DropdownMenu v-else>
              <DropdownMenuTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-8 hover:bg-muted-foreground/10 dark:hover:bg-muted-foreground/20 hover:text-card-foreground"
                  :class="{
                    'bg-muted-foreground/15 dark:bg-muted-foreground/25 text-card-foreground': isPopupActive(group),
                  }"
                  :title="`${group.definition.title} (${group.instances.length})`"
                >
                  <component :is="getIconComponent(group.definition.icon)" class="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="left" align="start">
                <DropdownMenuItem
                  v-for="{ instance, isMinimized } in group.instances"
                  :key="instance.id"
                  @click="handlePopupInstanceClick(instance.id)"
                >
                  <component :is="getIconComponent(group.definition.icon)" class="size-4 mr-2" />
                  {{ instance.title ?? group.definition.title }}
                  <span v-if="isMinimized" class="ml-2 text-xs text-muted-foreground">({{ t('grid.widget.minimized') }})</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>
