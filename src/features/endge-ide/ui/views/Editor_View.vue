<script setup lang="ts">
import type { SmartTabRef } from '@/features/endge-ide/ui/smart-tabs'

import { Endge } from '@endge/core'
import { Loader2 } from 'lucide-vue-next'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import { Configurator } from '@/app/Configurator'
import { getLayoutState, useLayout } from '@/components/layouts/grid'
import { ENDGE_ADMIN_UI_LIBRARY_WIDGET_ID } from '@/features/endge-admin-ui-editor/entities/ui-editor-workspace'
import UIEditorDemo_Singleton from '@/features/endge-admin-ui-editor/ui/UIEditorDemo_Singleton.vue'
import { ENDGE_IDE_PROBLEMS_WIDGET_ID } from '@/features/endge-ide/domain/types/problems-workspace.types'
import { ENDGE_IDE_RUNTIME_TREE_WIDGET_ID } from '@/features/endge-ide/domain/types/runtime-preview.types'
import { EndgeIDE } from '@/features/endge-ide/EndgeIDE'
import SourceEditorDialogHost from '@/features/endge-ide/source-editor/ui/SourceEditorDialogHost.vue'
import CreateDocument_Modal from '@/features/endge-ide/ui/modals/CreateDocument_Modal.vue'
import DuplicateDocument_Modal from '@/features/endge-ide/ui/modals/DuplicateDocument_Modal.vue'
import VocabJsonPreview_Modal from '@/features/endge-ide/ui/modals/VocabJsonPreview_Modal.vue'
import Problems_View from '@/features/endge-ide/ui/section/problems/Problems_View.vue'
import RuntimeInspectionView from '@/features/endge-ide/ui/section/runtime-preview/RuntimeInspection_View.vue'
import RuntimePreview_View from '@/features/endge-ide/ui/section/runtime-preview/RuntimePreview_View.vue'
import RuntimePreviewOccurrenceDialog from '@/features/endge-ide/ui/section/runtime-preview/RuntimePreviewOccurrenceDialog.vue'
import { SmartTabsHost } from '@/features/endge-ide/ui/smart-tabs'

const tabs = EndgeIDE.tabs
const modals = EndgeIDE.modals
const route = useRoute()
const { t } = useI18n()
const { widgets } = getLayoutState()
const createDocumentOpen = computed({
  get: () => modals.isCreateDocumentOpen.value,
  set: (v: boolean) => {
    if (!v) {
      modals.closeCreateDocument()
    }
  },
})
const duplicateDocumentOpen = computed({
  get: () => modals.isDuplicateDocumentOpen.value,
  set: (v: boolean) => {
    if (!v) {
      modals.closeDuplicateDocument()
    }
  },
})
const duplicateSourceNode = computed(() => modals.duplicateSourceNode.value)
const vocabJsonPreviewOpen = computed({
  get: () => modals.isVocabJsonPreviewOpen.value,
  set: (v: boolean) => {
    if (!v) {
      modals.closeVocabJsonPreview()
    }
  },
})
const hasNoTabs = computed(() => tabs.openTabs.value.length === 0)
const isRuntimePreviewActive = computed(() => {
  const area = widgets.value.areas.left
  return area.expanded && area.activeWidget === ENDGE_IDE_RUNTIME_TREE_WIDGET_ID
})
const isProblemsActive = computed(() => {
  const area = widgets.value.areas.left
  return area.expanded && area.activeWidget === ENDGE_IDE_PROBLEMS_WIDGET_ID
})
const isUIEditorActive = computed(() => {
  const position = widgets.value.definitions[ENDGE_ADMIN_UI_LIBRARY_WIDGET_ID]?.position
  if (position !== 'left' && position !== 'right' && position !== 'bottom') {
    return false
  }

  const area = widgets.value.areas[position]
  return area.expanded && area.activeWidget === ENDGE_ADMIN_UI_LIBRARY_WIDGET_ID
})
const isBusy = computed(() => EndgeIDE.busy.value)
const hotkeysList = computed(() => EndgeIDE.hotkeys.getAllHotkeys())
const busyText = computed(() => t('common.pleaseWait'))

