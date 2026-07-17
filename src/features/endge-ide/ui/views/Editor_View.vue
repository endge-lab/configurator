<script setup lang="ts">
import { EndgeAppHelperMenu } from '@endge/vue'
import { Box, Loader2 } from 'lucide-vue-next'
import { computed, onBeforeMount, onBeforeUnmount, onMounted } from 'vue'
import { useRoute } from 'vue-router'

import { getLayoutState, useLayout } from '@/components/layouts/grid'
import { SmartTabsHost } from '@/components/ui/smart-tabs'
import { triggerAppRenderGuardTest } from '@/features/endge-configurator/model/app-render-guard.ts'
import { EndgeIDE } from '@/features/endge-ide/model/core/endge-ide.ts'
import SourceEditorDialogHost from '@/features/endge-ide/source-editor/ui/SourceEditorDialogHost.vue'
import ClearSoftDeleted_Modal from '@/features/endge-ide/ui/modals/ClearSoftDeleted_Modal.vue'
import CreateDocument_Modal from '@/features/endge-ide/ui/modals/CreateDocument_Modal.vue'
import CreateVersion_Modal from '@/features/endge-ide/ui/modals/CreateVersion_Modal.vue'
import DuplicateDocument_Modal from '@/features/endge-ide/ui/modals/DuplicateDocument_Modal.vue'
import VocabJsonPreview_Modal from '@/features/endge-ide/ui/modals/VocabJsonPreview_Modal.vue'
import { EmbeddedRuntimePreview, ENDGE_PREVIEW_RUNTIME_TREE_WIDGET_ID } from '@/features/endge-preview'

const tabs = EndgeIDE.tabs
const modals = EndgeIDE.modals
const route = useRoute()
const { widgets } = getLayoutState()
const createVersionOpen = computed({
  get: () => modals.isCreateVersionOpen.value,
  set: (v: boolean) => {
    if (!v) {
      modals.closeCreateVersion()
    }
  },
})
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
const clearSoftDeletedOpen = computed({
  get: () => modals.isClearSoftDeletedOpen.value,
  set: (v: boolean) => {
    if (!v) {
      modals.closeClearSoftDeleted()
    }
  },
})
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
  return area.expanded && area.activeWidget === ENDGE_PREVIEW_RUNTIME_TREE_WIDGET_ID
})
const isBusy = computed(() => EndgeIDE.busy.value)
const hotkeysList = computed(() => EndgeIDE.hotkeys.getAllHotkeys())
const busyText = 'Подождите'

function getIconClass(tab: { meta?: Record<string, unknown> | undefined }): string | null {
  const icon = tab.meta?.icon
  return typeof icon === 'string' ? icon : null
}

useLayout({
  title: computed(() => 'Endge'),
})

onBeforeMount(() => {
  EndgeIDE.init()
})

onMounted(() => {
  if (route.query.guardTest === '1') {
    triggerAppRenderGuardTest({
      routePath: route.path,
      componentName: 'EndgeAdminEditorView',
    })
  }
})

onBeforeUnmount(() => {
  EndgeIDE.reset()
})
</script>

<template>
  <div class="h-full min-h-0 flex flex-col relative">
    <EmbeddedRuntimePreview v-if="isRuntimePreviewActive" class="min-h-0 flex-1" />

    <div v-else class="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <SmartTabsHost
        v-if="!hasNoTabs"
        :api="EndgeIDE.tabs"
        :get-icon-class="getIconClass"
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
            <Box class="size-24" stroke-width="1.25" />
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

    <CreateVersion_Modal v-model:open="createVersionOpen" />
    <CreateDocument_Modal v-model:open="createDocumentOpen" />
    <DuplicateDocument_Modal
      v-model:open="duplicateDocumentOpen"
      :source="duplicateSourceNode"
    />
    <ClearSoftDeleted_Modal v-model:open="clearSoftDeletedOpen" />
    <VocabJsonPreview_Modal
      v-model:open="vocabJsonPreviewOpen"
      :title="modals.vocabJsonPreviewTitle.value"
      :data="modals.vocabJsonPreviewData.value"
    />
    <SourceEditorDialogHost />

    <EndgeAppHelperMenu />
  </div>
</template>

<style>
.docs-tab-content .MarkdownWrapper {
  font-size: 0.8125rem;
  line-height: 1.5;
}
.docs-tab-content .MarkdownWrapper h1 { font-size: 1rem; }
.docs-tab-content .MarkdownWrapper h2 { font-size: 0.9375rem; }
.docs-tab-content .MarkdownWrapper h3 { font-size: 0.875rem; }
.docs-tab-content .MarkdownWrapper pre,
.docs-tab-content .MarkdownWrapper code { font-size: 0.75rem; }
</style>
