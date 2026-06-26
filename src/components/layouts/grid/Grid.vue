<script setup lang="ts">
import { useWindowSize } from '@vueuse/core'
import { computed, onUnmounted, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Spinner } from '@/components/ui/spinner'
import { TooltipProvider } from '@/components/ui/tooltip'
import FloatingWidgets from '@/components/layouts/grid/FloatingWidgets.vue'
import GridHeader from '@/components/layouts/grid/GridHeader.vue'
import { cleanupWidgetChannel, closeNonDetachablePopups, endWidgetDrag, getAreaSize, getLayoutState, getWidgetsByPosition, initWidgetChannel, moveWidget, setAreaSize } from '@/components/layouts/grid/layout.ts'
import WidgetArea from '@/components/layouts/grid/WidgetArea.vue'
import WidgetPanel from '@/components/layouts/grid/WidgetPanel.vue'
import UIEditorDemoTopbar from '@/features/endge-admin-ui-editor/UI/UIEditorDemoTopbar.vue'

// Initialize widget channel for popup communication
initWidgetChannel()

const route = useRoute()

// Close non-detachable popups on route change
watch(() => route.fullPath, () => {
  closeNonDetachablePopups()
})

onUnmounted(() => {
  cleanupWidgetChannel()
})

const { isLoading, widgets, isDraggingWidget, draggingWidgetId } = getLayoutState()

const { height: windowHeight, width: windowWidth } = useWindowSize()
const headerRef = ref<HTMLElement>()

const leftWidgets = computed(() => getWidgetsByPosition('left'))
const rightWidgets = computed(() => getWidgetsByPosition('right'))
const bottomWidgets = computed(() => getWidgetsByPosition('bottom'))
const floatingWidgets = computed(() => getWidgetsByPosition('floating'))

const hasLeftWidgets = computed(() => leftWidgets.value.some(d =>
  Object.values(widgets.value.instances).some(i => i.definitionId === d.id),
))
const hasRightWidgets = computed(() => rightWidgets.value.some(d =>
  Object.values(widgets.value.instances).some(i => i.definitionId === d.id),
))
const hasBottomWidgets = computed(() => bottomWidgets.value.some(d =>
  Object.values(widgets.value.instances).some(i => i.definitionId === d.id),
))

const leftAreaExpanded = computed(() =>
  widgets.value.areas.left.expanded && hasLeftWidgets.value,
)
const rightAreaExpanded = computed(() =>
  widgets.value.areas.right.expanded && hasRightWidgets.value,
)
const bottomAreaExpanded = computed(() =>
  widgets.value.areas.bottom.expanded && hasBottomWidgets.value,
)

provide('gridLayoutWindowSize', { width: windowWidth, height: windowHeight })

const mainAreaRef = ref<HTMLElement>()
const leftPanelWidth = ref(getAreaSize('left'))
const rightPanelWidth = ref(getAreaSize('right'))
const bottomPanelHeight = ref(getAreaSize('bottom'))

const gridStyle = computed(() => {
  const cols: string[] = []
  const rows: string[] = []

  if (leftAreaExpanded.value) {
    cols.push(`${leftPanelWidth.value}px`, '0.25rem')
  }
  cols.push('1fr')
  if (rightAreaExpanded.value) {
    cols.push('0.25rem', `${rightPanelWidth.value}px`)
  }

  rows.push('1fr')
  if (bottomAreaExpanded.value) {
    rows.push('0.25rem', `${bottomPanelHeight.value}px`)
  }

  return {
    display: 'grid',
    gridTemplateColumns: cols.join(' '),
    gridTemplateRows: rows.join(' '),
    gap: '0',
  }
})

