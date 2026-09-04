<script setup lang="ts">
import type { Component, CSSProperties } from 'vue'
import type { UIEditorPanel } from '@/features/endge-admin-ui-editor/modules/ui-editor/domain/types/ui-editor.type'

import { Trash2 } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { ensureUIEditorDemoCoreRenderersRegistered } from '@/features/endge-admin-ui-editor/entities/ui-editor-core-renderers'
import UIEditorDemoCanvas from '@/features/endge-admin-ui-editor/ui/UIEditorDemoCanvas.vue'
import UIEditorDemoCodePanel from '@/features/endge-admin-ui-editor/ui/UIEditorDemoCodePanel.vue'
import UIEditorDemoPreviewPanel from '@/features/endge-admin-ui-editor/ui/UIEditorDemoPreviewPanel.vue'
import UIEditorDemoToolbar from '@/features/endge-admin-ui-editor/ui/UIEditorDemoToolbar.vue'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'

ensureUIEditorDemoCoreRenderersRegistered()
const uiEditor = EndgeIDE.uiEditor

const splitContainerRef = ref<HTMLElement | null>(null)
const isSplitResizing = ref(false)
const SPLIT_KEYBOARD_STEP = 0.02
const activeDividerIndex = ref<number | null>(null)
const activePanels = computed(() => uiEditor.activePanels)
const panelSizes = computed(() => uiEditor.getActivePanelSizes())
const contextMenuButtonRef = ref<HTMLButtonElement | null>(null)
const contextMenuStyle = computed<CSSProperties>(() => {
  const menu = uiEditor.contextMenu
  if (!menu) {
    return {}
  }
  const maxX = typeof window === 'undefined' ? menu.x : Math.max(8, window.innerWidth - 168)
  const maxY = typeof window === 'undefined' ? menu.y : Math.max(8, window.innerHeight - 52)
  return {
    left: `${Math.min(menu.x, maxX)}px`,
    top: `${Math.min(menu.y, maxY)}px`,
  }
})

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    && target.closest('input, textarea, select, [contenteditable="true"], .monaco-editor') != null
}

function handleEditorKeydown(event: KeyboardEvent): void {
  if (isEditableTarget(event.target)) {
    return
  }

  if (event.key === 'Escape') {
    if (uiEditor.nodeDragSession) {
      uiEditor.cancelNodeDrag()
      return
    }
    if (uiEditor.contextMenu) {
      uiEditor.closeContextMenu()
      return
    }
    if (uiEditor.editingNodeId) {
      uiEditor.cancelInlineEdit()
      return
    }
    uiEditor.clearSelection()
    return
  }

  if (event.key === 'Enter' && uiEditor.selectedNodeId) {
    if (uiEditor.beginInlineEdit(uiEditor.selectedNodeId)) {
      event.preventDefault()
    }
    return
  }

  if (event.key !== 'Backspace') {
    return
  }
  if (event.repeat) {
    return
  }

  const selectedNodeId = uiEditor.selectedNodeId
  if (!selectedNodeId || selectedNodeId === uiEditor.document.rootId) {
    return
  }

  event.preventDefault()
  uiEditor.removeNode(selectedNodeId)
}

function removeContextNode(): void {
  const nodeId = uiEditor.contextMenu?.nodeId
  if (nodeId) {
    uiEditor.removeNode(nodeId)
  }
}

watch(
  () => uiEditor.contextMenu,
  async (menu) => {
    if (!menu) {
      return
    }
    await nextTick()
    contextMenuButtonRef.value?.focus()
  },
)

function updatePanelBoundary(clientX: number, persist: boolean): void {
  const container = splitContainerRef.value
  const dividerIndex = activeDividerIndex.value
  if (!container || dividerIndex == null) {
    return
  }
  const rect = container.getBoundingClientRect()
  if (rect.width <= 0) {
    return
  }
  uiEditor.setPanelDividerBoundary(dividerIndex, (clientX - rect.left) / rect.width, persist)
}

function onSplitPointerMove(event: PointerEvent): void {
  if (!isSplitResizing.value) {
    return
  }
  updatePanelBoundary(event.clientX, false)
}

function endSplitResize(): void {
  if (!isSplitResizing.value) {
    return
  }
  isSplitResizing.value = false
  if (activeDividerIndex.value != null) {
    uiEditor.setPanelDividerBoundary(
      activeDividerIndex.value,
      uiEditor.getPanelDividerBoundary(activeDividerIndex.value),
    )
  }
  activeDividerIndex.value = null
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  window.removeEventListener('pointermove', onSplitPointerMove)
  window.removeEventListener('pointerup', endSplitResize)
  window.removeEventListener('pointercancel', endSplitResize)
}

function beginSplitResize(dividerIndex: number, event: PointerEvent): void {
  if (event.button !== 0) {
    return
  }
  event.preventDefault()
  isSplitResizing.value = true
  activeDividerIndex.value = dividerIndex
  document.body.style.cursor = 'ew-resize'
  document.body.style.userSelect = 'none'
  updatePanelBoundary(event.clientX, false)
  window.addEventListener('pointermove', onSplitPointerMove)
  window.addEventListener('pointerup', endSplitResize)
  window.addEventListener('pointercancel', endSplitResize)
}