function getIconClass(tab: { meta?: Record<string, unknown> | undefined }): string | null {
  const icon = tab.meta?.icon
  return typeof icon === 'string' ? icon : null
}

function getTabTooltip(tab: SmartTabRef): string | null {
  return tabs.getTabDomainPath(tab)
}

useLayout({
  title: computed(() => 'Endge'),
})

onMounted(() => {
  if (route.query.guardTest === '1') {
    Configurator.diagnostics.triggerTest({
      routePath: route.path,
      componentName: 'EndgeAdminEditorView',
    })
  }
})
</script>

<template>
  <div class="h-full min-h-0 flex flex-col relative">
    <RuntimeInspectionView v-if="isRuntimePreviewActive && Endge.mode === 'debugger'" class="min-h-0 flex-1" />
    <RuntimePreview_View v-else-if="isRuntimePreviewActive" class="min-h-0 flex-1" />
    <Problems_View v-else-if="isProblemsActive" class="min-h-0 flex-1" />
    <UIEditorDemo_Singleton v-else-if="isUIEditorActive" class="min-h-0 flex-1" />

    <div v-else class="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <SmartTabsHost
        v-if="!hasNoTabs"
        :api="EndgeIDE.tabs"
        :get-icon-class="getIconClass"
        :get-tooltip="getTabTooltip"
        class="min-h-0 flex-1"
      />

      <!-- Пустое состояние по центру (по вертикали и горизонтали), поверх контента вкладок -->
      <div
        v-if="hasNoTabs"
        class="h-full inset-0 flex flex-col items-center justify-center p-6 text-muted-foreground pointer-events-none"
        aria-hidden="true"
      >
        <div class="flex flex-col items-center justify-center gap-6">
          <div class="rounded-lg p-8 text-muted-foreground/80">
            <svg class="size-24 opacity-30" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="editor-empty-state-logo-gradient" x1="26" y1="26" x2="58" y2="38" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#635BFF" />
                  <stop offset="1" stop-color="#4338FF" />
                </linearGradient>
              </defs>
              <path
                class="fill-[#171B24] dark:fill-white"
                d="M12 6H52C55.3137 6 58 8.68629 58 12V16C58 19.3137 55.3137 22 52 22H22V42H52C55.3137 42 58 44.6863 58 48V52C58 55.3137 55.3137 58 52 58H12C8.68629 58 6 55.3137 6 52V12C6 8.68629 8.68629 6 12 6Z"
              />
              <rect x="26" y="26" width="32" height="12" rx="4" fill="url(#editor-empty-state-logo-gradient)" />
            </svg>
          </div>
          <ul class="flex flex-col gap-2 text-sm">
            <li
              v-for="item in hotkeysList"
              :key="item.label"
              class="flex items-center justify-between gap-8"
            >
              <span>{{ item.label }}</span>
              <kbd class="font-mono text-xs tracking-wide text-muted-foreground/90">
                {{ item.keysLabel }}
              </kbd>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Оверлей при любой асинхронной операции с сущностями -->
    <div
      v-if="isBusy"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-white/70 dark:bg-black/50 backdrop-blur-[1px]"
      aria-busy="true"
      aria-live="polite"
    >
      <div class="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 class="size-10 animate-spin" />
        <span class="text-sm font-medium">{{ busyText }}</span>
      </div>
    </div>

    <CreateDocument_Modal v-if="Endge.mode !== 'debugger'" v-model:open="createDocumentOpen" />
    <DuplicateDocument_Modal
      v-if="Endge.mode !== 'debugger'"
      v-model:open="duplicateDocumentOpen"
      :source="duplicateSourceNode"
    />
    <VocabJsonPreview_Modal
      v-model:open="vocabJsonPreviewOpen"
      :title="modals.vocabJsonPreviewTitle.value"
      :data="modals.vocabJsonPreviewData.value"
    />
    <SourceEditorDialogHost />
    <RuntimePreviewOccurrenceDialog v-if="Endge.mode !== 'debugger'" />
  </div>
</template>
