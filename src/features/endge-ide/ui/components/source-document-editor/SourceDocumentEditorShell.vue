<script setup lang="ts">
/* eslint-disable @intlify/vue-i18n/no-raw-text */
import type { DomainDocumentType } from '@endge/core'

import { useSmartTabViewState } from '@/components/ui/smart-tabs'
import { TooltipProvider } from '@/components/ui/tooltip'
import DocumentDependenciesPanel from '@/features/endge-ide/ui/components/document-dependencies/DocumentDependenciesPanel.vue'
import DocumentDependenciesToggle from '@/features/endge-ide/ui/components/document-dependencies/DocumentDependenciesToggle.vue'
import SourceEditorSplitView from '@/features/endge-ide/ui/components/source-document-editor/SourceEditorSplitView.vue'

defineProps<{
  documentId?: string | number | null
  identity?: string | null
  displayName?: string | null
  documentType?: DomainDocumentType | null
  dependencySource?: string | null
  dependencyDraft?: unknown
}>()

const dependenciesVisible = useSmartTabViewState<boolean>(
  'document.dependencies.visible',
  {
    defaultValue: () => false,
    validate: value => typeof value === 'boolean',
  },
)
const dependencySplitRatio = useSmartTabViewState<number>(
  'document.dependencies.split-ratio',
  {
    defaultValue: () => 0.7,
    validate: value => typeof value === 'number' && value >= 0.4 && value <= 0.82,
  },
)
</script>

<template>
  <div class="source-document-editor-shell">
    <header class="source-document-editor-shell__header">
      <div class="source-document-editor-shell__left">
        <slot name="left">
          <div class="source-document-editor-shell__metadata">
            <div class="source-document-editor-shell__metadata-row">
              <span class="source-document-editor-shell__metadata-label">id:</span>
              <span class="source-document-editor-shell__metadata-value">{{
                documentId ?? "-"
              }}</span>
            </div>
            <div class="source-document-editor-shell__metadata-row">
              <span class="source-document-editor-shell__metadata-label">identity:</span>
              <span class="source-document-editor-shell__metadata-value">{{
                identity || "-"
              }}</span>
            </div>
            <slot name="metadata-after" />
          </div>
        </slot>
      </div>

      <div class="source-document-editor-shell__center">
        <slot name="center" />
      </div>

      <div class="source-document-editor-shell__right">
        <slot name="right" />
        <TooltipProvider v-if="documentType">
          <div class="ml-2 flex items-center rounded-md border bg-muted/40 p-0.5">
            <DocumentDependenciesToggle
              :open="dependenciesVisible"
              @toggle="dependenciesVisible = !dependenciesVisible"
            />
          </div>
        </TooltipProvider>
      </div>
    </header>

    <main class="source-document-editor-shell__content">
      <SourceEditorSplitView
        v-if="documentType && identity"
        v-model:ratio="dependencySplitRatio"
        :output-visible="dependenciesVisible"
        separator-label="Изменить ширину редактора и панели зависимостей"
      >
        <template #editor>
          <slot />
        </template>
        <template #output>
          <DocumentDependenciesPanel
            :id="documentId"
            :document-type="documentType"
            :identity="identity"
            :display-name="displayName"
            :source="dependencySource"
            :draft="dependencyDraft"
          />
        </template>
      </SourceEditorSplitView>
      <slot v-else />
    </main>
  </div>
</template>

<style scoped>
.source-document-editor-shell {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

.source-document-editor-shell__header {
  display: grid;
  min-width: 0;
  flex: 0 0 auto;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 0.75rem;
  border-bottom: 1px solid hsl(var(--border));
  padding: 0.25rem 0.375rem;
}

.source-document-editor-shell__metadata {
  min-width: 0;
  padding-inline: 0.25rem;
  font-size: 0.75rem;
  line-height: 1rem;
}

.source-document-editor-shell__metadata-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.375rem;
}

.source-document-editor-shell__metadata-label {
  flex: 0 0 auto;
  color: hsl(var(--muted-foreground));
}

.source-document-editor-shell__metadata-value {
  min-width: 0;
  overflow: hidden;
  color: hsl(var(--foreground) / 0.82);
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    monospace;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-document-editor-shell__left,
.source-document-editor-shell__center,
.source-document-editor-shell__right {
  display: flex;
  min-width: 0;
  align-items: center;
}

.source-document-editor-shell__left {
  justify-content: flex-start;
}

.source-document-editor-shell__center {
  justify-content: center;
}

.source-document-editor-shell__right {
  justify-content: flex-end;
}

.source-document-editor-shell__content {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  overflow: hidden;
}
</style>