function resizeSplitByKeyboard(dividerIndex: number, event: KeyboardEvent): void {
  const direction = event.key === 'ArrowLeft'
    ? -1
    : event.key === 'ArrowRight'
      ? 1
      : 0
  if (direction !== 0) {
    event.preventDefault()
    const step = event.shiftKey ? SPLIT_KEYBOARD_STEP * 5 : SPLIT_KEYBOARD_STEP
    uiEditor.resizePanelDivider(dividerIndex, direction * step)
  }
}

function resetSplitRatio(): void {
  uiEditor.resetActivePanelLayout()
}

function panelComponent(panel: UIEditorPanel): Component {
  if (panel === 'source') {
    return UIEditorDemoCodePanel
  }
  if (panel === 'preview') {
    return UIEditorDemoPreviewPanel
  }
  return UIEditorDemoCanvas
}

function panelStyle(index: number): CSSProperties {
  return {
    flexBasis: 0,
    flexGrow: panelSizes.value[index] ?? 1,
    flexShrink: 1,
    minWidth: 0,
  }
}

onMounted(() => window.addEventListener('keydown', handleEditorKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleEditorKeydown)
  uiEditor.closeContextMenu()
  endSplitResize()
})
</script>

<template>
  <div class="relative flex h-full min-h-0 flex-col overflow-hidden bg-[linear-gradient(180deg,#fbfdff_0%,#f4f8fc_100%)] text-foreground dark:bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.08),transparent_34%),linear-gradient(180deg,#111827_0%,#0b1120_100%)]">
    <UIEditorDemoToolbar :state="uiEditor" />

    <div
      ref="splitContainerRef"
      class="flex min-h-0 flex-1 overflow-hidden"
    >
      <template v-for="(panel, index) in activePanels" :key="panel">
        <div
          class="h-full overflow-hidden"
          :data-ui-editor-panel="panel"
          :style="panelStyle(index)"
        >
          <component :is="panelComponent(panel)" :state="uiEditor" />
        </div>

        <div
          v-if="index < activePanels.length - 1"
          class="ui-editor-splitter"
          :data-resizing="isSplitResizing"
          role="separator"
          :aria-label="`Изменить ширину панелей ${panel} и ${activePanels[index + 1]}`"
          aria-orientation="vertical"
          :aria-valuenow="Math.round(uiEditor.getPanelDividerBoundary(index) * 100)"
          aria-valuemin="18"
          aria-valuemax="82"
          tabindex="0"
          title="Drag to resize · Double-click to reset"
          @pointerdown="beginSplitResize(index, $event)"
          @keydown.stop="resizeSplitByKeyboard(index, $event)"
          @dblclick="resetSplitRatio"
        >
          <span />
        </div>
      </template>
    </div>

    <Teleport to="body">
      <div
        v-if="uiEditor.contextMenu"
        class="fixed inset-0 z-[120]"
        @pointerdown="uiEditor.closeContextMenu()"
        @contextmenu.prevent="uiEditor.closeContextMenu()"
      >
        <div
          role="menu"
          aria-label="Действия элемента"
          class="fixed w-40 border border-border/75 bg-popover p-1 text-popover-foreground shadow-lg"
          :style="contextMenuStyle"
          @pointerdown.stop
          @contextmenu.stop.prevent
        >
          <button
            ref="contextMenuButtonRef"
            type="button"
            role="menuitem"
            class="flex h-8 w-full items-center gap-2 px-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10 focus-visible:bg-destructive/10 focus-visible:outline-none"
            @click="removeContextNode"
          >
            <Trash2 class="size-3.5" />
            <span>{{ $t('uiText.delete86ea33ae') }}</span>
            <kbd class="ml-auto font-mono text-[9px] text-muted-foreground">{{ $t('uiText.symbol6b93fd28') }}</kbd>
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.ui-editor-splitter {
  position: relative;
  z-index: 30;
  display: flex;
  width: 7px;
  min-height: 0;
  flex: 0 0 7px;
  align-items: center;
  justify-content: center;
  border-right: 1px solid color-mix(in oklab, var(--border) 72%, transparent);
  border-left: 1px solid color-mix(in oklab, var(--border) 72%, transparent);
  background: color-mix(in oklab, var(--muted) 32%, transparent);
  cursor: ew-resize;
  outline: none;
}

.ui-editor-splitter span {
  width: 2px;
  height: 34px;
  border-radius: 999px;
  background: color-mix(in oklab, var(--muted-foreground) 38%, transparent);
  transition: height 140ms ease, background-color 140ms ease;
}

.ui-editor-splitter:hover span,
.ui-editor-splitter:focus-visible span,
.ui-editor-splitter[data-resizing='true'] span {
  height: 50px;
  background: rgb(14 165 233 / 0.82);
}
</style>