function startLeftResize(event: MouseEvent) {
  event.preventDefault()
  const startX = event.clientX
  const startWidth = leftPanelWidth.value

  const onMouseMove = (e: MouseEvent) => {
    const mainArea = mainAreaRef.value
    if (!mainArea)
      return

    const maxWidth = mainArea.offsetWidth * 0.4
    const deltaX = e.clientX - startX
    const newWidth = Math.min(maxWidth, Math.max(150, startWidth + deltaX))
    leftPanelWidth.value = newWidth
  }

  const onMouseUp = () => {
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    setAreaSize('left', leftPanelWidth.value)
  }

  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'ew-resize'
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function startRightResize(event: MouseEvent) {
  event.preventDefault()
  const startX = event.clientX
  const startWidth = rightPanelWidth.value

  const onMouseMove = (e: MouseEvent) => {
    const mainArea = mainAreaRef.value
    if (!mainArea)
      return

    const maxWidth = mainArea.offsetWidth * 0.4
    const deltaX = startX - e.clientX
    const newWidth = Math.min(maxWidth, Math.max(150, startWidth + deltaX))
    rightPanelWidth.value = newWidth
  }

  const onMouseUp = () => {
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    setAreaSize('right', rightPanelWidth.value)
  }

  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'ew-resize'
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function startBottomResize(event: MouseEvent) {
  event.preventDefault()
  const startY = event.clientY
  const startHeight = bottomPanelHeight.value

  const onMouseMove = (e: MouseEvent) => {
    const mainArea = mainAreaRef.value
    if (!mainArea)
      return

    const maxHeight = mainArea.offsetHeight * 0.5
    const deltaY = startY - e.clientY
    const newHeight = Math.min(maxHeight, Math.max(100, startHeight + deltaY))
    bottomPanelHeight.value = newHeight
  }

  const onMouseUp = () => {
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    setAreaSize('bottom', bottomPanelHeight.value)
  }

  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'ns-resize'
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

const leftColumnStart = computed(() => 1)
const mainColumnStart = computed(() => leftAreaExpanded.value ? 3 : 1)
const rightHandleColumnStart = computed(() => {
  let col = 1
  if (leftAreaExpanded.value)
    col += 2
  col += 1
  return col
})
const rightColumnStart = computed(() => rightHandleColumnStart.value + 1)
const bottomRowStart = computed(() => 3)

function handleGlobalDragOver(event: DragEvent) {
  if (!isDraggingWidget.value)
    return
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function handleGlobalDrop(event: DragEvent) {
  if (!isDraggingWidget.value || !draggingWidgetId.value)
    return
  event.preventDefault()
  moveWidget(draggingWidgetId.value, 'floating')
  endWidgetDrag()
}
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <div
      class="h-screen w-screen flex flex-col bg-linear-to-br from-primary/10 via-muted to-muted overflow-hidden"
      @dragover="handleGlobalDragOver"
      @drop="handleGlobalDrop"
    >
      <header
        ref="headerRef"
        class="flex h-12 shrink-0 items-center gap-2 px-1.5"
      >
        <GridHeader />
      </header>

      <div class="flex flex-1 min-h-0 px-0.5 pb-0.5 gap-0.5">
        <WidgetPanel
          position="left"
          :widgets="leftWidgets"
          :bottom-widgets="bottomWidgets"
        />

        <div ref="mainAreaRef" class="flex-1 min-w-0 min-h-0 pb-1.5" :style="gridStyle">
          <div
            v-if="leftAreaExpanded"
            class="h-full overflow-hidden"
            :style="{ gridColumn: leftColumnStart, gridRow: '1' }"
          >
            <WidgetArea position="left" />
          </div>
          <div
            v-if="leftAreaExpanded"
            class="cursor-ew-resize hover:bg-primary/20 transition-colors"
            :style="{ gridColumn: leftColumnStart + 1, gridRow: bottomAreaExpanded ? '1 / -1' : '1' }"
            @mousedown="startLeftResize"
          />

          <div
            class="h-full overflow-hidden"
            :style="{ gridColumn: mainColumnStart, gridRow: '1' }"
          >
            <div class="h-full bg-background rounded-lg overflow-hidden flex flex-col">
              <slot name="default" />
            </div>
          </div>

          <div
            v-if="rightAreaExpanded"
            class="cursor-ew-resize hover:bg-primary/20 transition-colors"
            :style="{ gridColumn: rightHandleColumnStart, gridRow: bottomAreaExpanded ? '1 / -1' : '1' }"
            @mousedown="startRightResize"
          />
          <div
            v-if="rightAreaExpanded"
            class="h-full overflow-hidden"
            :style="{ gridColumn: rightColumnStart, gridRow: '1' }"
          >
            <WidgetArea position="right" />
          </div>

          <div
            v-if="bottomAreaExpanded"
            class="cursor-ns-resize hover:bg-primary/20 transition-colors"
            :style="{ gridColumn: '1 / -1', gridRow: '2' }"
            @mousedown="startBottomResize"
          />
          <div
            v-if="bottomAreaExpanded"
            class="overflow-hidden"
            :style="{ gridColumn: '1 / -1', gridRow: bottomRowStart }"
          >
            <WidgetArea position="bottom" />
          </div>
        </div>

        <WidgetPanel
          position="right"
          :widgets="rightWidgets"
          :bottom-widgets="floatingWidgets"
        />
      </div>

      <UIEditorDemoTopbar />

      <FloatingWidgets />

      <Transition
        enter-active-class="transition-opacity duration-200"
        leave-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isLoading"
          class="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-[9999]"
        >
          <Spinner class="size-10 text-primary" />
        </div>
      </Transition>
    </div>
  </TooltipProvider>
</template>
