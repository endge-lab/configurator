<script setup lang="ts">
import type { WidgetDefinition, WidgetDefinitionState, WidgetInstance, WidgetPosition } from '@/components/layouts/grid/types.ts'
import {
  AppWindowMac,
  Ellipsis,
  Loader2,
  Minus,
  PanelBottom,
  PanelLeft,
  PanelRight,
  PanelsLeftBottom,
  PictureInPicture2,
  X,
} from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, provide, ref, toValue } from 'vue'
import { Endge } from '@endge/core'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getIconComponent } from '@/components/layouts/grid/icons.ts'
import {
  addHeaderAction,
  addOptionsAction,
  destroyAllWidgetInstances,
  destroyWidgetInstance,
  hideWidget,
  moveWidget,
  removeHeaderAction,
  removeOptionsAction,
  setWidgetInstanceLoading,
  setWidgetInstanceTitle,
} from '@/components/layouts/grid/layout.ts'

const props = defineProps<{
  definition: WidgetDefinition & WidgetDefinitionState
  instances: WidgetInstance[]
  position: 'left' | 'right' | 'bottom' | 'floating'
}>()

const emit = defineEmits<{
  headerMousedown: [event: MouseEvent]
}>()

/** Снимок домена для виджета агента (двухшаговый запрос: потребность → вопрос + сущности). */
provide('agentDomainSnapshot', () => Endge.domain.toPlain())

const { t } = useI18n()

const activeInstanceId = ref<string | null>(props.instances[0]?.id ?? null)

const activeInstance = computed(() =>
  props.instances.find(i => i.id === activeInstanceId.value) ?? props.instances[0],
)

const headerActions = computed(() => {
  const instanceActions = activeInstance.value?.headerActions?.header ?? []
  const defaultActions = props.definition.defaultHeaderActions?.header ?? []
  return instanceActions.length > 0 ? instanceActions : defaultActions
})

const optionsActions = computed(() => {
  const instanceActions = activeInstance.value?.headerActions?.options ?? []
  const defaultActions = props.definition.defaultHeaderActions?.options ?? []
  return instanceActions.length > 0 ? instanceActions : defaultActions
})

const allowedPositions = computed(() =>
  props.definition.allowedPositions ?? ['left', 'right', 'bottom', 'floating'],
)

const canMoveToPopup = computed(() =>
  allowedPositions.value.includes('popup'),
)

function handleMinimize() {
  hideWidget(props.definition.id)
}

function handleClose() {
  destroyAllWidgetInstances(props.definition.id)
}

function handleCloseInstance(instanceId: string) {
  destroyWidgetInstance(instanceId)
  if (activeInstanceId.value === instanceId) {
    activeInstanceId.value = props.instances.find(i => i.id !== instanceId)?.id ?? null
  }
}

function handleMoveTo(position: WidgetPosition) {
  moveWidget(props.definition.id, position)
}

function isActionDisabled(action: { disabled?: unknown }): boolean {
  if (!action.disabled)
    return false
  const value = toValue(action.disabled)
  return typeof value === 'function' ? value() : Boolean(value)
}

const instanceTitle = computed(() =>
  activeInstance.value?.title ?? props.definition.title,
)

// Ref to track iframe elements for each instance
const iframeRefs = ref<Map<string, HTMLIFrameElement>>(new Map())

function setIframeRef(instanceId: string, el: HTMLIFrameElement | null) {
  if (el) {
    iframeRefs.value.set(instanceId, el)
  }
  else {
    iframeRefs.value.delete(instanceId)
  }
}

// Handle messages from iframe content
function handleIframeMessage(event: MessageEvent) {
  const data = event.data
  if (!data || typeof data !== 'object' || !activeInstance.value)
    return

  // Verify the message came from our iframe
  const iframe = iframeRefs.value.get(activeInstance.value.id)
  if (!iframe || event.source !== iframe.contentWindow)
    return

  const instanceId = activeInstance.value.id

  if (data.type === 'widget-update-title') {
    setWidgetInstanceTitle(instanceId, data.title)
  }
  else if (data.type === 'widget-update-loading') {
    setWidgetInstanceLoading(instanceId, data.isLoading)
  }
  else if (data.type === 'widget-add-header-action') {
    handleIframeAddHeaderAction(instanceId, data.action, data.location)
  }
  else if (data.type === 'widget-remove-header-action') {
    handleIframeRemoveHeaderAction(instanceId, data.actionId)
  }
}

// Convert serializable action from iframe to actual WidgetHeaderAction
function handleIframeAddHeaderAction(
  instanceId: string,
  action: { id: string, title?: string, icon?: string, order?: number, disabled?: boolean },
  location: 'header' | 'options',
) {
  const widgetAction = {
    id: action.id,
    title: action.title,
    icon: action.icon,
    order: action.order,
    disabled: action.disabled,
    onClick: () => {
      // Send click event back to iframe
      const iframe = iframeRefs.value.get(instanceId)
      iframe?.contentWindow?.postMessage({
        type: 'widget-action-clicked',
        actionId: action.id,
      }, '*')
    },
  }
  if (location === 'options') {
    addOptionsAction(instanceId, widgetAction)
  }
  else {
    addHeaderAction(instanceId, widgetAction)
  }
}

function handleIframeRemoveHeaderAction(instanceId: string, actionId: string) {
  removeHeaderAction(instanceId, actionId)
  removeOptionsAction(instanceId, actionId)
}

onMounted(() => {
  window.addEventListener('message', handleIframeMessage)
})

onUnmounted(() => {
  window.removeEventListener('message', handleIframeMessage)
})
</script>

<template>
  <div class="flex flex-col h-full">
    <div
      class="flex items-center gap-1 px-2 h-10 border-b border-border shrink-0"
      :class="{ 'cursor-move': position === 'floating' }"
      @mousedown="position === 'floating' && emit('headerMousedown', $event)"
    >
      <Loader2 v-if="activeInstance?.isLoading" class="size-4 text-muted-foreground shrink-0 animate-spin" />
      <component :is="getIconComponent(definition.icon)" v-else-if="definition.icon" class="size-4 text-muted-foreground shrink-0" />
      <span class="text-sm font-medium truncate">{{ instanceTitle }}</span>

      <div class="flex-1" />

      <template v-for="action in headerActions" :key="action.id">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="size-7"
              :disabled="isActionDisabled(action)"
              @mousedown.stop
              @click="action.onClick?.()"
            >
              <component :is="getIconComponent(action.icon)" v-if="action.icon" class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent v-if="action.title">
            {{ action.title }}
          </TooltipContent>
        </Tooltip>
      </template>

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon" class="size-7" @mousedown.stop>
            <Ellipsis class="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-48">
          <template v-for="action in optionsActions" :key="action.id">
            <DropdownMenuItem
              :disabled="isActionDisabled(action)"
              @click="action.onClick?.()"
            >
              <component :is="getIconComponent(action.icon)" v-if="action.icon" class="size-4" />
              {{ action.title }}
            </DropdownMenuItem>
          </template>
          <DropdownMenuSeparator v-if="optionsActions.length > 0" />

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <PanelsLeftBottom class="size-4 mr-2" />
              {{ t('grid.widget.moveTo') }}
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuItem
                  v-if="allowedPositions.includes('left')"
                  :disabled="position === 'left'"
                  @click="handleMoveTo('left')"
                >
                  <PanelLeft class="size-4" />
                  {{ t('grid.widget.pinLeft') }}
                </DropdownMenuItem>
                <DropdownMenuItem
                  v-if="allowedPositions.includes('right')"
                  :disabled="position === 'right'"
                  @click="handleMoveTo('right')"
                >
                  <PanelRight class="size-4" />
                  {{ t('grid.widget.pinRight') }}
                </DropdownMenuItem>
                <DropdownMenuItem
                  v-if="allowedPositions.includes('bottom')"
                  :disabled="position === 'bottom'"
                  @click="handleMoveTo('bottom')"
                >
                  <PanelBottom class="size-4" />
                  {{ t('grid.widget.pinBottom') }}
                </DropdownMenuItem>
                <DropdownMenuItem
                  v-if="allowedPositions.includes('floating')"
                  :disabled="position === 'floating'"
                  @click="handleMoveTo('floating')"
                >
                  <PictureInPicture2 class="size-4" />
                  {{ t('grid.widget.floating') }}
                </DropdownMenuItem>
                <DropdownMenuItem
                  v-if="canMoveToPopup"
                  @click="handleMoveTo('popup')"
                >
                  <AppWindowMac class="size-4" />
                  {{ t('grid.widget.popup') }}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            v-if="!definition.permanent"
            class="text-destructive focus:text-destructive"
            @click="handleClose"
          >
            <X class="size-4" />
            {{ t('grid.widget.close') }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button variant="ghost" size="icon" class="size-7" @mousedown.stop @click="handleMinimize">
            <Minus class="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ t('grid.widget.minimize') }}</TooltipContent>
      </Tooltip>
    </div>

    <div
      v-if="instances.length > 1 && !definition.singleton"
      class="flex items-center border-b border-border shrink-0"
    >
      <ScrollArea class="w-full">
        <div class="flex items-center gap-0.5 px-1 py-1">
          <button
            v-for="instance in instances"
            :key="instance.id"
            class="flex items-center gap-1.5 px-2 py-1 rounded text-sm transition-colors whitespace-nowrap" :class="[
              activeInstanceId === instance.id
                ? 'bg-secondary text-secondary-foreground'
                : 'hover:bg-secondary/50 text-muted-foreground',
            ]"
            @click="activeInstanceId = instance.id"
          >
            <component :is="getIconComponent(definition.icon)" class="size-3.5 shrink-0" />
            <span class="truncate max-w-32">{{ instance.title ?? definition.title }}</span>
            <button
              v-if="!definition.permanent"
              class="size-4 flex items-center justify-center rounded hover:bg-destructive/20 hover:text-destructive ml-1"
              @click.stop="handleCloseInstance(instance.id)"
            >
              <X class="size-3" />
            </button>
          </button>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>

    <div class="flex-1 overflow-auto">
      <template v-if="activeInstance">
        <template v-if="definition.content === 'component'">
          <component
            :is="'component' in activeInstance && activeInstance.component ? activeInstance.component : definition.defaultComponent"
            :instance-id="activeInstance.id"
            v-bind="'props' in activeInstance && activeInstance.props ? activeInstance.props : definition.defaultProps"
          />
        </template>
        <template v-else-if="definition.content === 'iframe'">
          <iframe
            :ref="(el) => setIframeRef(activeInstance!.id, el as HTMLIFrameElement)"
            :src="'url' in activeInstance && activeInstance.url ? activeInstance.url : definition.defaultUrl"
            class="w-full h-full border-0"
          />
        </template>
      </template>
    </div>
  </div>
</template>
